import { Request, Response, NextFunction } from 'express'

// Rate limit in-memory por API key. Dois limites:
//   - 60 requests por minuto (burst protection)
//   - 1000 requests por hora (volume diário)
//
// Implementação simples com janelas deslizantes truncadas (não
// sliding-window puro — é janela fixa rotativa, mais barata e suficiente
// pros volumes esperados em PME). Quem precisar de mais granularidade,
// migra pra Redis num próximo round.
//
// Aplica APENAS depois do apiKeyAuth (precisa de req.apiKey populado).
// Se chegou aqui sem isso, é bug nosso — passa direto pra não quebrar
// (defensivo).

interface Bucket {
  minuteCount: number
  minuteWindowStart: number
  hourCount: number
  hourWindowStart: number
}

const RATE_LIMIT_PER_MINUTE = 60
const RATE_LIMIT_PER_HOUR = 1000
const MINUTE_MS = 60_000
const HOUR_MS = 60 * 60_000

const buckets = new Map<string, Bucket>()

// Cleanup periódico — remove buckets que não foram usados na última
// hora. Roda a cada 10min, low-cost (Map é pequeno: 1 entry por key
// ativa nos últimos 60min).
setInterval(() => {
  const now = Date.now()
  for (const [key, bucket] of buckets.entries()) {
    if (now - bucket.hourWindowStart > HOUR_MS) {
      buckets.delete(key)
    }
  }
}, 10 * 60_000).unref()

export function apiKeyRateLimit(req: Request, res: Response, next: NextFunction): void {
  const apiKeyId = req.apiKey?.apiKeyId
  if (!apiKeyId) {
    next()
    return
  }

  const now = Date.now()
  let bucket = buckets.get(apiKeyId)
  if (!bucket) {
    bucket = {
      minuteCount: 0,
      minuteWindowStart: now,
      hourCount: 0,
      hourWindowStart: now,
    }
    buckets.set(apiKeyId, bucket)
  }

  // Reset janelas expiradas.
  if (now - bucket.minuteWindowStart >= MINUTE_MS) {
    bucket.minuteCount = 0
    bucket.minuteWindowStart = now
  }
  if (now - bucket.hourWindowStart >= HOUR_MS) {
    bucket.hourCount = 0
    bucket.hourWindowStart = now
  }

  if (bucket.minuteCount >= RATE_LIMIT_PER_MINUTE) {
    const resetMs = (bucket.minuteWindowStart + MINUTE_MS) - now
    res.set('Retry-After', String(Math.ceil(resetMs / 1000)))
    res.status(429).json({
      success: false,
      error: {
        code: 'RATE_LIMIT_MINUTE',
        message: 'Limite de 60 requisições por minuto excedido.',
      },
    })
    return
  }

  if (bucket.hourCount >= RATE_LIMIT_PER_HOUR) {
    const resetMs = (bucket.hourWindowStart + HOUR_MS) - now
    res.set('Retry-After', String(Math.ceil(resetMs / 1000)))
    res.status(429).json({
      success: false,
      error: {
        code: 'RATE_LIMIT_HOUR',
        message: 'Limite de 1000 requisições por hora excedido.',
      },
    })
    return
  }

  bucket.minuteCount += 1
  bucket.hourCount += 1

  // Headers padrão pra cliente saber o estado (compat com convenção
  // do express-rate-limit usado em outras partes do app).
  res.set('X-RateLimit-Limit-Minute', String(RATE_LIMIT_PER_MINUTE))
  res.set('X-RateLimit-Remaining-Minute', String(RATE_LIMIT_PER_MINUTE - bucket.minuteCount))
  res.set('X-RateLimit-Limit-Hour', String(RATE_LIMIT_PER_HOUR))
  res.set('X-RateLimit-Remaining-Hour', String(RATE_LIMIT_PER_HOUR - bucket.hourCount))

  next()
}
