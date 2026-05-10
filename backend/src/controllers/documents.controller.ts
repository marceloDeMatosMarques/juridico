import { Request, Response, NextFunction } from 'express'
import path from 'path'
import fs from 'fs'
import crypto from 'crypto'
import { z } from 'zod'
import sharp from 'sharp'
import { prisma } from '../config/database'
import { detectMime } from '../utils/mimeDetect'
import { pdfService } from '../services/PDFService'
import { StorageService } from '../services/StorageService'
import { geminiService } from '../services/GeminiService'
import type { DocumentType } from '@prisma/client'

const UPLOAD_TEMP_DIR = process.env.UPLOAD_TEMP_DIR ?? '/tmp/juriscontrol'
const UPLOAD_DIR = path.join(UPLOAD_TEMP_DIR, 'uploads')

function ensureUploadDir() { fs.mkdirSync(UPLOAD_DIR, { recursive: true }) }

function sha256(buffer: Buffer): string {
  return crypto.createHash('sha256').update(buffer).digest('hex')
}

function uploadUrl(filename: string): string {
  return `/api/downloads/uploads/${filename}`
}

const CATEGORIAS_FIXAS = ['procuracao', 'identidade', 'cnh', 'comprovante_residencia']
const TIPOS_UNICOS = new Set(['procuracao', 'identidade', 'cpf', 'cnh', 'comprovante_residencia'])

const rotateSchema = z.object({ rotation: z.union([z.literal(0), z.literal(90), z.literal(180), z.literal(270)]) })
const reorderSchema = z.object({ documentIds: z.array(z.string().uuid()) })

async function verifyProcessAccess(processId: string, userId: string, res: Response) {
  const proc = await prisma.process.findFirst({
    where: { id: processId, user_id: userId, deleted_at: null },
  })
  if (!proc) { res.status(404).json({ erro: 'Processo não encontrado' }); return null }
  return proc
}

