import { Request, Response, NextFunction } from 'express'
import bcrypt from 'bcrypt'
import jwt, { SignOptions } from 'jsonwebtoken'
import axios from 'axios'
import { z } from 'zod'
import type { StringValue } from 'ms'
import { prisma } from '../config/database'
import { microsoftConfig, MS_TOKEN_URL, MS_AUTH_URL } from '../config/microsoft'
import { createOAuth2Client, googleScopes } from '../config/google'
import { createError } from '../middleware/errorHandler'

const loginSchema = z.object({
  email: z.string().email('E-mail inválido'),
  password: z.string().min(1, 'Senha obrigatória'),
})

const refreshSchema = z.object({
  refresh_token: z.string().min(1),
})

function signTokens(payload: { id: string; email: string; role: string; name: string }) {
  const accessOpts: SignOptions = {
    expiresIn: (process.env.JWT_EXPIRES_IN ?? '15m') as StringValue,
  }
  const refreshOpts: SignOptions = {
    expiresIn: (process.env.JWT_REFRESH_EXPIRES_IN ?? '7d') as StringValue,
  }
  const access_token = jwt.sign(payload, process.env.JWT_SECRET ?? '', accessOpts)
  const refresh_token = jwt.sign({ id: payload.id }, process.env.JWT_REFRESH_SECRET ?? '', refreshOpts)
  return { access_token, refresh_token }
}

