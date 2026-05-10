import { Request, Response, NextFunction } from 'express'
import path from 'path'
import fs from 'fs'
import bcrypt from 'bcrypt'
import { z } from 'zod'
import { prisma } from '../config/database'
import { detectMime } from '../utils/mimeDetect'

const UPLOAD_TEMP_DIR = process.env.UPLOAD_TEMP_DIR ?? '/tmp/juriscontrol'
const UPLOAD_DIR = path.join(UPLOAD_TEMP_DIR, 'uploads')

function ensureUploadDir() { fs.mkdirSync(UPLOAD_DIR, { recursive: true }) }
function uploadUrl(filename: string): string { return `/api/downloads/uploads/${filename}` }

const READONLY_STATUSES = new Set(['encerrado', 'ganho', 'perdido', 'acordo', 'arquivado'])

async function getClientOrFail(req: Request, res: Response) {
  if (!req.user?.client_id) { res.status(401).json({ erro: 'Não autenticado como cliente' }); return null }
  const client = await prisma.client.findUnique({ where: { id: req.user.client_id } })
  if (!client) { res.status(404).json({ erro: 'Cliente não encontrado' }); return null }
  return client
}

async function getOwnProcess(processId: string, clientId: string, res: Response) {
  const proc = await prisma.process.findFirst({
    where: { id: processId, client_id: clientId, deleted_at: null },
  })
  if (!proc) { res.status(404).json({ erro: 'Processo não encontrado' }); return null }
  return proc
}

function isReadonly(proc: { status: string; summary_pdf_url: string | null }): boolean {
  return READONLY_STATUSES.has(proc.status) || !!proc.summary_pdf_url
}

