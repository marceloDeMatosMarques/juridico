import cron from 'node-cron'
import { prisma } from '../config/database'
import { EvolutionAPIService } from '../services/EvolutionAPIService'

const TYPE_LABEL: Record<string, string> = {
  audiencia_instrucao:    'Audiência de Instrução',
  audiencia_conciliacao:  'Audiência de Conciliação',
  audiencia_julgamento:   'Audiência de Julgamento',
  reuniao_cliente:        'Reunião com Cliente',
  prazo_processual:       'Prazo Processual',
  diligencia:             'Diligência',
  pericia:                'Perícia',
}

async function sendReminders() {
  const today = new Date()
  today.setUTCHours(0, 0, 0, 0)

  for (const daysAhead of [3, 2, 1] as const) {
    const target  = new Date(today); target.setUTCDate(today.getUTCDate() + daysAhead)
    const nextDay = new Date(target); nextDay.setUTCDate(target.getUTCDate() + 1)

    const reminderField = `reminder_d${daysAhead}_sent` as
      'reminder_d3_sent' | 'reminder_d2_sent' | 'reminder_d1_sent'

    const hearings = await prisma.hearing.findMany({
      where: {
        status:         'agendada',
        hearing_date:   { gte: target, lt: nextDay },
        [reminderField]: false,
      },
      include: {
        process: { include: { client: true } },
        user:    { include: { settings: true } },
      },
    })

    for (const hearing of hearings) {
      const { client }   = hearing.process
      const { user }     = hearing
      const settings     = user.settings
      const phone        = client.whatsapp || client.phone

      if (
        phone &&
        user.whatsapp_connected &&
        settings?.evolution_api_url &&
        settings?.evolution_api_key
      ) {
        const instanceName = settings.evolution_instance_name ?? 'juriscontrol'
        const svc = new EvolutionAPIService(instanceName, settings.evolution_api_url, settings.evolution_api_key)

        const tipo  = TYPE_LABEL[hearing.hearing_type] ?? hearing.hearing_type
        const data  = new Date(hearing.hearing_date).toLocaleDateString('pt-BR')
        const when  = daysAhead === 1 ? 'amanhã' : `em ${daysAhead} dias`
        const local = hearing.location ? `\nLocal: ${hearing.location}` : ''
        const msg   = `⚖️ Lembrete Jurídico\n\n${TYPE_LABEL[hearing.hearing_type] ?? tipo} ${when}\n📅 ${data} às ${hearing.hearing_time}${local}\n\nAdvogado: ${user.name}`

        await svc.sendText(phone, msg).catch(() => null)

        await prisma.whatsAppMessage.create({
          data: {
            user_id:      user.id,
            client_id:    client.id,
            process_id:   hearing.process_id,
            direction:    'sent',
            message_type: 'text',
            content:      msg,
            status:       'sent',
            sent_at:      new Date(),
          },
        }).catch(() => null)
      }

      await prisma.hearing.update({
        where: { id: hearing.id },
        data:  { [reminderField]: true },
      }).catch(() => null)
    }
  }
}

export function startRemindersJob() {
  // Run at 8am BRT (UTC-3 = 11:00 UTC)
  cron.schedule('0 11 * * *', () => {
    sendReminders().catch(err =>
      console.error(JSON.stringify({ level: 'error', action: 'reminders_job', data: { error: (err as Error).message } }))
    )
  })
}
