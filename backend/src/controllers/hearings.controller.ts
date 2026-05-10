import { Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import { prisma } from '../config/database'
import { CalendarService } from '../services/CalendarService'
import type { HearingType, HearingStatus } from '@prisma/client'

const HEARING_TYPES: HearingType[] = [
  'audiencia_instrucao', 'audiencia_conciliacao', 'audiencia_julgamento',
  'reuniao_cliente', 'prazo_processual', 'diligencia', 'pericia',
]
const HEARING_STATUSES: HearingStatus[] = ['agendada', 'realizada', 'cancelada', 'adiada']

const hearingSchema = z.object({
  title:        z.string().min(1, 'Título obrigatório'),
  hearing_type: z.enum(HEARING_TYPES as [HearingType, ...HearingType[]]),
  hearing_date: z.string().min(1, 'Data obrigatória'),
  hearing_time: z.string().regex(/^\d{2}:\d{2}$/, 'Hora inválida (HH:MM)'),
  end_time:     z.string().optional(),
  location:     z.string().optional(),
  description:  z.string().optional(),
  status:       z.enum(HEARING_STATUSES as [HearingStatus, ...HearingStatus[]]).default('agendada'),
})

async function verifyProcessAccess(processId: string, userId: string, res: Response) {
  const proc = await prisma.process.findFirst({
    where: { id: processId, user_id: userId, deleted_at: null },
  })
  if (!proc) { res.status(404).json({ erro: 'Processo não encontrado' }); return null }
  return proc
}

export const hearingsController = {

  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) { res.status(401).json({ erro: 'Não autenticado' }); return }
      const proc = await verifyProcessAccess(req.params.id, req.user.id, res)
      if (!proc) return

      const hearings = await prisma.hearing.findMany({
        where: { process_id: req.params.id },
        orderBy: { hearing_date: 'asc' },
        select: {
          id: true, title: true, hearing_type: true, hearing_date: true,
          hearing_time: true, location: true, description: true, status: true,
          outlook_event_id: true, google_event_id: true, teams_meeting_url: true,
          reminder_d3_sent: true, reminder_d2_sent: true, reminder_d1_sent: true,
          created_at: true,
        },
      })
      res.json({ hearings })
    } catch (err) { next(err) }
  },

  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) { res.status(401).json({ erro: 'Não autenticado' }); return }
      const proc = await verifyProcessAccess(req.params.id, req.user.id, res)
      if (!proc) return

      const parsed = hearingSchema.safeParse(req.body)
      if (!parsed.success) { res.status(400).json({ erro: parsed.error.errors[0]?.message }); return }
      const data = parsed.data

      const hearing = await prisma.hearing.create({
        data: {
          process_id:   req.params.id,
          user_id:      req.user.id,
          title:        data.title,
          hearing_type: data.hearing_type,
          hearing_date: new Date(data.hearing_date),
          hearing_time: data.hearing_time,
          location:     data.location,
          description:  data.description,
          status:       data.status,
        },
      })

      // Sync to calendar (best-effort)
      const calSvc = new CalendarService(req.user.id)
      const calResult = await calSvc.createEvent({
        title:       `${data.title} — ${proc.case_title}`,
        date:        data.hearing_date,
        time:        data.hearing_time,
        endTime:     data.end_time,
        location:    data.location,
        description: data.description,
      })

      if (calResult.outlook_event_id || calResult.google_event_id) {
        await prisma.hearing.update({
          where: { id: hearing.id },
          data:  calResult,
        })
      }

      await prisma.processTimeline.create({
        data: {
          process_id:  req.params.id,
          user_id:     req.user.id,
          action_type: 'audiencia_agendada',
          description: `Audiência agendada: ${data.title} — ${new Date(data.hearing_date).toLocaleDateString('pt-BR')} às ${data.hearing_time}`,
        },
      })

      res.status(201).json({ ...hearing, ...calResult })
    } catch (err) { next(err) }
  },

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) { res.status(401).json({ erro: 'Não autenticado' }); return }
      const proc = await verifyProcessAccess(req.params.id, req.user.id, res)
      if (!proc) return

      const existing = await prisma.hearing.findFirst({
        where: { id: req.params.hearingId, process_id: req.params.id },
      })
      if (!existing) { res.status(404).json({ erro: 'Audiência não encontrada' }); return }

      const parsed = hearingSchema.partial().safeParse(req.body)
      if (!parsed.success) { res.status(400).json({ erro: parsed.error.errors[0]?.message }); return }
      const data = parsed.data

      const updated = await prisma.hearing.update({
        where: { id: req.params.hearingId },
        data: {
          ...(data.title        ? { title: data.title }                        : {}),
          ...(data.hearing_type ? { hearing_type: data.hearing_type }          : {}),
          ...(data.hearing_date ? { hearing_date: new Date(data.hearing_date) } : {}),
          ...(data.hearing_time ? { hearing_time: data.hearing_time }          : {}),
          ...(data.location     !== undefined ? { location: data.location }    : {}),
          ...(data.description  !== undefined ? { description: data.description } : {}),
          ...(data.status       ? { status: data.status }                      : {}),
        },
      })

      // Update calendar events (best-effort, fire-and-forget)
      if (data.hearing_date || data.hearing_time || data.title) {
        const calSvc = new CalendarService(req.user.id)
        calSvc.updateEvent(
          { outlook_event_id: existing.outlook_event_id, google_event_id: existing.google_event_id },
          {
            title:       (data.title ?? existing.title) + ` — ${proc.case_title}`,
            date:        data.hearing_date ?? existing.hearing_date.toISOString().slice(0, 10),
            time:        data.hearing_time ?? existing.hearing_time,
            location:    data.location ?? existing.location ?? undefined,
            description: data.description ?? existing.description ?? undefined,
          },
        ).catch(() => null)
      }

      res.json(updated)
    } catch (err) { next(err) }
  },

  async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) { res.status(401).json({ erro: 'Não autenticado' }); return }
      const proc = await verifyProcessAccess(req.params.id, req.user.id, res)
      if (!proc) return

      const hearing = await prisma.hearing.findFirst({
        where: { id: req.params.hearingId, process_id: req.params.id },
      })
      if (!hearing) { res.status(404).json({ erro: 'Audiência não encontrada' }); return }

      await prisma.hearing.delete({ where: { id: hearing.id } })

      new CalendarService(req.user.id).deleteEvent({
        outlook_event_id: hearing.outlook_event_id,
        google_event_id:  hearing.google_event_id,
      }).catch(() => null)

      res.status(204).send()
    } catch (err) { next(err) }
  },
}
