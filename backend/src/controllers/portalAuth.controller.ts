import { Request, Response, NextFunction } from 'express'
import bcrypt from 'bcrypt'
import jwt, { SignOptions } from 'jsonwebtoken'
import { z } from 'zod'
import type { StringValue } from 'ms'
import { prisma } from '../config/database'
import { EvolutionAPIService } from '../services/EvolutionAPIService'

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

function randomPassword(len = 8): string {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
  return Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

function signPortalTokens(payload: { id: string; email: string; name: string; client_id: string }) {
  const base = { ...payload, role: 'cliente' }
  const accessOpts: SignOptions = { expiresIn: (process.env.JWT_EXPIRES_IN ?? '15m') as StringValue }
  const refreshOpts: SignOptions = { expiresIn: (process.env.JWT_REFRESH_EXPIRES_IN ?? '7d') as StringValue }
  return {
    access_token:  jwt.sign(base, process.env.JWT_SECRET ?? '', accessOpts),
    refresh_token: jwt.sign({ id: payload.id }, process.env.JWT_REFRESH_SECRET ?? '', refreshOpts),
  }
}

export const portalAuthController = {
  async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = loginSchema.safeParse(req.body)
      if (!parsed.success) { res.status(400).json({ erro: 'E-mail ou senha inválidos' }); return }

      const { email, password } = parsed.data
      const user = await prisma.user.findFirst({ where: { email, role: 'cliente' } })
      if (!user) { res.status(401).json({ erro: 'Credenciais inválidas' }); return }

      const valid = await bcrypt.compare(password, user.password_hash)
      if (!valid) { res.status(401).json({ erro: 'Credenciais inválidas' }); return }

      const client = await prisma.client.findFirst({ where: { portal_user_id: user.id } })
      if (!client) { res.status(401).json({ erro: 'Perfil de cliente não encontrado' }); return }

      const tokens = signPortalTokens({ id: user.id, email: user.email, name: user.name, client_id: client.id })
      res.json({
        ...tokens,
        role: 'cliente',
        name: user.name,
        client_id: client.id,
        password_changed: user.portal_password_changed,
      })
    } catch (err) { next(err) }
  },

  async activatePortal(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) { res.status(401).json({ erro: 'Não autenticado' }); return }

      const client = await prisma.client.findFirst({
        where: { id: req.params.clientId, user_id: req.user.id, deleted_at: null },
      })
      if (!client) { res.status(404).json({ erro: 'Cliente não encontrado' }); return }
      if (client.portal_enabled) { res.status(409).json({ erro: 'Portal já ativado para este cliente' }); return }
      if (!client.email) { res.status(400).json({ erro: 'Cliente não possui e-mail cadastrado' }); return }

      const plainPassword = randomPassword()
      const hash = await bcrypt.hash(plainPassword, 12)

      const portalUser = await prisma.user.create({
        data: {
          name: client.full_name,
          email: client.email,
          password_hash: hash,
          role: 'cliente',
        },
      })

      await prisma.client.update({
        where: { id: client.id },
        data: { portal_user_id: portalUser.id, portal_enabled: true },
      })

      const portalUrl = process.env.FRONTEND_URL ?? 'https://juriscontrol.com.br'

      // WhatsApp notification (fire-and-forget)
      if (client.whatsapp) {
        const settings = await prisma.settings.findUnique({ where: { user_id: req.user.id } })
        if (settings?.evolution_instance_name && settings.evolution_api_url && settings.evolution_api_key) {
          const evo = new EvolutionAPIService(
            settings.evolution_instance_name,
            settings.evolution_api_url,
            settings.evolution_api_key,
          )
          evo.sendText(
            client.whatsapp,
            `Olá ${client.full_name}! Seu portal foi ativado.\n\n🔗 Acesse: ${portalUrl}/portal/login\n📧 Login: ${client.email}\n🔑 Senha: ${plainPassword}\n\nPor segurança, altere sua senha no primeiro acesso.`,
          ).catch(() => null)
        }
      }

      res.json({ mensagem: 'Portal ativado com sucesso', email: client.email, password: plainPassword })
    } catch (err) { next(err) }
  },
}