export const portalController = {
  async me(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const client = await getClientOrFail(req, res)
      if (!client) return
      res.json({
        id: client.id,
        full_name: client.full_name,
        email: client.email,
        phone: client.phone,
        whatsapp: client.whatsapp,
        cpf: client.cpf,
        address: client.address,
        city: client.city,
        state: client.state,
      })
    } catch (err) { next(err) }
  },

  async updateMe(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const client = await getClientOrFail(req, res)
      if (!client) return

      const schema = z.object({
        phone: z.string().optional(),
        whatsapp: z.string().optional(),
        address: z.string().optional(),
      })
      const parsed = schema.safeParse(req.body)
      if (!parsed.success) { res.status(400).json({ erro: 'Dados inválidos' }); return }

      await prisma.client.update({ where: { id: client.id }, data: parsed.data })
      res.json({ mensagem: 'Dados atualizados' })
    } catch (err) { next(err) }
  },

  async changePassword(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) { res.status(401).json({ erro: 'Não autenticado' }); return }
      const schema = z.object({ password: z.string().min(6) })
      const parsed = schema.safeParse(req.body)
      if (!parsed.success) { res.status(400).json({ erro: 'Senha deve ter pelo menos 6 caracteres' }); return }

      const hash = await bcrypt.hash(parsed.data.password, 12)
      await prisma.user.update({
        where: { id: req.user.id },
        data: { password_hash: hash, portal_password_changed: true },
      })
      res.json({ mensagem: 'Senha alterada com sucesso' })
    } catch (err) { next(err) }
  },

  async listProcesses(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const client = await getClientOrFail(req, res)
      if (!client) return

      const processes = await prisma.process.findMany({
        where: { client_id: client.id, deleted_at: null },
        select: {
          id: true, case_title: true, process_number: true,
          status: true, process_type: true, open_date: true,
          pending_deadline: true, summary_pdf_url: true, ai_summary: true,
          court: true, judge: true,
        },
        orderBy: { updated_at: 'desc' },
      })
      res.json({ processes })
    } catch (err) { next(err) }
  },

  async getProcess(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const client = await getClientOrFail(req, res)
      if (!client) return
      const proc = await getOwnProcess(req.params.id, client.id, res)
      if (!proc) return

      const [hearings, timeline] = await Promise.all([
        prisma.hearing.findMany({
          where: { process_id: proc.id, status: 'agendada' },
          select: { id: true, title: true, hearing_date: true, hearing_time: true, hearing_type: true, location: true },
          orderBy: { hearing_date: 'asc' },
        }),
        prisma.processTimeline.findMany({
          where: { process_id: proc.id },
          select: { id: true, action_type: true, description: true, created_at: true },
          orderBy: { created_at: 'desc' },
          take: 20,
        }),
      ])

      res.json({
        id: proc.id,
        case_title: proc.case_title,
        process_number: proc.process_number,
        status: proc.status,
        process_type: proc.process_type,
        open_date: proc.open_date,
        pending_deadline: proc.pending_deadline,
        court: proc.court,
        judge: proc.judge,
        ai_summary: proc.ai_summary,
        summary_pdf_url: proc.summary_pdf_url,
        readonly: isReadonly(proc),
        upcoming_hearings: hearings,
        timeline,
      })
    } catch (err) { next(err) }
  },

  async listDocuments(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const client = await getClientOrFail(req, res)
      if (!client) return
      const proc = await getOwnProcess(req.params.id, client.id, res)
      if (!proc) return

      const docs = await prisma.processDocument.findMany({
        where: { process_id: proc.id, deleted_at: null },
        select: {
          id: true, document_type: true, file_name: true,
          file_url: true, file_type: true, upload_date: true,
          is_public: true, uploaded_by_role: true,
        },
        orderBy: { upload_date: 'desc' },
      })
      res.json({ documents: docs })
    } catch (err) { next(err) }
  },

  async uploadDocument(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const client = await getClientOrFail(req, res)
      if (!client) return
      const proc = await getOwnProcess(req.params.id, client.id, res)
      if (!proc) return

      if (isReadonly(proc)) {
        res.status(403).json({ erro: 'Processo protocolado. Para alterações, entre em contato com o escritório.' })
        return
      }

      const arquivo = req.file
      if (!arquivo) { res.status(400).json({ erro: 'Nenhum arquivo enviado' }); return }

      ensureUploadDir()
      const ext = path.extname(arquivo.originalname)
      const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`
      const dest = path.join(UPLOAD_DIR, filename)
      fs.writeFileSync(dest, arquivo.buffer)

      const mime = await detectMime(arquivo.buffer)

      const doc = await prisma.processDocument.create({
        data: {
          process_id: proc.id,
          document_type: 'extra',
          file_name: arquivo.originalname,
          file_url: uploadUrl(filename),
          file_path: dest,
          file_type: ext.slice(1),
          file_size: arquivo.size,
          file_mime: mime,
          storage_type: 'physical',
          uploaded_by_role: 'cliente',
        },
      })

      res.status(201).json({ id: doc.id, file_name: doc.file_name, file_url: doc.file_url })
    } catch (err) { next(err) }
  },

  async newCaseRequest(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const client = await getClientOrFail(req, res)
      if (!client) return

      const schema = z.object({
        description: z.string().min(10),
        area: z.string().optional(),
        urgency: z.enum(['normal', 'urgente']).default('normal'),
      })
      const parsed = schema.safeParse(req.body)
      if (!parsed.success) { res.status(400).json({ erro: 'Dados inválidos' }); return }

      const request = await prisma.caseRequest.create({
        data: { client_id: client.id, ...parsed.data },
      })

      // Notify advogado via WhatsApp (fire-and-forget)
      const advUser = await prisma.user.findFirst({ where: { id: (await prisma.client.findUnique({ where: { id: client.id }, select: { user_id: true } }))?.user_id } })
      if (advUser) {
        const settings = await prisma.settings.findUnique({ where: { user_id: advUser.id } })
        if (settings?.evolution_instance_name && settings.evolution_api_url && settings.evolution_api_key && advUser.phone) {
          const { EvolutionAPIService } = await import('../services/EvolutionAPIService')
          const evo = new EvolutionAPIService(settings.evolution_instance_name, settings.evolution_api_url, settings.evolution_api_key)
          evo.sendText(advUser.phone, `📋 Nova solicitação de caso!\nCliente: ${client.full_name}\nÁrea: ${parsed.data.area ?? 'Não informada'}\nUrgência: ${parsed.data.urgency}\n\n${parsed.data.description.slice(0, 200)}`).catch(() => null)
        }
      }

      res.status(201).json({ id: request.id, mensagem: 'Solicitação enviada com sucesso' })
    } catch (err) { next(err) }
  },
}
