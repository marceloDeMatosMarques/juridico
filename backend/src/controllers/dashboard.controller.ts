import { Request, Response, NextFunction } from 'express'
import { prisma } from '../config/database'

export const dashboardController = {
  async getSummary(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) { res.status(401).json({ erro: 'Não autenticado' }); return }
      const userId = req.user.id
      const now    = new Date()

      // Week boundaries for hearings
      const weekStart = new Date(now); weekStart.setHours(0, 0, 0, 0)
      const weekEnd   = new Date(weekStart); weekEnd.setDate(weekStart.getDate() + 7)

      // 6-month window for revenue
      const sixMonthsAgo = new Date(now)
      sixMonthsAgo.setMonth(now.getMonth() - 5)
      sixMonthsAgo.setDate(1); sixMonthsAgo.setHours(0, 0, 0, 0)

      const [
        totalProcesses,
        activeProcesses,
        hearingsThisWeek,
        urgentNotifications,
        processGroups,
        upcomingHearings,
        pendingRecords,
        recentProcesses,
        overdueDeadlines,
        overdueInstallments,
        urgentNotifList,
        paidRecords,
      ] = await Promise.all([
        prisma.process.count({ where: { user_id: userId, deleted_at: null } }),

        prisma.process.count({
          where: { user_id: userId, deleted_at: null, status: { in: ['aberto', 'em_andamento', 'aguardando_audiencia'] } },
        }),

        prisma.hearing.count({
          where: { user_id: userId, status: 'agendada', hearing_date: { gte: weekStart, lte: weekEnd } },
        }),

        prisma.courtNotification.count({
          where: { user_id: userId, is_urgent: true, read_at: null },
        }),

        prisma.process.groupBy({
          by: ['status'],
          where: { user_id: userId, deleted_at: null },
          _count: { id: true },
        }),

        prisma.hearing.findMany({
          where: { user_id: userId, status: 'agendada', hearing_date: { gte: weekStart, lte: weekEnd } },
          include: { process: { select: { case_title: true } } },
          orderBy: [{ hearing_date: 'asc' }, { hearing_time: 'asc' }],
          take: 30,
        }),

        prisma.financialRecord.aggregate({
          where: {
            user_id: userId,
            payment_status: { in: ['pendente', 'parcial', 'atrasado'] },
          },
          _sum: { total_value: true },
        }),

        prisma.process.findMany({
          where:   { user_id: userId, deleted_at: null },
          include: { client: { select: { full_name: true } } },
          orderBy: { updated_at: 'desc' },
          take: 5,
        }),

        prisma.process.findMany({
          where: {
            user_id: userId, deleted_at: null,
            status: { in: ['aberto', 'em_andamento'] },
            pending_deadline: { lt: now },
          },
          select: { id: true, case_title: true, pending_deadline: true },
          orderBy: { pending_deadline: 'asc' },
          take: 5,
        }),

        prisma.financialRecord.findMany({
          where: {
            user_id: userId,
            payment_status: { in: ['pendente', 'parcial'] },
            due_date: { lt: now },
          },
          include: { process: { select: { case_title: true } } },
          orderBy: { due_date: 'asc' },
          take: 5,
        }),

        prisma.courtNotification.findMany({
          where:   { user_id: userId, is_urgent: true, read_at: null },
          include: { process: { select: { case_title: true } } },
          orderBy: { received_at: 'desc' },
          take: 5,
        }),

        prisma.financialRecord.findMany({
          where: {
            user_id: userId,
            payment_status: 'pago',
            paid_date: { gte: sixMonthsAgo },
          },
          select: { total_value: true, paid_date: true },
        }),
      ])

      // Build revenue by month (last 6 months)
      const revenueMap: Record<string, number> = {}
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now)
        d.setMonth(now.getMonth() - i)
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
        revenueMap[key] = 0
      }
      for (const r of paidRecords) {
        if (!r.paid_date) continue
        const key = `${r.paid_date.getFullYear()}-${String(r.paid_date.getMonth() + 1).padStart(2, '0')}`
        if (key in revenueMap) revenueMap[key] = (revenueMap[key] ?? 0) + Number(r.total_value)
      }
      const revenueByMonth = Object.entries(revenueMap).map(([month, total]) => ({ month, total }))

      res.json({
        cards: {
          total_processes:      totalProcesses,
          active_processes:     activeProcesses,
          hearings_this_week:   hearingsThisWeek,
          honorarios_pendentes: Number(pendingRecords._sum.total_value ?? 0),
          urgent_notifications: urgentNotifications,
        },
        upcoming_hearings:  upcomingHearings.map(h => ({
          id:           h.id,
          title:        h.title,
          hearing_date: h.hearing_date,
          hearing_time: h.hearing_time,
          hearing_type: h.hearing_type,
          case_title:   h.process.case_title,
        })),
        processes_by_status: processGroups.map(g => ({ status: g.status, count: g._count.id })),
        revenue_by_month:    revenueByMonth,
        alerts: {
          overdue_deadlines:    overdueDeadlines,
          overdue_installments: overdueInstallments,
          urgent_notifications: urgentNotifList,
        },
        recent_processes: recentProcesses,
      })
    } catch (err) { next(err) }
  },
}
