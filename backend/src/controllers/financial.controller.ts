import { Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import { prisma } from '../config/database'

const createSchema = z.object({
  description:        z.string().min(1),
  record_type:        z.enum(['honorario', 'despesa', 'reembolso', 'honorario_exito']),
  total_value:        z.number().positive(),
  cause_value:        z.number().positive().optional(),
  percentage:         z.number().min(0).max(100).optional(),
  payment_type:       z.enum(['unico', 'parcelado']).default('unico'),
  installments_total: z.number().int().min(1).max(120).default(1),
  due_date:           z.string().optional(),
  notes:              z.string().optional(),
})

const updateSchema = createSchema.partial().extend({
  payment_status: z.enum(['pendente', 'parcial', 'pago', 'cancelado', 'atrasado']).optional(),
})

export const financialController = {
  async list(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) { res.status(401).json({ erro: 'Não autenticado' }); return }
      const records = await prisma.financialRecord.findMany({
        where:   { process_id: req.params.id, user_id: req.user.id },
        include: { installments: { orderBy: { installment_number: 'asc' } } },
        orderBy: { created_at: 'desc' },
      })
      res.json({ records })
    } catch (err) { next(err) }
  },

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) { res.status(401).json({ erro: 'Não autenticado' }); return }
      const data = createSchema.parse(req.body)

      const calculated_fee =
        data.record_type === 'honorario' && data.cause_value && data.percentage
          ? data.cause_value * (data.percentage / 100)
          : null

      const record = await prisma.financialRecord.create({
        data: {
          process_id:         req.params.id,
          user_id:            req.user.id,
          description:        data.description,
          record_type:        data.record_type,
          total_value:        data.total_value,
          cause_value:        data.cause_value ?? null,
          percentage:         data.percentage ?? 30,
          calculated_fee,
          payment_type:       data.payment_type,
          installments_total: data.installments_total,
          due_date:           data.due_date ? new Date(data.due_date) : null,
          notes:              data.notes ?? null,
        },
      })

      if (data.payment_type === 'parcelado' && data.installments_total > 1) {
        const perInstallment = data.total_value / data.installments_total
        const baseDate = data.due_date ? new Date(data.due_date) : new Date()
        await prisma.installment.createMany({
          data: Array.from({ length: data.installments_total }, (_, i) => {
            const due = new Date(baseDate)
            due.setMonth(due.getMonth() + i)
            return {
              financial_record_id: record.id,
              installment_number:  i + 1,
              value:               perInstallment,
              due_date:            due,
            }
          }),
        })
      }

      const full = await prisma.financialRecord.findUnique({
        where:   { id: record.id },
        include: { installments: { orderBy: { installment_number: 'asc' } } },
      })
      res.status(201).json(full)
    } catch (err) { next(err) }
  },

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) { res.status(401).json({ erro: 'Não autenticado' }); return }
      const data = updateSchema.parse(req.body)
      const count = await prisma.financialRecord.updateMany({
        where: { id: req.params.recordId, user_id: req.user.id },
        data:  {
          ...data,
          cause_value: data.cause_value ?? undefined,
          due_date:    data.due_date ? new Date(data.due_date) : undefined,
        },
      })
      if (count.count === 0) { res.status(404).json({ erro: 'Não encontrado' }); return }
      const updated = await prisma.financialRecord.findUnique({
        where:   { id: req.params.recordId },
        include: { installments: { orderBy: { installment_number: 'asc' } } },
      })
      res.json(updated)
    } catch (err) { next(err) }
  },

  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) { res.status(401).json({ erro: 'Não autenticado' }); return }
      // Must delete installments first due to FK constraint
      const record = await prisma.financialRecord.findFirst({
        where: { id: req.params.recordId, user_id: req.user.id },
      })
      if (!record) { res.status(404).json({ erro: 'Não encontrado' }); return }
      await prisma.installment.deleteMany({ where: { financial_record_id: record.id } })
      await prisma.financialRecord.delete({ where: { id: record.id } })
      res.json({ ok: true })
    } catch (err) { next(err) }
  },

  async payInstallment(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) { res.status(401).json({ erro: 'Não autenticado' }); return }
      const { recordId, installmentId } = req.params
      const { payment_method } = req.body

      const installment = await prisma.installment.findFirst({
        where:   { id: installmentId, financial_record_id: recordId },
        include: { financial_record: true },
      })
      if (!installment || installment.financial_record.user_id !== req.user.id) {
        res.status(404).json({ erro: 'Não encontrado' }); return
      }

      await prisma.installment.update({
        where: { id: installmentId },
        data:  { status: 'pago', paid_date: new Date(), payment_method: payment_method ?? null },
      })

      const paidCount = await prisma.installment.count({
        where: { financial_record_id: recordId, status: 'pago' },
      })
      const total     = installment.financial_record.installments_total
      const newStatus = paidCount >= total ? 'pago' : 'parcial'

      await prisma.financialRecord.update({
        where: { id: recordId },
        data:  {
          installments_paid: paidCount,
          payment_status:    newStatus,
          paid_date:         newStatus === 'pago' ? new Date() : null,
        },
      })

      const updated = await prisma.financialRecord.findUnique({
        where:   { id: recordId },
        include: { installments: { orderBy: { installment_number: 'asc' } } },
      })
      res.json(updated)
    } catch (err) { next(err) }
  },

  async dashboard(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) { res.status(401).json({ erro: 'Não autenticado' }); return }
      const today        = new Date()
      const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1)

      const records = await prisma.financialRecord.findMany({
        where:   { user_id: req.user.id },
        include: {
          process:      { select: { id: true, case_title: true, process_number: true } },
          installments: { orderBy: { installment_number: 'asc' } },
        },
        orderBy: { created_at: 'desc' },
        take: 300,
      })

      const totalPendente = records
        .filter(r => r.payment_status === 'pendente' || r.payment_status === 'parcial' || r.payment_status === 'atrasado')
        .reduce((s, r) => s + Number(r.total_value), 0)

      const totalPagoMes = records
        .filter(r => r.payment_status === 'pago' && r.paid_date && new Date(r.paid_date) >= startOfMonth)
        .reduce((s, r) => s + Number(r.total_value), 0)

      const totalGeral = records.reduce((s, r) => s + Number(r.total_value), 0)

      const overdueCount = records.filter(
        r => (r.payment_status === 'pendente' || r.payment_status === 'parcial') &&
             r.due_date && new Date(r.due_date) < today
      ).length

      res.json({ records, totalPendente, totalPagoMes, totalGeral, overdueCount })
    } catch (err) { next(err) }
  },
}
