import { Request, Response, NextFunction } from 'express'

export function adminOnly(req: Request, res: Response, next: NextFunction): void {
  if (req.user?.tenantId !== 'platform') {
    res.status(403).json({
      success: false,
      error: { code: 'FORBIDDEN', message: 'Acesso restrito a administradores' },
    })
    return
  }
  next()
}
