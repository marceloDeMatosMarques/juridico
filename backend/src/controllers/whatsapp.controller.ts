import { Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import { prisma } from '../config/database'
import { EvolutionAPIService } from '../services/EvolutionAPIService'
import { geminiService } from '../services/GeminiService'

const configSchema = z.object({
  evolution_api_url:       z.string().url('URL inválida'),
  evolution_api_key:       z.string().min(1, 'API key obrigatória'),
  evolution_instance_name: z.string().min(1).default('juriscontrol'),
})

const sendSchema = z.object({
  client_id: z.string().uuid(),
  message:   z.string().min(1),
})

async function getEvolutionService(userId: string): Promise<EvolutionAPIService | null> {
  const settings = await prisma.settings.findUnique({ where: { user_id: userId } })
  if (!settings?.evolution_api_url || !settings?.evolution_api_key) return null
  const instanceName = settings.evolution_instance_name || 'juriscontrol'
  return new EvolutionAPIService(instanceName, settings.evolution_api_url, settings.evolution_api_key)
}

function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, '')
}

function phoneMatches(dbPhone: string | null, incoming: string): boolean {
  if (!dbPhone) return false
  const db = normalizePhone(dbPhone)
  const inc = normalizePhone(incoming)
  // Compare last 11 digits (local format) or last 13 (with country code)
  return db === inc || db.endsWith(inc.slice(-11)) || inc.endsWith(db.slice(-11))
}

const STATUS_LABEL: Record<string, string> = {
  aberto: 'Aberto', em_andamento: 'Em andamento', aguardando_audiencia: 'Aguardando audiência',
  encerrado: 'Encerrado', ganho: 'Ganho', perdido: 'Perdido', acordo: 'Acordo', arquivado: 'Arquivado',
}

