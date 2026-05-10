import { Request, Response, NextFunction } from 'express'
import { prisma } from '../config/database'

export const courtNotificationsController = {
  async list(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) { res.status(401).json({ erro: 'Não autenticado' }); return }
      const notifications = await prisma.courtNotification.findMany({
        where: { user_id: req.user.id },
        include: {
          process: { select: { id: true, case_title: true, process_number: true } },
        },
        orderBy: { received_at: 'desc' },
        take: 100,
      })
      res.json({ notifications })
    } catch (err) { next(err) }
  },

  async byProcess(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) { res.status(401).json({ erro: 'Não autenticado' }); return }
      const { processId } = req.params
      const notifications = await prisma.courtNotification.findMany({
        where:   { user_id: req.user.id, process_id: processId },
        orderBy: { received_at: 'desc' },
      })
      res.json({ notifications })
    } catch (err) { next(err) }
  },

  async unreadCount(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) { res.status(401).json({ erro: 'Não autenticado' }); return }
      const count = await prisma.courtNotification.count({
        where: { user_id: req.user.id, read_at: null },
      })
      res.json({ count })
    } catch (err) { next(err) }
  },

  async markRead(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) { res.status(401).json({ erro: 'Não autenticado' }); return }
      const { id } = req.params
      await prisma.courtNotification.updateMany({
        where: { id, user_id: req.user.id },
        data:  { read_at: new Date() },
      })
      res.json({ ok: true })
    } catch (err) { next(err) }
  },

  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) { res.status(401).json({ erro: 'Não autenticado' }); return }
      const { id } = req.params
      await prisma.courtNotification.deleteMany({
        where: { id, user_id: req.user.id },
      })
      res.json({ ok: true })
    } catch (err) { next(err) }
  },
}
