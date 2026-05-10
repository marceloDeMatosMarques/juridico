import { Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import { prisma } from '../config/database'
import { StorageService } from '../services/StorageService'
import { geminiService } from '../services/GeminiService'
import type { ProcessType, ProcessStatus, CourtSystem } from '@prisma/client'

const processSchema = z.object({
  client_id:        z.string().uuid(),
  case_title:       z.string().min(2, 'Título obrigatório'),
  process_number:   z.string().optional().transform(v => v?.trim() || undefined),
  process_type:     z.string().optional(),
  status:           z.string().optional(),
  court:            z.string().optional(),
  judge:            z.string().optional(),
  opposing_party:   z.string().optional(),
  court_system:     z.string().optional(),
  court_email_domain: z.string().optional(),
  pending_deadline: z.string().optional().transform(v => v ? new Date(v) : undefined),
  case_description: z.string().optional(),
})

export const processesController = {

  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) { res.status(401).json({ erro: 'Não autenticado' }); return }

      const { page = '1', limit = '20', q, status, client_id } = req.query as Record<string, string>
      const skip = (Number(page) - 1) * Number(limit)

      const where = {
        user_id: req.user.id,
        deleted_at: null,
        ...(client_id ? { client_id } : {}),
        ...(status ? { status: status as ProcessStatus } : {}),
        ...(q ? {
          OR: [
            { case_title: { contains: q } },
            { process_number: { contains: q } },
            { client: { full_name: { contains: q } } },
          ],
        } : {}),
      }

      const [total, processes] = await Promise.all([
        prisma.process.count({ where }),
        prisma.process.findMany({
          where,
          include: { client: { select: { id: true, full_name: true } } },
          orderBy: { created_at: 'desc' },
          skip,
          take: Number(limit),
        }),
      ])

      res.json({ processes, total, page: Number(page), limit: Number(limit) })
    } catch (err) { next(err) }
  },

  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) { res.status(401).json({ erro: 'Não autenticado' }); return }

      const parsed = processSchema.safeParse(req.body)
      if (!parsed.success) {
        res.status(400).json({ erro: parsed.error.errors[0]?.message }); return
      }
      const data = parsed.data

      // Verify client belongs to user
      const client = await prisma.client.findFirst({
        where: { id: data.client_id, user_id: req.user.id, deleted_at: null },
      })
      if (!client) { res.status(404).json({ erro: 'Cliente não encontrado' }); return }

      const processo = await prisma.process.create({
        data: {
          user_id:           req.user.id,
          client_id:         data.client_id,
          case_title:        data.case_title,
          process_number:    data.process_number,
          process_type:      (data.process_type as ProcessType) ?? 'civil_consumidor',
          status:            (data.status as ProcessStatus) ?? 'aberto',
          court:             data.court,
          judge:             data.judge,
          opposing_party:    data.opposing_party,
          court_system:      data.court_system ? (data.court_system as CourtSystem) : undefined,
          court_email_domain: data.court_email_domain,
          pending_deadline:  data.pending_deadline,
          case_description:  data.case_description,
        },
        include: { client: { select: { id: true, full_name: true } } },
      })

      await prisma.processTimeline.create({
        data: {
          process_id:  processo.id,
          user_id:     req.user.id,
          action_type: 'processo_criado',
          description: `Processo criado: ${data.case_title}`,
        },
      })

      // Create storage folder structure (non-blocking)
      const processRef = data.process_number || data.case_title
      const storageService = new StorageService(req.user.id)
      storageService.createFolderStructure(client.full_name, processRef)
        .then(async folders => {
          const updates: Record<string, string> = {}
          if (folders.onedrive) {
            updates.onedrive_folder_id = folders.onedrive.folderId
            updates.onedrive_folder_url = folders.onedrive.folderUrl
            updates.onedrive_docs_folder_id = folders.onedrive.docsFolderId
          }
          if (folders.googledrive) {
            updates.google_drive_folder_id = folders.googledrive.folderId
            updates.google_drive_folder_url = folders.googledrive.folderUrl
            updates.google_drive_docs_folder_id = folders.googledrive.docsFolderId
          }
          if (Object.keys(updates).length > 0) {
            await prisma.process.update({ where: { id: processo.id }, data: updates })
            await prisma.processTimeline.create({
              data: {
                process_id:  processo.id,
                user_id:     req.user!.id,
                action_type: 'pasta_storage_criada',
                description: `Pastas criadas: ${Object.keys(updates).filter(k => k.includes('folder_id')).map(k => k.includes('google') ? 'Google Drive' : 'OneDrive').join(', ')}`,
              },
            })
          }
        })
        .catch(() => null)  // storage failure is non-fatal

      res.status(201).json(processo)
    } catch (err) { next(err) }
  },

  async getOne(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) { res.status(401).json({ erro: 'Não autenticado' }); return }

      const processo = await prisma.process.findFirst({
        where: { id: req.params.id, user_id: req.user.id, deleted_at: null },
        include: {
          client: { select: { id: true, full_name: true, cpf: true, email: true, phone: true } },
          timeline: { orderBy: { created_at: 'desc' }, take: 30 },
          documents: {
            where: { deleted_at: null },
            select: { id: true, file_name: true, document_type: true, file_url: true, rotation: true, requires_password: true, order_index: true },
            orderBy: { order_index: 'asc' },
          },
        },
      })

      if (!processo) { res.status(404).json({ erro: 'Processo não encontrado' }); return }
      res.json(processo)
    } catch (err) { next(err) }
  },

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) { res.status(401).json({ erro: 'Não autenticado' }); return }

      const existing = await prisma.process.findFirst({
        where: { id: req.params.id, user_id: req.user.id, deleted_at: null },
      })
      if (!existing) { res.status(404).json({ erro: 'Processo não encontrado' }); return }

      const parsed = processSchema.partial().safeParse(req.body)
      if (!parsed.success) {
        res.status(400).json({ erro: parsed.error.errors[0]?.message }); return
      }
      const data = parsed.data

      const updated = await prisma.process.update({
        where: { id: req.params.id },
        data: {
          case_title:        data.case_title,
          process_number:    data.process_number,
          process_type:      data.process_type as ProcessType | undefined,
          status:            data.status as ProcessStatus | undefined,
          court:             data.court,
          judge:             data.judge,
          opposing_party:    data.opposing_party,
          court_system:      data.court_system ? (data.court_system as CourtSystem) : undefined,
          court_email_domain: data.court_email_domain,
          pending_deadline:  data.pending_deadline,
          case_description:  data.case_description,
        },
        include: { client: { select: { id: true, full_name: true } } },
      })

      await prisma.processTimeline.create({
        data: {
          process_id:  req.params.id,
          user_id:     req.user.id,
          action_type: 'processo_atualizado',
          description: 'Dados do processo atualizados',
        },
      })

      res.json(updated)
    } catch (err) { next(err) }
  },

  async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) { res.status(401).json({ erro: 'Não autenticado' }); return }

      const existing = await prisma.process.findFirst({
        where: { id: req.params.id, user_id: req.user.id, deleted_at: null },
      })
      if (!existing) { res.status(404).json({ erro: 'Processo não encontrado' }); return }

      await prisma.process.update({
        where: { id: req.params.id },
        data: { deleted_at: new Date(), status: 'arquivado' },
      })
      res.status(204).send()
    } catch (err) { next(err) }
  },

  async generateAiSummary(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) { res.status(401).json({ erro: 'Não autenticado' }); return }

      const proc = await prisma.process.findFirst({
        where:   { id: req.params.id, user_id: req.user.id, deleted_at: null },
        include: { client: { select: { full_name: true } } },
      })
      if (!proc) { res.status(404).json({ erro: 'Processo não encontrado' }); return }

      const summary = await geminiService.generateProcessSummary({
        case_title:       proc.case_title,
        process_type:     proc.process_type,
        status:           proc.status,
        client_name:      proc.client.full_name,
        case_description: proc.case_description,
        court:            proc.court,
        opposing_party:   proc.opposing_party,
        pending_deadline: proc.pending_deadline?.toISOString().slice(0, 10) ?? null,
      })

      if (!summary) { res.status(503).json({ erro: 'Gemini indisponível ou chave não configurada' }); return }

      await prisma.process.update({ where: { id: proc.id }, data: { ai_summary: summary } })
      res.json({ ai_summary: summary })
    } catch (err) { next(err) }
  },
}