export const whatsappController = {

  async getConfig(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) { res.status(401).json({ erro: 'Não autenticado' }); return }
      const settings = await prisma.settings.findUnique({ where: { user_id: req.user.id } })
      const user     = await prisma.user.findUnique({ where: { id: req.user.id }, select: { whatsapp_connected: true, whatsapp_instance_id: true } })

      res.json({
        evolution_api_url:       settings?.evolution_api_url ?? '',
        evolution_api_key:       settings?.evolution_api_key ? '***' : '',
        evolution_instance_name: settings?.evolution_instance_name ?? 'juriscontrol',
        connected:               user?.whatsapp_connected ?? false,
        instance_id:             user?.whatsapp_instance_id ?? null,
      })
    } catch (err) { next(err) }
  },

  async saveConfig(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) { res.status(401).json({ erro: 'Não autenticado' }); return }
      const parsed = configSchema.safeParse(req.body)
      if (!parsed.success) { res.status(400).json({ erro: parsed.error.errors[0]?.message }); return }

      await prisma.settings.upsert({
        where:  { user_id: req.user.id },
        update: {
          evolution_api_url:       parsed.data.evolution_api_url,
          evolution_api_key:       parsed.data.evolution_api_key,
          evolution_instance_name: parsed.data.evolution_instance_name,
        },
        create: {
          user_id:                 req.user.id,
          evolution_api_url:       parsed.data.evolution_api_url,
          evolution_api_key:       parsed.data.evolution_api_key,
          evolution_instance_name: parsed.data.evolution_instance_name,
        },
      })
      res.json({ message: 'Configuração salva' })
    } catch (err) { next(err) }
  },

  async connect(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) { res.status(401).json({ erro: 'Não autenticado' }); return }
      const svc = await getEvolutionService(req.user.id)
      if (!svc) { res.status(400).json({ erro: 'Evolution API não configurada' }); return }

      const settings = await prisma.settings.findUnique({ where: { user_id: req.user.id } })
      const instanceName = settings?.evolution_instance_name ?? 'juriscontrol'
      const webhookBase = process.env.APP_URL ?? `http://localhost:${process.env.PORT ?? 3000}`

      // If already connected, just re-register webhook and confirm
      const currentState = await svc.getConnectionState()
      if (currentState === 'open') {
        svc.setWebhook(`${webhookBase}/api/whatsapp/webhook`).catch(() => null)
        await prisma.user.update({
          where: { id: req.user.id },
          data:  { whatsapp_instance_id: instanceName, whatsapp_connected: true },
        })
        res.json({ qrcode: null, connected: true, message: 'WhatsApp conectado' })
        return
      }

      // Not connected — create or reconnect instance to get QR
      let qrBase64: string | null = null
      try {
        const result = await svc.createInstance()
        qrBase64 = result.qrcode?.base64 ?? null
      } catch {
        // Instance may already exist — try to get QR
        qrBase64 = await svc.getQRCode()
      }

      svc.setWebhook(`${webhookBase}/api/whatsapp/webhook`).catch(() => null)

      await prisma.user.update({
        where: { id: req.user.id },
        data:  { whatsapp_instance_id: instanceName, whatsapp_connected: false },
      })

      res.json({ qrcode: qrBase64, message: 'Escaneie o QR code com seu WhatsApp' })
    } catch (err) { next(err) }
  },

  async qrcode(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) { res.status(401).json({ erro: 'Não autenticado' }); return }
      const svc = await getEvolutionService(req.user.id)
      if (!svc) { res.status(400).json({ erro: 'Evolution API não configurada' }); return }

      const qrBase64 = await svc.getQRCode()
      res.json({ qrcode: qrBase64 })
    } catch (err) { next(err) }
  },

  async status(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) { res.status(401).json({ erro: 'Não autenticado' }); return }
      const svc = await getEvolutionService(req.user.id)
      if (!svc) { res.json({ state: 'not_configured' }); return }

      const state = await svc.getConnectionState()
      if (state === 'open') {
        await prisma.user.update({ where: { id: req.user.id }, data: { whatsapp_connected: true } })
      }
      res.json({ state })
    } catch (err) { next(err) }
  },

  async disconnect(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) { res.status(401).json({ erro: 'Não autenticado' }); return }
      const svc = await getEvolutionService(req.user.id)
      if (svc) {
        await svc.logout().catch(() => null)
      }
      await prisma.user.update({
        where: { id: req.user.id },
        data:  { whatsapp_connected: false },
      })
      res.json({ message: 'Desconectado' })
    } catch (err) { next(err) }
  },

  async send(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) { res.status(401).json({ erro: 'Não autenticado' }); return }
      const parsed = sendSchema.safeParse(req.body)
      if (!parsed.success) { res.status(400).json({ erro: parsed.error.errors[0]?.message }); return }

      const client = await prisma.client.findFirst({
        where: { id: parsed.data.client_id, user_id: req.user.id, deleted_at: null },
      })
      if (!client) { res.status(404).json({ erro: 'Cliente não encontrado' }); return }

      const phone = client.whatsapp || client.phone
      if (!phone) { res.status(400).json({ erro: 'Cliente sem número de WhatsApp/telefone' }); return }

      const svc = await getEvolutionService(req.user.id)
      if (!svc) { res.status(400).json({ erro: 'Evolution API não configurada' }); return }

      await svc.sendText(phone, parsed.data.message)

      await prisma.whatsAppMessage.create({
        data: {
          user_id:    req.user.id,
          client_id:  client.id,
          direction:  'sent',
          message_type: 'text',
          content:    parsed.data.message,
          status:     'sent',
          sent_at:    new Date(),
        },
      })

      res.json({ message: 'Mensagem enviada' })
    } catch (err) { next(err) }
  },

  async history(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) { res.status(401).json({ erro: 'Não autenticado' }); return }
      const { clientId } = req.params

      const messages = await prisma.whatsAppMessage.findMany({
        where: { user_id: req.user.id, client_id: clientId },
        orderBy: { sent_at: 'asc' },
        take: 100,
        select: { id: true, direction: true, content: true, status: true, sent_at: true, message_type: true },
      })
      res.json({ messages })
    } catch (err) { next(err) }
  },

  // Public — called by Evolution API webhook
  async webhook(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      res.status(200).send('ok') // always acknowledge first

      const body = req.body as {
        event?: string
        instance?: string
        data?: {
          key?: { remoteJid?: string; fromMe?: boolean; id?: string }
          message?: { conversation?: string; extendedTextMessage?: { text?: string } }
          messageTimestamp?: number
          pushName?: string
        }
      }

      if (body.event === 'CONNECTION_UPDATE') {
        // Update connected state if instance is open
        const state = (body.data as unknown as { state?: string })?.state
        if (state === 'open' && body.instance) {
          await prisma.user.updateMany({
            where: { whatsapp_instance_id: body.instance },
            data:  { whatsapp_connected: true },
          })
        }
        return
      }

      if (body.event !== 'MESSAGES_UPSERT') return

      const key = body.data?.key
      if (!key || key.fromMe) return  // ignore outgoing messages

      const remoteJid = key.remoteJid ?? ''
      const phone = remoteJid.replace(/@.*/, '')  // strip @s.whatsapp.net
      const text = body.data?.message?.conversation
        ?? body.data?.message?.extendedTextMessage?.text
        ?? ''

      if (!phone || !text.trim()) return

      // Find user by instance name
      const user = await prisma.user.findFirst({
        where: { whatsapp_instance_id: body.instance ?? '' },
        select: { id: true },
      })
      if (!user) return

      // Find client by phone
      const allClients = await prisma.client.findMany({
        where: { user_id: user.id, deleted_at: null },
        select: { id: true, full_name: true, whatsapp: true, phone: true },
      })
      const client = allClients.find(c => phoneMatches(c.whatsapp, phone) || phoneMatches(c.phone, phone))

      // Save incoming message
      await prisma.whatsAppMessage.create({
        data: {
          user_id:             user.id,
          client_id:           client?.id ?? null,
          direction:           'received',
          message_type:        'text',
          content:             text,
          whatsapp_message_id: key.id,
          status:              'delivered',
          sent_at:             new Date((body.data?.messageTimestamp ?? 0) * 1000 || Date.now()),
        },
      })

      // Bot reply
      const settings = await prisma.settings.findUnique({ where: { user_id: user.id } })
      if (!settings?.evolution_api_url || !settings?.evolution_api_key) return

      const instanceName = settings.evolution_instance_name ?? 'juriscontrol'
      const svc = new EvolutionAPIService(instanceName, settings.evolution_api_url, settings.evolution_api_key)

      let reply: string
      if (client) {
        const processes = await prisma.process.findMany({
          where:  { client_id: client.id, user_id: user.id, deleted_at: null, status: { in: ['aberto', 'em_andamento', 'aguardando_audiencia'] } },
          select: { case_title: true, status: true, pending_deadline: true },
          take: 5,
        })

        // Status-query keywords get the standard structured reply
        const isStatusQuery = /processo|andamento|status|prazo|caso|audiência/i.test(text)

        if (isStatusQuery || processes.length === 0) {
          if (processes.length === 0) {
            reply = `Olá, ${client.full_name}! Não encontrei processos ativos no momento. Em caso de dúvidas, entre em contato pelo escritório.`
          } else {
            const lista = processes.map((p, i) =>
              `${i + 1}. ${p.case_title} — ${STATUS_LABEL[p.status] ?? p.status}${p.pending_deadline ? ` (prazo: ${new Date(p.pending_deadline).toLocaleDateString('pt-BR')})` : ''}`
            ).join('\n')
            reply = `Olá, ${client.full_name}! Seus processos ativos:\n\n${lista}\n\nPara mais informações, entre em contato com o escritório.`
          }
        } else {
          // Use Gemini for intelligent contextual reply
          const context = processes.map(p => `${p.case_title} (${STATUS_LABEL[p.status] ?? p.status})`).join(', ')
          const aiReply = await geminiService.classifyWhatsAppIntent(text, client.full_name, context).catch(() => null)
          reply = aiReply ?? `Olá, ${client.full_name}! Recebemos sua mensagem. Em caso de urgência, entre em contato diretamente com o escritório.`
        }
      } else {
        reply = 'Olá! Não encontrei seu cadastro em nosso sistema. Entre em contato diretamente com o escritório para obter informações sobre seu processo.'
      }

      await svc.sendText(phone, reply).catch(() => null)

      // Save reply
      await prisma.whatsAppMessage.create({
        data: {
          user_id:      user.id,
          client_id:    client?.id ?? null,
          direction:    'sent',
          message_type: 'text',
          content:      reply,
          status:       'sent',
          sent_at:      new Date(),
        },
      })
    } catch (err) {
      console.error('WhatsApp webhook error:', err)
    }
  },
}
