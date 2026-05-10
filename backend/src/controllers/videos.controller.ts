import { Request, Response, NextFunction } from 'express'
import fs from 'fs'
import { z } from 'zod'
import { prisma } from '../config/database'
import { pdfService } from '../services/PDFService'
import { StorageService } from '../services/StorageService'

const videoSchema = z.object({
  title:       z.string().min(1, 'Título obrigatório'),
  url:         z.string().url('URL inválida'),
  description: z.string().optional().default(''),
})

async function verifyProcessAccess(processId: string, userId: string, res: Response) {
  const proc = await prisma.process.findFirst({
    where: { id: processId, user_id: userId, deleted_at: null },
  })
  if (!proc) { res.status(404).json({ erro: 'Processo não encontrado' }); return null }
  return proc
}

export const videosController = {

  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) { res.status(401).json({ erro: 'Não autenticado' }); return }
      const proc = await verifyProcessAccess(req.params.id, req.user.id, res)
      if (!proc) return

      const videos = await prisma.processDocument.findMany({
        where: { process_id: req.params.id, document_type: 'video_link', deleted_at: null },
        select: { id: true, file_name: true, file_url: true, notes: true, upload_date: true },
        orderBy: { upload_date: 'asc' },
      })
      res.json({ videos })
    } catch (err) { next(err) }
  },

  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) { res.status(401).json({ erro: 'Não autenticado' }); return }
      const proc = await verifyProcessAccess(req.params.id, req.user.id, res)
      if (!proc) return

      const parsed = videoSchema.safeParse(req.body)
      if (!parsed.success) {
        res.status(400).json({ erro: parsed.error.errors[0]?.message }); return
      }
      const { title, url, description } = parsed.data

      const video = await prisma.processDocument.create({
        data: {
          process_id:    req.params.id,
          document_type: 'video_link',
          file_name:     title,
          file_url:      url,
          notes:         description || null,
          storage_type:  'external_link',
          file_type:     'video',
          order_index:   0,
          uploaded_by_role: req.user.role,
        },
      })

      await prisma.processTimeline.create({
        data: {
          process_id:  req.params.id,
          user_id:     req.user.id,
          action_type: 'documento_adicionado',
          description: `Link de vídeo adicionado: ${title}`,
        },
      })

      res.status(201).json({ id: video.id, file_name: video.file_name, file_url: video.file_url, notes: video.notes })
    } catch (err) { next(err) }
  },

  async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) { res.status(401).json({ erro: 'Não autenticado' }); return }
      const proc = await verifyProcessAccess(req.params.id, req.user.id, res)
      if (!proc) return

      const video = await prisma.processDocument.findFirst({
        where: { id: req.params.videoId, process_id: req.params.id, document_type: 'video_link', deleted_at: null },
      })
      if (!video) { res.status(404).json({ erro: 'Vídeo não encontrado' }); return }

      await prisma.processDocument.update({ where: { id: video.id }, data: { deleted_at: new Date() } })
      res.status(204).send()
    } catch (err) { next(err) }
  },

  async generatePdf(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) { res.status(401).json({ erro: 'Não autenticado' }); return }
      const proc = await verifyProcessAccess(req.params.id, req.user.id, res)
      if (!proc) return

      const videos = await prisma.processDocument.findMany({
        where: { process_id: req.params.id, document_type: 'video_link', deleted_at: null },
        orderBy: { upload_date: 'asc' },
      })

      if (videos.length === 0) {
        res.status(400).json({ erro: 'Nenhum vídeo cadastrado neste processo' }); return
      }

      const user = await prisma.user.findUnique({
        where: { id: req.user.id },
        include: { settings: true },
      })
      if (!user) { res.status(401).json({ erro: 'Usuário não encontrado' }); return }

      const client = await prisma.client.findUnique({ where: { id: proc.client_id } })

      const result = await pdfService.generateVideosPDF({
        caseTitle:     proc.case_title,
        processNumber: proc.process_number,
        clientName:    client?.full_name ?? '',
        videos: videos.map(v => ({
          title:       v.file_name,
          url:         v.file_url ?? '',
          description: v.notes ?? '',
        })),
        user,
      })

      const annex = await prisma.videoAnnex.create({
        data: {
          process_id:           req.params.id,
          title:                `Mídias — ${proc.case_title}`,
          pdf_url:              result.downloadUrl,
          document_ids:         videos.map(v => v.id),
          file_hash:            result.fileHash,
          generated_by:         req.user.id,
          storage_provider_used: 'local',
        },
      })

      await prisma.processTimeline.create({
        data: {
          process_id:  req.params.id,
          user_id:     req.user.id,
          action_type: 'processo_pdf_gerado',
          description: `PDF de Mídias gerado (${videos.length} vídeo${videos.length !== 1 ? 's' : ''})`,
        },
      })

      // Non-blocking cloud upload to process root folder
      const storageService = new StorageService(req.user.id)
      const pdfBuffer = fs.readFileSync(result.filePath)
      const pdfFileName = `midias_${Date.now()}.pdf`
      storageService.uploadBuffer(
        { onedrive: proc.onedrive_folder_id, googledrive: proc.google_drive_folder_id },
        pdfBuffer, pdfFileName, 'application/pdf',
      )
        .then(async cloudResult => {
          const data: Record<string, string> = {}
          if (cloudResult.onedrive) {
            data.onedrive_item_id   = cloudResult.onedrive.itemId
            data.public_share_link  = cloudResult.onedrive.shareLink
            data.storage_provider_used = 'onedrive'
          }
          if (cloudResult.googledrive) {
            data.google_drive_item_id    = cloudResult.googledrive.itemId
            data.google_drive_share_link = cloudResult.googledrive.shareLink
            if (!data.storage_provider_used) data.storage_provider_used = 'googledrive'
          }
          if (Object.keys(data).length > 0) {
            await prisma.videoAnnex.update({ where: { id: annex.id }, data })
          }
        })
        .catch(() => null)

      res.status(201).json({
        id:          annex.id,
        downloadUrl: result.downloadUrl,
        pageCount:   undefined,
      })
    } catch (err) { next(err) }
  },

  async listPdfs(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) { res.status(401).json({ erro: 'Não autenticado' }); return }
      const proc = await verifyProcessAccess(req.params.id, req.user.id, res)
      if (!proc) return

      const pdfs = await prisma.videoAnnex.findMany({
        where: { process_id: req.params.id },
        select: {
          id: true, title: true, pdf_url: true,
          public_share_link: true, google_drive_share_link: true, generated_at: true,
        },
        orderBy: { generated_at: 'desc' },
      })
      res.json({ pdfs })
    } catch (err) { next(err) }
  },
}
