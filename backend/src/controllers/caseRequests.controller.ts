import { Request, Response, NextFunction } from 'express'
import { prisma } from '../config/database'

export const caseRequestsController = {
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) { res.status(401).json({ erro: 'Não autenticado' }); return }

      const requests = await prisma.caseRequest.findMany({
        where: {
          status: req.query.status as string | undefined ?? 'pendente',
          client: { user_id: req.user.id },
        },
        include: { client: { select: { id: true, full_name: true, email: true, phone: true } } },
        orderBy: { created_at: 'desc' },
      })
      res.json({ requests })
    } catch (err) { next(err) }
  },

  async convert(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) { res.status(401).json({ erro: 'Não autenticado' }); return }

      const caseReq = await prisma.caseRequest.findFirst({
        where: { id: req.params.id, client: { user_id: req.user.id } },
        include: { client: true },
      })
      if (!caseReq) { res.status(404).json({ erro: 'Solicitação não encontrada' }); return }
      if (caseReq.status !== 'pendente') { res.status(409).json({ erro: 'Solicitação já processada' }); return }

      const process = await prisma.process.create({
        data: {
          user_id: req.user.id,
          client_id: caseReq.client_id,
          case_title: `${caseReq.area ? `[${caseReq.area}] ` : ''}Caso de ${caseReq.client.full_name}`,
          case_description: caseReq.description,
          process_type: 'outro',
          status: 'aberto',
        },
      })

      await prisma.caseRequest.update({
        where: { id: caseReq.id },
        data: { status: 'convertido', process_id: process.id },
      })

      res.json({ mensagem: 'Solicitação convertida em processo', process_id: process.id })
    } catch (err) { next(err) }
  },

  async reject(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) { res.status(401).json({ erro: 'Não autenticado' }); return }

      const caseReq = await prisma.caseRequest.findFirst({
        where: { id: req.params.id, client: { user_id: req.user.id } },
      })
      if (!caseReq) { res.status(404).json({ erro: 'Solicitação não encontrada' }); return }

      await prisma.caseRequest.update({ where: { id: caseReq.id }, data: { status: 'recusado' } })
      res.json({ mensagem: 'Solicitação recusada' })
    } catch (err) { next(err) }
  },
}