export const authController = {
  async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = loginSchema.safeParse(req.body)
      if (!parsed.success) {
        res.status(400).json({ erro: parsed.error.errors[0]?.message })
        return
      }
      const { email, password } = parsed.data

      const user = await prisma.user.findUnique({ where: { email } })
      if (!user) {
        res.status(401).json({ erro: 'Credenciais inválidas' })
        return
      }

      const valid = await bcrypt.compare(password, user.password_hash)
      if (!valid) {
        res.status(401).json({ erro: 'Credenciais inválidas' })
        return
      }

      const tokens = signTokens({ id: user.id, email: user.email, role: user.role, name: user.name })

      console.log(JSON.stringify({ level: 'info', action: 'login', data: { userId: user.id } }))
      res.json({ ...tokens, role: user.role, name: user.name })
    } catch (err) {
      next(err)
    }
  },

  async refresh(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = refreshSchema.safeParse(req.body)
      if (!parsed.success) {
        res.status(400).json({ erro: 'Refresh token obrigatório' })
        return
      }

      let payload: { id: string }
      try {
        payload = jwt.verify(
          parsed.data.refresh_token,
          process.env.JWT_REFRESH_SECRET ?? ''
        ) as { id: string }
      } catch {
        res.status(401).json({ erro: 'Refresh token inválido ou expirado' })
        return
      }

      const user = await prisma.user.findUnique({ where: { id: payload.id } })
      if (!user) {
        res.status(401).json({ erro: 'Usuário não encontrado' })
        return
      }

      const tokens = signTokens({ id: user.id, email: user.email, role: user.role, name: user.name })
      res.json(tokens)
    } catch (err) {
      next(err)
    }
  },

  logout(_req: Request, res: Response): void {
    res.status(204).end()
  },

  // ── Microsoft OAuth ────────────────────────────────────────────────

  microsoftRedirect(_req: Request, res: Response): void {
    const params = new URLSearchParams({
      client_id: microsoftConfig.clientId,
      response_type: 'code',
      redirect_uri: microsoftConfig.redirectUri,
      scope: microsoftConfig.scopes.join(' '),
      response_mode: 'query',
    })
    res.redirect(`${MS_AUTH_URL}?${params.toString()}`)
  },

  async microsoftCallback(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const code = req.query.code as string
      const userId = (req.query.state as string | undefined) ?? req.user?.id

      if (!code || !userId) {
        throw createError('Parâmetros OAuth inválidos', 400)
      }

      const params = new URLSearchParams({
        client_id: microsoftConfig.clientId,
        client_secret: microsoftConfig.clientSecret,
        code,
        redirect_uri: microsoftConfig.redirectUri,
        grant_type: 'authorization_code',
      })

      const { data } = await axios.post(MS_TOKEN_URL, params.toString(), {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      })

      const expiresAt = new Date(Date.now() + data.expires_in * 1000)

      await prisma.user.update({
        where: { id: userId },
        data: {
          microsoft_access_token: data.access_token,
          microsoft_refresh_token: data.refresh_token,
          microsoft_token_expires_at: expiresAt,
        },
      })

      console.log(JSON.stringify({ level: 'info', action: 'microsoft_connected', data: { userId } }))
      res.redirect(`${process.env.FRONTEND_URL}/configuracoes/provedores?microsoft=conectado`)
    } catch (err) {
      next(err)
    }
  },

  async microsoftDisconnect(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) { res.status(401).json({ erro: 'Não autenticado' }); return }

      await prisma.user.update({
        where: { id: req.user.id },
        data: {
          microsoft_access_token: null,
          microsoft_refresh_token: null,
          microsoft_token_expires_at: null,
        },
      })
      res.json({ mensagem: 'Conta Microsoft desconectada' })
    } catch (err) {
      next(err)
    }
  },

  // ── Google OAuth ───────────────────────────────────────────────────

  googleRedirect(req: Request, res: Response): void {
    const oauth2Client = createOAuth2Client()
    const url = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: googleScopes,
      state: req.user?.id ?? '',
      prompt: 'consent',
    })
    res.redirect(url)
  },

  async googleCallback(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const code = req.query.code as string
      const userId = (req.query.state as string | undefined) ?? req.user?.id

      if (!code || !userId) {
        throw createError('Parâmetros OAuth inválidos', 400)
      }

      const oauth2Client = createOAuth2Client()
      const { tokens } = await oauth2Client.getToken(code)

      // Busca o e-mail da conta Google conectada
      oauth2Client.setCredentials(tokens)
      const { google } = await import('googleapis')
      const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client })
      const { data: profile } = await oauth2.userinfo.get()

      await prisma.user.update({
        where: { id: userId },
        data: {
          google_access_token: tokens.access_token ?? null,
          google_refresh_token: tokens.refresh_token ?? null,
          google_token_expires_at: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
          google_email: profile.email ?? null,
        },
      })

      console.log(JSON.stringify({ level: 'info', action: 'google_connected', data: { userId } }))
      res.redirect(`${process.env.FRONTEND_URL}/configuracoes/provedores?google=conectado`)
    } catch (err) {
      next(err)
    }
  },

  async googleDisconnect(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) { res.status(401).json({ erro: 'Não autenticado' }); return }

      await prisma.user.update({
        where: { id: req.user.id },
        data: {
          google_access_token: null,
          google_refresh_token: null,
          google_token_expires_at: null,
          google_email: null,
        },
      })
      res.json({ mensagem: 'Conta Google desconectada' })
    } catch (err) {
      next(err)
    }
  },

  // ── Status dos providers ───────────────────────────────────────────

  async providersStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) { res.status(401).json({ erro: 'Não autenticado' }); return }

      const user = await prisma.user.findUnique({
        where: { id: req.user.id },
        select: {
          microsoft_access_token: true,
          microsoft_token_expires_at: true,
          google_access_token: true,
          google_email: true,
          storage_provider: true,
          calendar_provider: true,
        },
      })

      res.json({
        microsoft: {
          conectado: !!user?.microsoft_access_token,
          expira_em: user?.microsoft_token_expires_at,
        },
        google: {
          conectado: !!user?.google_access_token,
          email: user?.google_email,
        },
        storage_provider: user?.storage_provider,
        calendar_provider: user?.calendar_provider,
      })
    } catch (err) {
      next(err)
    }
  },
}