export const documentsController = {

  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) { res.status(401).json({ erro: 'Não autenticado' }); return }
      const proc = await verifyProcessAccess(req.params.id, req.user.id, res)
      if (!proc) return

      const docs = await prisma.processDocument.findMany({
        where: { process_id: req.params.id, deleted_at: null },
        select: {
          id: true, file_name: true, document_type: true, file_url: true,
          file_mime: true, file_type: true, order_index: true,
          rotation: true, requires_password: true, upload_date: true,
          ai_classified: true,
          onedrive_share_link: true, google_drive_share_link: true,
        },
        orderBy: { order_index: 'asc' },
      })
      res.json({ documents: docs })
    } catch (err) { next(err) }
  },

  async upload(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) { res.status(401).json({ erro: 'Não autenticado' }); return }
      const proc = await verifyProcessAccess(req.params.id, req.user.id, res)
      if (!proc) return

      const arquivo = req.file
      if (!arquivo) { res.status(400).json({ erro: 'Arquivo não recebido' }); return }

      let buffer = arquivo.buffer

      let mime: string
      try {
        mime = await detectMime(buffer)
      } catch (err) {
        res.status(422).json({ erro: (err as Error).message }); return
      }

      let finalBuffer = buffer
      let rotation = 0

      if (mime !== 'application/pdf') {
        finalBuffer = await sharp(buffer)
          .rotate()
          .resize({ width: 2480, height: 3508, fit: 'inside', withoutEnlargement: true })
          .jpeg({ quality: 85 })
          .toBuffer()
        mime = 'image/jpeg'
        rotation = 0
      } else {
        const encrypted = await pdfService.isPdfEncrypted(buffer)
        if (encrypted) {
          const senha = req.body.password as string | undefined
          if (!senha) {
            res.json({ requiresPassword: true }); return
          }
          ensureUploadDir()
          const tempPath = path.join(UPLOAD_DIR, `temp_${Date.now()}.pdf`)
          fs.writeFileSync(tempPath, buffer)
          try {
            const unlocked = await pdfService.unlockPdfWithQpdf(tempPath, senha)
            finalBuffer = fs.readFileSync(unlocked)
            fs.unlinkSync(tempPath)
            fs.unlinkSync(unlocked)
          } catch (err) {
            fs.existsSync(tempPath) && fs.unlinkSync(tempPath)
            const msg = (err as Error).message
            if (msg === 'WRONG_PASSWORD') {
              res.json({ requiresPassword: true, error: 'Senha incorreta' }); return
            }
            if (msg === 'QPDF_NOT_AVAILABLE') {
              console.warn('qpdf não disponível, salvando PDF criptografado')
            } else {
              res.status(500).json({ erro: 'Falha ao processar PDF' }); return
            }
          }
        }
      }

      ensureUploadDir()
      const ext = mime === 'application/pdf' ? '.pdf' : '.jpg'
      const filename = `doc_${crypto.randomUUID()}${ext}`
      const filePath = path.join(UPLOAD_DIR, filename)
      fs.writeFileSync(filePath, finalBuffer)

      const hash = sha256(finalBuffer)
      const documentType = (req.body.document_type as string | undefined) ?? 'extra'

      // Tipos únicos: verificar se já existe antes de salvar
      if (TIPOS_UNICOS.has(documentType)) {
        const existing = await prisma.processDocument.findFirst({
          where: { process_id: req.params.id, document_type: documentType as DocumentType, deleted_at: null },
        })
        if (existing) {
          res.status(409).json({
            erro: `Já existe um documento do tipo "${documentType}" neste processo. Remova o anterior antes de enviar um novo.`,
          })
          return
        }
      }

      const isFixo = CATEGORIAS_FIXAS.includes(documentType)
      let orderIndex = isFixo
        ? (['procuracao', 'identidade', 'cnh', 'comprovante_residencia'].indexOf(documentType) + 1)
        : 10

      if (!isFixo) {
        const lastVar = await prisma.processDocument.findFirst({
          where: { process_id: req.params.id, deleted_at: null, document_type: { notIn: CATEGORIAS_FIXAS as DocumentType[] } },
          orderBy: { order_index: 'desc' },
        })
        orderIndex = (lastVar?.order_index ?? 9) + 1
      }

      const doc = await prisma.processDocument.create({
        data: {
          process_id:       req.params.id,
          document_type:    documentType as DocumentType,
          file_name:        arquivo.originalname,
          file_url:         uploadUrl(filename),
          file_path:        filePath,
          file_mime:        mime,
          file_type:        mime === 'application/pdf' ? 'pdf' : 'image',
          file_size:        finalBuffer.length,
          file_hash:        hash,
          requires_password: false,
          rotation,
          order_index:      orderIndex,
          uploaded_by_role: req.user.role,
          storage_type:     'physical',
        },
      })

      await prisma.processTimeline.create({
        data: {
          process_id:  req.params.id,
          user_id:     req.user.id,
          action_type: 'documento_adicionado',
          description: `Documento adicionado: ${arquivo.originalname} (${documentType})`,
        },
      })

      // AI document classification (non-blocking, only when type not explicitly set)
      if (documentType === 'extra') {
        geminiService.classifyDocument(arquivo.originalname, mime)
          .then(async aiType => {
            if (aiType && aiType !== 'extra') {
              await prisma.processDocument.update({
                where: { id: doc.id },
                data:  { document_type: aiType as DocumentType, ai_classified: true },
              })
            }
          })
          .catch(() => null)
      }

      // Auto-sync to cloud (non-blocking)
      const storageService = new StorageService(req.user.id)
      storageService.syncDocument(proc, finalBuffer, filename, mime)
        .then(async cloudResult => {
          const data: Record<string, string> = {}
          if (cloudResult.onedrive) {
            data.onedrive_item_id = cloudResult.onedrive.itemId
            data.onedrive_share_link = cloudResult.onedrive.shareLink
          }
          if (cloudResult.googledrive) {
            data.google_drive_item_id = cloudResult.googledrive.itemId
            data.google_drive_share_link = cloudResult.googledrive.shareLink
          }
          if (Object.keys(data).length > 0) {
            await prisma.processDocument.update({ where: { id: doc.id }, data })
          }
        })
        .catch(() => null)

      res.status(201).json({
        id: doc.id,
        requiresPassword: false,
        file_url: doc.file_url,
        file_name: doc.file_name,
        document_type: doc.document_type,
        onedrive_share_link: null,
        google_drive_share_link: null,
      })
    } catch (err) { next(err) }
  },

  async sync(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) { res.status(401).json({ erro: 'Não autenticado' }); return }
      const proc = await verifyProcessAccess(req.params.id, req.user.id, res)
      if (!proc) return

      const doc = await prisma.processDocument.findFirst({
        where: { id: req.params.docId, process_id: req.params.id, deleted_at: null },
      })
      if (!doc || !doc.file_path) { res.status(404).json({ erro: 'Documento não encontrado' }); return }

      if (!fs.existsSync(doc.file_path)) {
        res.status(410).json({ erro: 'Arquivo local não encontrado para sincronização' }); return
      }

      const buffer = fs.readFileSync(doc.file_path)
      const fileName = path.basename(doc.file_path)
      const mimeType = doc.file_mime ?? 'application/octet-stream'

      const storageService = new StorageService(req.user.id)
      const cloudResult = await storageService.syncDocument(proc, buffer, fileName, mimeType)

      const data: Record<string, string> = {}
      if (cloudResult.onedrive) {
        data.onedrive_item_id = cloudResult.onedrive.itemId
        data.onedrive_share_link = cloudResult.onedrive.shareLink
      }
      if (cloudResult.googledrive) {
        data.google_drive_item_id = cloudResult.googledrive.itemId
        data.google_drive_share_link = cloudResult.googledrive.shareLink
      }

      if (Object.keys(data).length === 0) {
        res.status(400).json({ erro: 'Nenhum provedor de storage configurado ou pasta de documentos não criada' }); return
      }

      const updated = await prisma.processDocument.update({ where: { id: doc.id }, data })
      res.json({
        onedrive_share_link: updated.onedrive_share_link,
        google_drive_share_link: updated.google_drive_share_link,
      })
    } catch (err) { next(err) }
  },

  async rotate(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) { res.status(401).json({ erro: 'Não autenticado' }); return }
      const proc = await verifyProcessAccess(req.params.id, req.user.id, res)
      if (!proc) return

      const parsed = rotateSchema.safeParse(req.body)
      if (!parsed.success) { res.status(400).json({ erro: 'rotation deve ser 0, 90, 180 ou 270' }); return }

      const doc = await prisma.processDocument.findFirst({
        where: { id: req.params.docId, process_id: req.params.id, deleted_at: null },
      })
      if (!doc) { res.status(404).json({ erro: 'Documento não encontrado' }); return }

      await prisma.processDocument.update({
        where: { id: doc.id },
        data: { rotation: parsed.data.rotation },
      })
      res.json({ rotation: parsed.data.rotation })
    } catch (err) { next(err) }
  },

  async reorder(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) { res.status(401).json({ erro: 'Não autenticado' }); return }
      const proc = await verifyProcessAccess(req.params.id, req.user.id, res)
      if (!proc) return

      const parsed = reorderSchema.safeParse(req.body)
      if (!parsed.success) { res.status(400).json({ erro: 'documentIds inválido' }); return }
      const { documentIds } = parsed.data

      const docsValidos = await prisma.processDocument.findMany({
        where: {
          id: { in: documentIds },
          process_id: req.params.id,
          document_type: { notIn: CATEGORIAS_FIXAS as DocumentType[] },
          deleted_at: null,
        },
        select: { id: true },
      })
      const idsValidos = new Set(docsValidos.map(d => d.id))

      await prisma.$transaction(
        documentIds
          .filter(id => idsValidos.has(id))
          .map((id, index) =>
            prisma.processDocument.update({
              where: { id },
              data: { order_index: index + 10 },
            })
          )
      )
      res.json({ message: 'Ordem atualizada' })
    } catch (err) { next(err) }
  },

  async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) { res.status(401).json({ erro: 'Não autenticado' }); return }
      const proc = await verifyProcessAccess(req.params.id, req.user.id, res)
      if (!proc) return

      const doc = await prisma.processDocument.findFirst({
        where: { id: req.params.docId, process_id: req.params.id, deleted_at: null },
      })
      if (!doc) { res.status(404).json({ erro: 'Documento não encontrado' }); return }

      await prisma.processDocument.update({
        where: { id: doc.id },
        data: { deleted_at: new Date() },
      })
      res.status(204).send()
    } catch (err) { next(err) }
  },

  async unlock(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) { res.status(401).json({ erro: 'Não autenticado' }); return }
      const proc = await verifyProcessAccess(req.params.id, req.user.id, res)
      if (!proc) return

      const doc = await prisma.processDocument.findFirst({
        where: { id: req.params.docId, process_id: req.params.id, deleted_at: null },
      })
      if (!doc || !doc.file_path) { res.status(404).json({ erro: 'Documento não encontrado' }); return }

      const senha = req.body.password as string | undefined
      if (!senha) { res.status(400).json({ erro: 'Senha obrigatória' }); return }

      try {
        const unlockedPath = await pdfService.unlockPdfWithQpdf(doc.file_path, senha)
        const unlockedBuffer = fs.readFileSync(unlockedPath)
        fs.writeFileSync(doc.file_path, unlockedBuffer)
        fs.unlinkSync(unlockedPath)
        const hash = sha256(unlockedBuffer)

        await prisma.processDocument.update({
          where: { id: doc.id },
          data: { requires_password: false, file_hash: hash },
        })
        res.json({ message: 'PDF desbloqueado com sucesso' })
      } catch (err) {
        const msg = (err as Error).message
        if (msg === 'WRONG_PASSWORD') {
          res.status(400).json({ erro: 'Senha incorreta' }); return
        }
        if (msg === 'QPDF_NOT_AVAILABLE') {
          res.status(503).json({ erro: 'qpdf não disponível no servidor' }); return
        }
        next(err)
      }
    } catch (err) { next(err) }
  },
}
