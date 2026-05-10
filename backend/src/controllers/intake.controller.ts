import { Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import { v4 as uuidv4 } from 'uuid'
import path from 'path'
import fs from 'fs'
import crypto from 'crypto'
import { prisma } from '../config/database'
import { validarCPF, sanitizarCPF } from '../utils/cpf'
import { sanitizarWhatsApp, sanitizarTelefone } from '../utils/validators'
import { pdfService } from '../services/PDFService'
import { geminiService } from '../services/GeminiService'
const UPLOAD_DIR = path.join(process.env.UPLOAD_TEMP_DIR ?? '/tmp/juriscontrol', 'uploads')

function ensureUploadDir() {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true })
}

function sha256(buffer: Buffer): string {
  return crypto.createHash('sha256').update(buffer).digest('hex')
}

// ── schemas de validação ──────────────────────────────────────────────────────

const generateTokenSchema = z.object({
  client_id:  z.string().uuid(),
  process_id: z.string().uuid().optional(),
})

const generateTokenNewSchema = z.object({
  name:       z.string().min(2),
  whatsapp:   z.string().optional().transform(v => v ? sanitizarWhatsApp(v) : undefined),
  phone:      z.string().optional().transform(v => v ? sanitizarTelefone(v) : undefined),
  case_title: z.string().optional(),
})

const submitSchema = z.object({
  full_name:      z.string().min(2),
  cpf:            z.string().transform(sanitizarCPF),
  rg:             z.string().optional(),
  birth_date:     z.string().optional().transform(v => v ? new Date(v) : undefined),
  email:          z.string().email().optional().or(z.literal('')).transform(v => v || undefined),
  phone:          z.string().optional().transform(v => v ? sanitizarTelefone(v) : undefined),
  whatsapp:       z.string().optional().transform(v => v ? sanitizarWhatsApp(v) : undefined),
  address:        z.string().optional(),
  address_number: z.string().optional(),
  complement:     z.string().optional(),
  neighborhood:   z.string().optional(),
  city:           z.string().optional(),
  state:          z.string().optional(),
  zip_code:       z.string().optional().transform(v => v ? v.replace(/\D/g, '') : undefined),
  gender:         z.enum(['M', 'F', 'NB', 'outro']).optional(),
  social_name:    z.string().optional(),
  marital_status: z.enum(['solteiro', 'casado', 'divorciado', 'viuvo', 'uniao_estavel']).optional(),
  nationality:    z.string().optional(),
  profession:     z.string().optional(),
  case_description: z.string().optional(),
  lgpd_consent:   z.boolean().refine(v => v === true, 'Consentimento LGPD obrigatório'),
})

// ── helpers ───────────────────────────────────────────────────────────────────

async function getTokenOrFail(token: string, res: Response) {
  const intakeToken = await prisma.intakeToken.findUnique({ where: { token } })
  if (!intakeToken) {
    res.status(404).json({ erro: 'Link de intake não encontrado' })
    return null
  }
  if (intakeToken.used_at) {
    res.status(410).json({ erro: 'Este link já foi utilizado' })
    return null
  }
  if (intakeToken.expires_at < new Date()) {
    res.status(410).json({ erro: 'Este link expirou' })
    return null
  }
  return intakeToken
}

// ── controller ────────────────────────────────────────────────────────────────

