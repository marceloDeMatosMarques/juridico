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

function autoPreferences(
  current: { storage_provider: string; calendar_provider: string },
  msConnected: boolean,
  googleConnected: boolean,
): { storage_provider?: string; calendar_provider?: string } {
  const u: { storage_provider?: string; calendar_provider?: string } = {}
  if (msConnected && !googleConnected) {
    if (current.storage_provider === 'googledrive' || current.storage_provider === 'ambos') u.storage_provider = 'onedrive'
    if (current.calendar_provider === 'google'    || current.calendar_provider === 'ambos') u.calendar_provider = 'outlook'
  } else if (!msConnected && googleConnected) {
    if (current.storage_provider === 'onedrive' || current.storage_provider === 'ambos') u.storage_provider = 'googledrive'
    if (current.calendar_provider === 'outlook' || current.calendar_provider === 'ambos') u.calendar_provider = 'google'
  }
  return u
}

type MsProfile = { mail?: string; userPrincipalName?: string; displayName?: string; otherMails?: string[] }

function extractMicrosoftEmail(profile: MsProfile): string {
  if (profile.mail) return profile.mail
  if (profile.otherMails?.[0]) return profile.otherMails[0]
  const upn = profile.userPrincipalName ?? ''
  const extIdx = upn.indexOf('#EXT#')
  if (extIdx !== -1) {
    const local = upn.substring(0, extIdx)
    const lastUnderscore = local.lastIndexOf('_')
    if (lastUnderscore !== -1) return `${local.substring(0, lastUnderscore)}@${local.substring(lastUnderscore + 1)}`
  }
  return upn
}

const loginSchema = z.object({
  email: z.string().email('E-mail inválido'),
  password: z.string().min(1, 'Senha obrigatória'),
})

