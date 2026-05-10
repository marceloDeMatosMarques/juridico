import { Request, Response, NextFunction } from 'express'
import { MicrosoftGraphService } from '../services/MicrosoftGraphService'

export async function refreshMsToken(req: Request, res: Response, next: NextFunction): Promise<void> {
  if (!req.user) { next(); return }

  try {
    const svc = new MicrosoftGraphService(req.user.id)
    await svc.getValidToken()
    next()
  } catch {
    // Conta não conectada ou refresh falhou — não bloqueia, apenas segue
    next()
  }
}
