import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'

interface JwtPayload {
  id: string
  email: string
  role: string
  name: string
  client_id?: string
}

export function auth(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ erro: 'Token de acesso não fornecido' })
    return
  }

  const token = header.slice(7)
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET ?? '') as JwtPayload
    req.user = {
      id: payload.id,
      email: payload.email,
      role: payload.role as import('@prisma/client').Role,
      name: payload.name,
      client_id: payload.client_id,
    }
    next()
  } catch {
    res.status(401).json({ erro: 'Token inválido ou expirado' })
  }
}