export const intakeController = {
  async generateToken(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) { res.status(401).json({ erro: 'Não autenticado' }); return }

      const parsed = generateTokenSchema.safeParse(req.body)
      if (!parsed.success) {
        res.status(400).json({ erro: parsed.error.errors[0]?.message }); return
      }
      const { client_id, process_id } = parsed.data

      const cliente = await prisma.client.findFirst({
        where: { id: client_id, user_id: req.user.id, deleted_at: null },
      })
      if (!cliente) { res.status(404).json({ erro: 'Cliente não encontrado' }); return }

      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      const intakeToken = await prisma.intakeToken.create({
        data: {
          token:      uuidv4(),
          client_id,
          process_id,
          expires_at: expiresAt,
        },
      })

      const link = `${process.env.FRONTEND_URL ?? 'http://localhost:5173'}/intake/${intakeToken.token}`

      // WhatsApp será enviado na Fase 5/6 — log por ora
      if (cliente.whatsapp) {
        console.log(JSON.stringify({
          level: 'info', action: 'intake_link_gerado',
          data: { clientId: client_id, link, whatsapp: cliente.whatsapp },
        }))
      }

      res.status(201).json({ token: intakeToken.token, link, expires_at: expiresAt })
    } catch (err) { next(err) }
  },

  async generateTokenNew(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) { res.status(401).json({ erro: 'Não autenticado' }); return }

      const parsed = generateTokenNewSchema.safeParse(req.body)
      if (!parsed.success) {
        res.status(400).json({ erro: parsed.error.errors[0]?.message }); return
      }
      const { name, whatsapp, phone, case_title } = parsed.data
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

      const result = await prisma.$transaction(async (tx) => {
        const cliente = await tx.client.create({
          data: { full_name: name, whatsapp, phone, user_id: req.user!.id },
        })

        let processId: string | undefined
        if (case_title) {
          const processo = await tx.process.create({
            data: {
              case_title,
              client_id: cliente.id,
              user_id:   req.user!.id,
            },
          })
          processId = processo.id
        }

        const intakeToken = await tx.intakeToken.create({
          data: {
            token:      uuidv4(),
            client_id:  cliente.id,
            process_id: processId,
            expires_at: expiresAt,
          },
        })
        return { cliente, intakeToken, processId }
      })

      const link = `${process.env.FRONTEND_URL ?? 'http://localhost:5173'}/intake/${result.intakeToken.token}`
      res.status(201).json({ token: result.intakeToken.token, link, expires_at: expiresAt, client_id: result.cliente.id })
    } catch (err) { next(err) }
  },

  async getStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const intakeToken = await getTokenOrFail(req.params.token, res)
      if (!intakeToken) return

      const advogado = intakeToken.client_id
        ? await prisma.client
            .findUnique({ where: { id: intakeToken.client_id } })
            .then(async c => c ? prisma.user.findUnique({ where: { id: c.user_id }, select: { name: true, oab_number: true, oab_state: true } }) : null)
        : null

      const cliente = intakeToken.client_id
        ? await prisma.client.findUnique({ where: { id: intakeToken.client_id } })
        : null

      res.json({
        token:      intakeToken.token,
        expires_at: intakeToken.expires_at,
        process_id: intakeToken.process_id,
        client:     cliente ? { full_name: cliente.full_name, email: cliente.email } : null,
        advogado,
        metadata:   intakeToken.metadata,
      })
    } catch (err) { next(err) }
  },

  async getDocuments(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const intakeToken = await getTokenOrFail(req.params.token, res)
      if (!intakeToken || !intakeToken.process_id) {
        if (intakeToken) res.json({ documents: [] })
        return
      }

      const docs = await prisma.processDocument.findMany({
        where: { process_id: intakeToken.process_id },
        select: { id: true, file_name: true, document_type: true, upload_date: true, requires_password: true },
        orderBy: { upload_date: 'desc' },
      })
      res.json({ documents: docs })
    } catch (err) { next(err) }
  },

  async generateTempProcuracao(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const intakeToken = await getTokenOrFail(req.params.token, res)
      if (!intakeToken) return

      const clienteId = intakeToken.client_id
      if (!clienteId) { res.status(400).json({ erro: 'Token sem cliente associado' }); return }

      const cliente = await prisma.client.findUnique({ where: { id: clienteId } })
      if (!cliente) { res.status(404).json({ erro: 'Cliente não encontrado' }); return }

      // Sobrescreve dados do cliente com o que vier no body (antes do submit definitivo)
      const dadosTemp = { ...cliente, ...req.body }
      const user = await prisma.user.findUnique({ where: { id: cliente.user_id }, include: { settings: true } })
      if (!user) { res.status(404).json({ erro: 'Advogado não encontrado' }); return }

      const resultado = await pdfService.generateProcuracao(dadosTemp, user)
      res.json({ downloadUrl: resultado.downloadUrl })
    } catch (err) { next(err) }
  },

  async submit(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const intakeToken = await getTokenOrFail(req.params.token, res)
      if (!intakeToken) return

      const parsed = submitSchema.safeParse(req.body)
      if (!parsed.success) {
        res.status(400).json({ erro: parsed.error.errors[0]?.message }); return
      }
      const data = parsed.data

      if (!validarCPF(data.cpf)) {
        res.status(422).json({ erro: 'CPF inválido' }); return
      }

      const result = await prisma.$transaction(async (tx) => {
        let clienteId = intakeToken.client_id

        if (clienteId) {
          await tx.client.update({
            where: { id: clienteId },
            data: {
              full_name:      data.full_name,
              cpf:            data.cpf,
              rg:             data.rg,
              birth_date:     data.birth_date,
              email:          data.email,
              phone:          data.phone,
              whatsapp:       data.whatsapp,
              address:        data.address,
              address_number: data.address_number,
              complement:     data.complement,
              neighborhood:   data.neighborhood,
              city:           data.city,
              state:          data.state,
              zip_code:       data.zip_code,
              gender:         data.gender,
              social_name:    data.social_name,
              marital_status: data.marital_status,
              nationality:    data.nationality,
              profession:     data.profession,
            },
          })
        } else {
          const novoCliente = await tx.client.create({
            data: {
              full_name: data.full_name, cpf: data.cpf, rg: data.rg,
              birth_date: data.birth_date, email: data.email, phone: data.phone,
              whatsapp: data.whatsapp, address: data.address, address_number: data.address_number,
              complement: data.complement, neighborhood: data.neighborhood, city: data.city,
              state: data.state, zip_code: data.zip_code, gender: data.gender,
              social_name: data.social_name, marital_status: data.marital_status,
              nationality: data.nationality, profession: data.profession,
              user_id: 'unknown', // fallback se token foi criado sem client
            },
          })
          clienteId = novoCliente.id
        }

        // Consentimento LGPD
        await tx.consent.create({
          data: {
            client_id:  clienteId!,
            purpose:    'gestao_processo',
            ip_address: req.ip,
            user_agent: req.headers['user-agent'] ?? '',
          },
        })

        // Atualizar case_description do processo (se houver)
        if (intakeToken.process_id && data.case_description) {
          await tx.process.update({
            where: { id: intakeToken.process_id },
            data: { case_description: data.case_description, intake_completed_at: new Date() },
          })
        }

        // Marcar token como usado
        await tx.intakeToken.update({
          where: { id: intakeToken.id },
          data: { used_at: new Date() },
        })

        return { clienteId: clienteId! }
      })

      // Gerar procuração definitiva (fora da transaction para não bloquear)
      const cliente = await prisma.client.findUnique({ where: { id: result.clienteId } })
      if (!cliente) { res.status(500).json({ erro: 'Erro interno após submit' }); return }

      const user = await prisma.user.findUnique({ where: { id: cliente.user_id }, include: { settings: true } })
      let downloadUrl: string | undefined
      if (user) {
        const proc = await pdfService.generateProcuracao(cliente, user).catch(() => null)
        downloadUrl = proc?.downloadUrl
      }

      // AI summary for the process (non-blocking)
      if (intakeToken.process_id && data.case_description) {
        geminiService.summarizeIntake(data.full_name, data.case_description, data.profession)
          .then(async summary => {
            if (summary) {
              await prisma.process.update({
                where: { id: intakeToken.process_id! },
                data:  { ai_summary: summary },
              })
            }
          })
          .catch(() => null)
      }

      console.log(JSON.stringify({ level: 'info', action: 'intake_submit', data: { clienteId: result.clienteId } }))
      res.json({ mensagem: 'Dados recebidos com sucesso', downloadUrl })
    } catch (err) { next(err) }
  },

  async upload(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const intakeToken = await getTokenOrFail(req.params.token, res)
      if (!intakeToken) return

      const arquivo = req.file
      if (!arquivo) { res.status(400).json({ erro: 'Arquivo não recebido' }); return }

      const buffer = arquivo.buffer

      // Detecta se PDF está criptografado
      const isPdf = arquivo.mimetype === 'application/pdf' ||
        arquivo.originalname.toLowerCase().endsWith('.pdf')

      if (isPdf) {
        const encrypted = await pdfService.isPdfEncrypted(buffer)
        if (encrypted) {
          res.json({ requiresPassword: true })
          return
        }
      }

      // Salvar arquivo
      ensureUploadDir()
      const ext = path.extname(arquivo.originalname) || '.bin'
      const filename = `intake_${uuidv4()}${ext}`
      const filePath = path.join(UPLOAD_DIR, filename)
      fs.writeFileSync(filePath, buffer)

      const hash = sha256(buffer)
      const tipoDoc = (req.body.document_type as string) || 'extra'

      if (intakeToken.process_id) {
        await prisma.processDocument.create({
          data: {
            process_id:           intakeToken.process_id,
            document_type:        tipoDoc as import('@prisma/client').DocumentType,
            file_name:            arquivo.originalname,
            file_url:             `/api/downloads/uploads/${filename}`,
            file_path:            filePath,
            file_mime:            isPdf ? 'application/pdf' : arquivo.mimetype,
            file_type:            isPdf ? 'pdf' : 'image',
            file_size:            buffer.length,
            file_hash:            hash,
            uploaded_by_role:     'cliente',
            storage_type:         'physical',
          },
        })
      }

      res.json({ requiresPassword: false, filename, hash })
    } catch (err) { next(err) }
  },
}