const registerSchema = z.object({
  name:     z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
  email:    z.string().email('E-mail inválido'),
  password: z.string().min(8, 'Senha deve ter pelo menos 8 caracteres'),
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
  async register(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = registerSchema.safeParse(req.body)
      if (!parsed.success) {
        res.status(400).json({ erro: parsed.error.errors[0]?.message }); return
      }
      const { name, email, password } = parsed.data

      const existing = await prisma.user.findUnique({ where: { email } })
      if (existing) {
        res.status(409).json({ erro: 'E-mail já cadastrado.' }); return
      }

      const password_hash = await bcrypt.hash(password, 10)
      const user = await prisma.user.create({
        data: { name, email, password_hash, role: 'advogado' },
      })

      const tokens = signTokens({ id: user.id, email: user.email, role: user.role, name: user.name })
      console.log(JSON.stringify({ level: 'info', action: 'register', data: { userId: user.id } }))
      res.status(201).json({ ...tokens, role: user.role, name: user.name })
    } catch (err) {
      next(err)
    }
  },

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

      if (!user.password_hash) {
        res.status(401).json({ erro: 'Esta conta usa login via Google ou Microsoft. Use o botão correspondente.' })
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

  microsoftRedirect(req: Request, res: Response): void {
    const token = req.query.token as string | undefined
    let state = ''
    if (token) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET ?? '') as { id: string }
        state = decoded.id
      } catch { /* invalid token — treat as login flow */ }
    }
    const params = new URLSearchParams({
      client_id: microsoftConfig.clientId,
      response_type: 'code',
      redirect_uri: microsoftConfig.redirectUri,
      scope: microsoftConfig.scopes.join(' '),
      response_mode: 'query',
      prompt: 'select_account',
      state,
    })
    res.redirect(`${MS_AUTH_URL}?${params.toString()}`)
  },

  async microsoftCallback(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const code = req.query.code as string
      const userId = req.query.state as string | undefined

      if (!code) throw createError('Código OAuth inválido', 400)

      const tokenParams = new URLSearchParams({
        client_id: microsoftConfig.clientId,
        client_secret: microsoftConfig.clientSecret,
        code,
        redirect_uri: microsoftConfig.redirectUri,
        grant_type: 'authorization_code',
      })

      const { data } = await axios.post(MS_TOKEN_URL, tokenParams.toString(), {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      })

      const expiresAt = new Date(Date.now() + data.expires_in * 1000)

      if (userId) {
        // Connect flow: fetch Microsoft profile email then update user
        const graphRes = await axios.get<MsProfile>(
          'https://graph.microsoft.com/v1.0/me?$select=mail,userPrincipalName,otherMails,displayName',
          { headers: { Authorization: `Bearer ${data.access_token}` } }
        )
        const msEmail = extractMicrosoftEmail(graphRes.data) || null

        const currentUser = await prisma.user.findUnique({
          where: { id: userId },
          select: { storage_provider: true, calendar_provider: true, google_access_token: true },
        })
        const prefUpdate = autoPreferences(
          { storage_provider: currentUser?.storage_provider ?? 'onedrive', calendar_provider: currentUser?.calendar_provider ?? 'outlook' },
          true,
          !!currentUser?.google_access_token,
        )

        await prisma.user.update({
          where: { id: userId },
          data: {
            microsoft_access_token: data.access_token,
            microsoft_refresh_token: data.refresh_token,
            microsoft_token_expires_at: expiresAt,
            microsoft_email: msEmail,
            ...prefUpdate,
          },
        })
        console.log(JSON.stringify({ level: 'info', action: 'microsoft_connected', data: { userId } }))
        res.redirect(`${process.env.FRONTEND_URL}/configuracoes/provedores?microsoft=conectado`)
      } else {
        // Login flow: fetch profile from Microsoft Graph
        const graphRes = await axios.get<MsProfile>(
          'https://graph.microsoft.com/v1.0/me?$select=mail,userPrincipalName,otherMails,displayName',
          { headers: { Authorization: `Bearer ${data.access_token}` } }
        )
        const email = extractMicrosoftEmail(graphRes.data)
        const name = graphRes.data.displayName ?? email
        if (!email) throw createError('Não foi possível obter o e-mail da conta Microsoft', 400)

        let user = await prisma.user.findUnique({ where: { email } })
        if (!user) {
          user = await prisma.user.create({
            data: { name, email, password_hash: '', role: 'advogado',
              microsoft_access_token: data.access_token,
              microsoft_refresh_token: data.refresh_token,
              microsoft_token_expires_at: expiresAt,
              microsoft_email: email },
          })
        } else {
          await prisma.user.update({
            where: { id: user.id },
            data: { microsoft_access_token: data.access_token,
              microsoft_refresh_token: data.refresh_token,
              microsoft_token_expires_at: expiresAt,
              microsoft_email: email },
          })
        }

        const tokens = signTokens({ id: user.id, email: user.email, role: user.role, name: user.name })
        console.log(JSON.stringify({ level: 'info', action: 'microsoft_login', data: { userId: user.id } }))
        const redirectParams = new URLSearchParams({
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          role: user.role,
          name: user.name,
        })
        res.redirect(`${process.env.FRONTEND_URL}/auth/callback?${redirectParams.toString()}`)
      }
    } catch (err) {
      next(err)
    }
  },

  async microsoftDisconnect(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) { res.status(401).json({ erro: 'Não autenticado' }); return }

      const current = await prisma.user.findUnique({
        where: { id: req.user.id },
        select: { storage_provider: true, calendar_provider: true, google_access_token: true },
      })
      const prefUpdate = autoPreferences(
        { storage_provider: current?.storage_provider ?? 'onedrive', calendar_provider: current?.calendar_provider ?? 'outlook' },
        false,
        !!current?.google_access_token,
      )

      await prisma.user.update({
        where: { id: req.user.id },
        data: {
          microsoft_access_token: null,
          microsoft_refresh_token: null,
          microsoft_token_expires_at: null,
          microsoft_email: null,
          ...prefUpdate,
        },
      })
      res.json({ mensagem: 'Conta Microsoft desconectada' })
    } catch (err) {
      next(err)
    }
  },

  // ── Google OAuth ───────────────────────────────────────────────────

  googleRedirect(req: Request, res: Response): void {
    const token = req.query.token as string | undefined
    let state = ''
    if (token) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET ?? '') as { id: string }
        state = decoded.id
      } catch { /* invalid token — treat as login flow */ }
    }
    const oauth2Client = createOAuth2Client()
    const url = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: googleScopes,
      state,
      prompt: 'consent',
    })
    res.redirect(url)
  },

  async googleCallback(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const code = req.query.code as string
      const userId = req.query.state as string | undefined

      if (!code) throw createError('Código OAuth inválido', 400)

      const oauth2Client = createOAuth2Client()
      const { tokens } = await oauth2Client.getToken(code)
      oauth2Client.setCredentials(tokens)

      const { google } = await import('googleapis')
      const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client })
      const { data: profile } = await oauth2.userinfo.get()

      if (userId) {
        // Connect flow: update existing user's Google tokens
        const currentUser = await prisma.user.findUnique({
          where: { id: userId },
          select: { storage_provider: true, calendar_provider: true, microsoft_access_token: true },
        })
        const prefUpdate = autoPreferences(
          { storage_provider: currentUser?.storage_provider ?? 'onedrive', calendar_provider: currentUser?.calendar_provider ?? 'outlook' },
          !!currentUser?.microsoft_access_token,
          true,
        )

        await prisma.user.update({
          where: { id: userId },
          data: {
            google_access_token: tokens.access_token ?? null,
            google_refresh_token: tokens.refresh_token ?? null,
            google_token_expires_at: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
            google_email: profile.email ?? null,
            ...prefUpdate,
          },
        })
        console.log(JSON.stringify({ level: 'info', action: 'google_connected', data: { userId } }))
        res.redirect(`${process.env.FRONTEND_URL}/configuracoes/provedores?google=conectado`)
      } else {
        // Login flow: find or create user by Google email
        const email = profile.email ?? ''
        const name = profile.name ?? email
        if (!email) throw createError('Não foi possível obter o e-mail da conta Google', 400)

        let user = await prisma.user.findUnique({ where: { email } })
        if (!user) {
          user = await prisma.user.create({
            data: { name, email, password_hash: '', role: 'advogado',
              google_access_token: tokens.access_token ?? null,
              google_refresh_token: tokens.refresh_token ?? null,
              google_token_expires_at: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
              google_email: email },
          })
        } else {
          await prisma.user.update({
            where: { id: user.id },
            data: {
              google_access_token: tokens.access_token ?? null,
              google_refresh_token: tokens.refresh_token ?? null,
              google_token_expires_at: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
              google_email: email },
          })
        }

        const jwtTokens = signTokens({ id: user.id, email: user.email, role: user.role, name: user.name })
        console.log(JSON.stringify({ level: 'info', action: 'google_login', data: { userId: user.id } }))
        const redirectParams = new URLSearchParams({
          access_token: jwtTokens.access_token,
          refresh_token: jwtTokens.refresh_token,
          role: user.role,
          name: user.name,
        })
        res.redirect(`${process.env.FRONTEND_URL}/auth/callback?${redirectParams.toString()}`)
      }
    } catch (err) {
      next(err)
    }
  },

  async googleDisconnect(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) { res.status(401).json({ erro: 'Não autenticado' }); return }

      const current = await prisma.user.findUnique({
        where: { id: req.user.id },
        select: { storage_provider: true, calendar_provider: true, microsoft_access_token: true },
      })
      const prefUpdate = autoPreferences(
        { storage_provider: current?.storage_provider ?? 'onedrive', calendar_provider: current?.calendar_provider ?? 'outlook' },
        !!current?.microsoft_access_token,
        false,
      )

      await prisma.user.update({
        where: { id: req.user.id },
        data: {
          google_access_token: null,
          google_refresh_token: null,
          google_token_expires_at: null,
          google_email: null,
          ...prefUpdate,
        },
      })
      res.json({ mensagem: 'Conta Google desconectada' })
    } catch (err) {
      next(err)
    }
  },

  // ── Preferências dos providers ────────────────────────────────────

  async updateProviderPreferences(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) { res.status(401).json({ erro: 'Não autenticado' }); return }
      const { storage_provider, calendar_provider } = req.body as Record<string, string>
      const update: Record<string, string> = {}
      if (storage_provider) update.storage_provider = storage_provider
      if (calendar_provider) update.calendar_provider = calendar_provider
      if (Object.keys(update).length === 0) { res.status(400).json({ erro: 'Nenhuma preferência informada' }); return }
      await prisma.user.update({ where: { id: req.user.id }, data: update })
      res.json({ mensagem: 'Preferências atualizadas' })
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
          microsoft_email: true,
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
          email: user?.microsoft_email ?? null,
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
