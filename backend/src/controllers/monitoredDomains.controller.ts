import { Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import { prisma } from '../config/database'

const domainSchema = z.object({
  court_name:   z.string().min(1),
  email_domain: z.string().min(3),
  court_system: z.enum(['pje', 'eproc', 'projudi', 'saj', 'esaj', 'manual']),
  state:        z.string().length(2).transform(s => s.toUpperCase()),
})

export const monitoredDomainsController = {
  async list(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) { res.status(401).json({ erro: 'Não autenticado' }); return }
      const domains = await prisma.monitoredCourtDomain.findMany({
        where:   { user_id: req.user.id },
        orderBy: { created_at: 'desc' },
      })
      res.json({ domains })
    } catch (err) { next(err) }
  },

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) { res.status(401).json({ erro: 'Não autenticado' }); return }
      const data = domainSchema.parse(req.body)
      const domain = await prisma.monitoredCourtDomain.create({
        data: { ...data, user_id: req.user.id },
      })
      res.status(201).json(domain)
    } catch (err) { next(err) }
  },

  async toggle(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) { res.status(401).json({ erro: 'Não autenticado' }); return }
      const { id } = req.params
      const existing = await prisma.monitoredCourtDomain.findFirst({
        where: { id, user_id: req.user.id },
      })
      if (!existing) { res.status(404).json({ erro: 'Não encontrado' }); return }
      const updated = await prisma.monitoredCourtDomain.update({
        where: { id },
        data:  { active: !existing.active },
      })
      res.json(updated)
    } catch (err) { next(err) }
  },

  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) { res.status(401).json({ erro: 'Não autenticado' }); return }
      const { id } = req.params
      await prisma.monitoredCourtDomain.deleteMany({ where: { id, user_id: req.user.id } })
      res.json({ ok: true })
    } catch (err) { next(err) }
  },

  async saveSettings(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) { res.status(401).json({ erro: 'Não autenticado' }); return }
      const { auto_monitor_court_emails } = req.body
      await prisma.settings.upsert({
        where:  { user_id: req.user.id },
        update: { auto_monitor_court_emails: Boolean(auto_monitor_court_emails) },
        create: { user_id: req.user.id, auto_monitor_court_emails: Boolean(auto_monitor_court_emails) },
      })
      res.json({ ok: true })
    } catch (err) { next(err) }
  },
}
