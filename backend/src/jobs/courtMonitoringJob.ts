import cron from 'node-cron'
import axios from 'axios'
import { prisma } from '../config/database'
import { MicrosoftGraphService } from '../services/MicrosoftGraphService'
import { geminiService } from '../services/GeminiService'
import { EvolutionAPIService } from '../services/EvolutionAPIService'

const PROCESS_NUMBER_RE = /\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}/

type GraphMessage = {
  id: string
  subject: string
  body: { content: string; contentType: string }
  receivedDateTime: string
  from: { emailAddress: { address: string; name: string } }
}

type UserSettings = {
  evolution_api_url: string | null
  evolution_api_key: string | null
  evolution_instance_name: string | null
}

async function processEmail(
  userId: string,
  msg: GraphMessage,
  phone: string | null,
  settings: UserSettings | null,
  source: string,
) {
  const combined = msg.subject + ' ' + (msg.body?.content ?? '')
  const match = combined.match(PROCESS_NUMBER_RE)
  if (!match) return

  const rawNum = match[0]
  const digitsOnly = rawNum.replace(/[.\-]/g, '')

  const process = await prisma.process.findFirst({
    where: {
      user_id: userId,
      OR: [{ process_number: rawNum }, { process_number: { contains: digitsOnly } }],
      deleted_at: null,
    },
  })
  if (!process) return

  const alreadyExists = await prisma.courtNotification.findFirst({
    where: {
      user_id:                userId,
      process_id:             process.id,
      original_email_subject: msg.subject,
      received_at:            new Date(msg.receivedDateTime),
    },
  })
  if (alreadyExists) return

  const parsed = await geminiService.parseCourtEmail(msg.subject, msg.body?.content ?? '').catch(() => null)

  const notification = await prisma.courtNotification.create({
    data: {
      user_id:                 userId,
      process_id:              process.id,
      source:                  source as any,
      notification_type:       (parsed?.notification_type ?? 'outro') as any,
      original_email_subject:  msg.subject,
      original_email_body:     (msg.body?.content ?? '').slice(0, 10000),
      parsed_content:          (parsed ?? {}) as any,
      deadline_date:           parsed?.deadline_date ? new Date(parsed.deadline_date) : null,
      deadline_days_remaining: parsed?.deadline_days_remaining ?? null,
      is_urgent:               parsed?.is_urgent ?? false,
      received_at:             new Date(msg.receivedDateTime),
    },
  })

  await prisma.process.update({
    where: { id: process.id },
    data:  { last_court_notification_at: new Date() },
  }).catch(() => null)

  if (notification.is_urgent && phone && settings?.evolution_api_url && settings?.evolution_api_key) {
    const svc = new EvolutionAPIService(
      settings.evolution_instance_name ?? 'juriscontrol',
      settings.evolution_api_url,
      settings.evolution_api_key,
    )
    const prazoStr = parsed?.deadline_date
      ? `\nPrazo: ${new Date(parsed.deadline_date).toLocaleDateString('pt-BR')}`
      : ''
    const text = `⚖️ *Notificação Urgente — Tribunal*\n\n${parsed?.summary ?? msg.subject}\n\nProcesso: ${process.case_title}${prazoStr}`
    await svc.sendText(phone, text).catch(() => null)
    await prisma.courtNotification.update({
      where: { id: notification.id },
      data:  { whatsapp_alert_sent: true },
    }).catch(() => null)
  }
}

async function runCourtMonitoring() {
  const users = await prisma.user.findMany({
    where: {
      microsoft_access_token: { not: null },
      settings: { auto_monitor_court_emails: true },
    },
    include: { settings: true },
  })

  for (const user of users) {
    try {
      const domains = await prisma.monitoredCourtDomain.findMany({
        where: { user_id: user.id, active: true },
      })
      if (domains.length === 0) continue

      const token = await new MicrosoftGraphService(user.id).getValidToken().catch(() => null)
      if (!token) continue

      const since = new Date(Date.now() - 16 * 60 * 1000).toISOString()
      const domainFilters = domains
        .map(d => `contains(from/emailAddress/address,'${d.email_domain}')`)
        .join(' or ')
      const filter = `receivedDateTime gt ${since} and (${domainFilters})`

      const resp = await axios.get<{ value: GraphMessage[] }>(
        `https://graph.microsoft.com/v1.0/me/messages?$filter=${encodeURIComponent(filter)}&$top=50&$select=id,subject,body,receivedDateTime,from`,
        { headers: { Authorization: `Bearer ${token}` } },
      ).catch(() => null)

      if (!resp?.data?.value?.length) continue

      for (const msg of resp.data.value) {
        const emailAddr = msg.from?.emailAddress?.address ?? ''
        const domain = domains.find(d => emailAddr.includes(d.email_domain))
        const source = domain?.court_system ?? 'email_manual'
        await processEmail(user.id, msg, user.phone, user.settings, source).catch(() => null)
      }
    } catch {
      // continue to next user
    }
  }
}

export function startCourtMonitoringJob() {
  cron.schedule('*/15 * * * *', () => {
    runCourtMonitoring().catch(err =>
      console.error(JSON.stringify({ level: 'error', action: 'court_monitoring_job', data: { error: (err as Error).message } }))
    )
  })
}
