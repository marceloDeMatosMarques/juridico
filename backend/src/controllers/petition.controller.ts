import { Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import { prisma } from '../config/database'
import { pdfService } from '../services/PDFService'

const videoLinkSchema = z.object({
  title: z.string().min(1),
  url: z.string().url(),
  description: z.string().optional(),
})

const petitionSchema = z.object({
  type: z.enum(['requerimento', 'processo']),
  htmlContent: z.string().optional(),
  videoLinks: z.array(videoLinkSchema).optional(),
  documentIds: z.array(z.string().uuid()).optional(),
})

async function verifyProcessAccess(processId: string, userId: string, res: Response) {
  const proc = await prisma.process.findFirst({
    where: { id: processId, user_id: userId, deleted_at: null },
    include: { client: { select: { full_name: true, cpf: true } } },
  })
  if (!proc) { res.status(404).json({ erro: 'Processo não encontrado' }); return null }
  return proc
}

export const petitionController = {

  async preview(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) { res.status(401).json({ erro: 'Não autenticado' }); return }
      const proc = await verifyProcessAccess(req.params.id, req.user.id, res)
      if (!proc) return
      res.json({ case_description: proc.case_description ?? '' })
    } catch (err) { next(err) }
  },

  async saveSummary(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) { res.status(401).json({ erro: 'Não autenticado' }); return }
      const proc = await prisma.process.findFirst({
        where: { id: req.params.id, user_id: req.user.id, deleted_at: null },
      })
      if (!proc) { res.status(404).json({ erro: 'Processo não encontrado' }); return }

      const { case_description } = req.body as { case_description?: string }
      await prisma.process.update({
        where: { id: req.params.id },
        data: { case_description: case_description ?? '' },
      })
      res.json({ message: 'Resumo salvo' })
    } catch (err) { next(err) }
  },

  async generate(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) { res.status(401).json({ erro: 'Não autenticado' }); return }
      const proc = await verifyProcessAccess(req.params.id, req.user.id, res)
      if (!proc) return

      const parsed = petitionSchema.safeParse(req.body)
      if (!parsed.success) {
        res.status(400).json({ erro: parsed.error.errors[0]?.message }); return
      }
      const { type, htmlContent, videoLinks, documentIds } = parsed.data

      const user = await prisma.user.findUnique({
        where: { id: req.user.id },
        include: { settings: true },
      })
      if (!user) { res.status(404).json({ erro: 'Usuário não encontrado' }); return }

      if (type === 'requerimento') {
        const result = await pdfService.generateRequerimento({
          process: proc,
          user,
          htmlContent: htmlContent ?? '',
          videoLinks: videoLinks ?? [],
        })
        res.json({ downloadUrl: result.downloadUrl })

      } else {
        const result = await pdfService.generateProcessoPDF({
          processId: proc.id,
          documentIdsOrdem: documentIds ?? [],
          userId: req.user.id,
        })

        await prisma.process.update({
          where: { id: proc.id },
          data: { summary_pdf_url: result.downloadUrl },
        })

        await prisma.processTimeline.create({
          data: {
            process_id:  proc.id,
            user_id:     req.user.id,
            action_type: 'processo_pdf_gerado',
            description: `PDF do processo gerado (${result.pageCount} páginas)`,
          },
        })

        res.json({ downloadUrl: result.downloadUrl, pageCount: result.pageCount })
      }
    } catch (err) { next(err) }
  },
}
