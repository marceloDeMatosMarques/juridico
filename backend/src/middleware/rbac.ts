import { Request, Response, NextFunction } from 'express'
import { Role } from '@prisma/client'

export function requireRole(...roles: Role[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user || !roles.includes(req.user.role)) {
      res.status(403).json({ erro: 'Acesso não autorizado para este perfil' })
      return
    }
    next()
  }
}
