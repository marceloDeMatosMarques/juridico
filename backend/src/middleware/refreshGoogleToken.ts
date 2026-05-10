import { Request, Response, NextFunction } from 'express'
import { GoogleAPIService } from '../services/GoogleAPIService'

export async function refreshGoogleToken(req: Request, res: Response, next: NextFunction): Promise<void> {
  if (!req.user) { next(); return }

  try {
    const svc = new GoogleAPIService(req.user.id)
    await svc.getClient()
    next()
  } catch {
    // Conta não conectada ou refresh falhou — não bloqueia, apenas segue
    next()
  }
}
