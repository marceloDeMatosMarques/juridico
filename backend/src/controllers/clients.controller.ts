import { Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import { prisma } from '../config/database'
import { validarCPF, sanitizarCPF } from '../utils/cpf'
import { sanitizarWhatsApp, sanitizarTelefone } from '../utils/validators'
import { pdfService } from '../services/PDFService'
import { createError } from '../middleware/errorHandler'

const clienteSchema = z.object({
  full_name:      z.string().min(2, 'Nome obrigatório'),
  cpf:            z.string().optional().transform(v => v ? sanitizarCPF(v) : undefined),
  rg:             z.string().optional(),
  birth_date:     z.string().optional().transform(v => v ? new Date(v) : undefined),
  email:          z.string().email('E-mail inválido').optional().or(z.literal('')).transform(v => v || undefined),
  phone:          z.string().optional().transform(v => v ? sanitizarTelefone(v) : undefined),
  whatsapp:       z.string().optional().transform(v => v ? sanitizarWhatsApp(v) : undefined),
  address:        z.string().optional(),
  address_number: z.string().optional(),
  complement:     z.string().optional(),
  neighborhood:   z.string().optional(),
  city:           z.string().optional(),
  state:          z.string().optional(),
  zip_code:       z.string().optional().transform(v => v ? v.replace(/\D/g, '') : undefined),
  notes:          z.string().optional(),
  gender:         z.enum(['M', 'F', 'NB', 'outro']).optional(),
  social_name:    z.string().optional(),
  marital_status: z.enum(['solteiro', 'casado', 'divorciado', 'viuvo', 'uniao_estavel']).optional(),
  nationality:    z.string().optional(),
  profession:     z.string().optional(),
})

const CAMPOS_UNICOS = ['cpf', 'rg', 'email', 'whatsapp'] as const

async function verificarUnicidade(
  userId: string,
  data: Record<string, string | undefined>,
  excludeId?: string
) {
  for (const campo of CAMPOS_UNICOS) {
    const valor = data[campo]
    if (!valor) continue
    const existente = await prisma.client.findFirst({
      where: {
        user_id: userId,
        [campo]: valor,
        deleted_at: null,
        ...(excludeId ? { NOT: { id: excludeId } } : {}),
      },
      select: { id: true },
    })
    if (existente) return { campo, clientId: existente.id }
  }
  return null
}

export const clientsController = {
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) { res.status(401).json({ erro: 'Não autenticado' }); return }

      const page = Math.max(1, parseInt(req.query.page as string) || 1)
      const limit = Math.min(100, parseInt(req.query.limit as string) || 20)
      const busca = (req.query.busca as string) || ''
      const status = req.query.status as string | undefined

      const where = {
        user_id: req.user.id,
        deleted_at: null,
        ...(status ? { status: status as 'ativo' | 'inativo' } : {}),
        ...(busca
          ? {
              OR: [
                { full_name: { contains: busca } },
                { cpf:       { contains: busca.replace(/\D/g, '') } },
                { email:     { contains: busca } },
              ],
            }
          : {}),
      }

      const [total, clientes] = await prisma.$transaction([
        prisma.client.count({ where }),
        prisma.client.findMany({
          where,
          orderBy: { full_name: 'asc' },
          skip: (page - 1) * limit,
          take: limit,
          include: { _count: { select: { processes: { where: { deleted_at: null } } } } },
        }),
      ])

      res.json({ data: clientes, total, page, limit, pages: Math.ceil(total / limit) })
    } catch (err) { next(err) }
  },

  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) { res.status(401).json({ erro: 'Não autenticado' }); return }

      const parsed = clienteSchema.safeParse(req.body)
      if (!parsed.success) {
        res.status(400).json({ erro: parsed.error.errors[0]?.message }); return
      }
      const data = parsed.data

      if (data.cpf && !validarCPF(data.cpf)) {
        res.status(422).json({ erro: 'CPF inválido' }); return
      }

      const dup = await verificarUnicidade(req.user.id, {
        cpf: data.cpf, rg: data.rg, email: data.email, whatsapp: data.whatsapp,
      })
      if (dup) {
        res.status(409).json({ erro: `${dup.campo.toUpperCase()} já cadastrado neste escritório`, client_id: dup.clientId }); return
      }

      const cliente = await prisma.client.create({
        data: { ...data, user_id: req.user.id },
      })

      console.log(JSON.stringify({ level: 'info', action: 'cliente_criado', data: { id: cliente.id, userId: req.user.id } }))
      res.status(201).json(cliente)
    } catch (err) { next(err) }
  },

  async getOne(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) { res.status(401).json({ erro: 'Não autenticado' }); return }

      const cliente = await prisma.client.findFirst({
        where: { id: req.params.id, user_id: req.user.id, deleted_at: null },
        include: {
          processes: {
            where: { deleted_at: null, user_id: req.user.id },
            orderBy: { created_at: 'desc' },
            include: {
              documents: {
                where: { deleted_at: null },
                select: { id: true, document_type: true, file_name: true, upload_date: true },
                orderBy: { order_index: 'asc' },
              },
            },
          },
          intake_tokens: {
            where: { expires_at: { gte: new Date() }, used_at: null },
            orderBy: { created_at: 'desc' },
            take: 5,
          },
        },
      })

      if (!cliente) { res.status(404).json({ erro: 'Cliente não encontrado' }); return }
      res.json(cliente)
    } catch (err) { next(err) }
  },

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) { res.status(401).json({ erro: 'Não autenticado' }); return }

      const parsed = clienteSchema.partial().safeParse(req.body)
      if (!parsed.success) {
        res.status(400).json({ erro: parsed.error.errors[0]?.message }); return
      }
      const data = parsed.data

      if (data.cpf && !validarCPF(data.cpf)) {
        res.status(422).json({ erro: 'CPF inválido' }); return
      }

      const existente = await prisma.client.findFirst({
        where: { id: req.params.id, user_id: req.user.id, deleted_at: null },
      })
      if (!existente) { res.status(404).json({ erro: 'Cliente não encontrado' }); return }

      const dup = await verificarUnicidade(
        req.user.id,
        { cpf: data.cpf, rg: data.rg, email: data.email, whatsapp: data.whatsapp },
        req.params.id
      )
      if (dup) {
        res.status(409).json({ erro: `${dup.campo.toUpperCase()} já cadastrado neste escritório`, client_id: dup.clientId }); return
      }

      const atualizado = await prisma.client.update({
        where: { id: req.params.id },
        data,
      })
      res.json(atualizado)
    } catch (err) { next(err) }
  },

  async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) { res.status(401).json({ erro: 'Não autenticado' }); return }

      const existente = await prisma.client.findFirst({
        where: { id: req.params.id, user_id: req.user.id, deleted_at: null },
      })
      if (!existente) { res.status(404).json({ erro: 'Cliente não encontrado' }); return }

      await prisma.client.update({
        where: { id: req.params.id },
        data: { deleted_at: new Date(), status: 'inativo' },
      })
      res.status(204).end()
    } catch (err) { next(err) }
  },

  async checkProcuracao(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) { res.status(401).json({ erro: 'Não autenticado' }); return }

      const cliente = await prisma.client.findFirst({
        where: { id: req.params.id, user_id: req.user.id, deleted_at: null },
      })
      if (!cliente) { res.status(404).json({ erro: 'Cliente não encontrado' }); return }

      const obrigatorios: Record<string, boolean> = {
        full_name: !!cliente.full_name,
        cpf:       !!cliente.cpf && validarCPF(cliente.cpf),
        rg_ou_cnh: !!cliente.rg,
        address:   !!cliente.address,
        city:      !!cliente.city,
        state:     !!cliente.state,
        zip_code:  !!cliente.zip_code,
      }
      const recomendados: Record<string, boolean> = {
        gender:         !!cliente.gender,
        profession:     !!cliente.profession,
        marital_status: !!cliente.marital_status,
        social_name:    !!cliente.social_name,
      }
      const pronto = Object.values(obrigatorios).every(Boolean)
      res.json({ pronto, obrigatorios, recomendados })
    } catch (err) { next(err) }
  },

  async generateProcuracao(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) { res.status(401).json({ erro: 'Não autenticado' }); return }

      const cliente = await prisma.client.findFirst({
        where: { id: req.params.id, user_id: req.user.id, deleted_at: null },
      })
      if (!cliente) { res.status(404).json({ erro: 'Cliente não encontrado' }); return }

      const faltando: string[] = []
      if (!cliente.full_name) faltando.push('full_name')
      if (!cliente.cpf || !validarCPF(cliente.cpf)) faltando.push('cpf')
      if (!cliente.rg) faltando.push('rg ou cnh')
      if (!cliente.address) faltando.push('address')
      if (!cliente.city) faltando.push('city')
      if (!cliente.state) faltando.push('state')
      if (!cliente.zip_code) faltando.push('zip_code')

      if (faltando.length > 0) {
        res.status(422).json({ erro: 'Campos obrigatórios ausentes para gerar procuração', campos: faltando }); return
      }

      const user = await prisma.user.findUnique({ where: { id: req.user.id }, include: { settings: true } })
      if (!user) throw createError('Usuário não encontrado', 404)

      const resultado = await pdfService.generateProcuracao(cliente, user)
      res.json({ downloadUrl: resultado.downloadUrl, fileHash: resultado.fileHash })
    } catch (err) { next(err) }
  },
}
