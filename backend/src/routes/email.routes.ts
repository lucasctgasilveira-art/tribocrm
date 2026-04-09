import { Router, Request, Response } from 'express'
import { prisma } from '../lib/prisma'

const router = Router()

// 1x1 transparent GIF — returned on every pixel request regardless of tracking status
const TRANSPARENT_GIF = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64')

/**
 * GET /email/track/:pixelId
 *
 * Public (no JWT) — called by the email client when the recipient opens
 * the message and loads the invisible 1x1 tracking pixel embedded by
 * gmail.service.ts.
 *
 * Records the open in EmailTracking and creates a real-time notification
 * for the responsible seller so they know the lead just read their email.
 */
router.get('/track/:pixelId', async (req: Request, res: Response) => {
  // Always return the GIF immediately — never let tracking logic delay the image
  res.setHeader('Content-Type', 'image/gif')
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
  res.setHeader('Pragma', 'no-cache')
  res.setHeader('Expires', '0')

  try {
    const pixelId = req.params.pixelId as string

    const tracking = await prisma.emailTracking.findUnique({
      where: { trackingPixelId: pixelId },
    })

    if (tracking) {
      const isFirstOpen = !tracking.openedAt

      // Update open count + first-open timestamp
      await prisma.emailTracking.update({
        where: { id: tracking.id },
        data: {
          openedAt: tracking.openedAt ?? new Date(),
          openCount: { increment: 1 },
        },
      })

      // Create notification for the seller on first open only
      if (isFirstOpen) {
        try {
          const lead = await prisma.lead.findUnique({
            where: { id: tracking.leadId },
            select: { id: true, name: true, responsibleId: true, tenantId: true },
          })
          if (lead) {
            await prisma.notification.create({
              data: {
                tenantId: lead.tenantId,
                userId: lead.responsibleId,
                type: 'EMAIL_OPENED',
                title: 'E-mail aberto',
                body: `${lead.name} abriu seu e-mail agora`,
                link: `/vendas/leads/${lead.id}`,
              },
            })
          }
        } catch (notifErr) {
          // Never let notification failure break the pixel response
          console.error('[Email:track] notification create failed:', notifErr)
        }
      }
    }
  } catch (err) {
    // Log but never fail — the GIF must always be returned
    console.error('[Email:track] error processing pixel:', err)
  }

  res.end(TRANSPARENT_GIF)
})

/**
 * GET /email/cta/:pixelId?redirect=URL
 *
 * Public (no JWT) — tracks CTA clicks in emails and redirects to the
 * target URL. If the tracking record doesn't exist, redirects to the
 * app homepage as a graceful fallback.
 */
router.get('/cta/:pixelId', async (req: Request, res: Response) => {
  const pixelId = req.params.pixelId as string
  const redirect = String(req.query.redirect ?? 'https://tribocrm.vercel.app')

  try {
    const tracking = await prisma.emailTracking.findUnique({
      where: { trackingPixelId: pixelId },
    })

    if (tracking) {
      await prisma.emailTracking.update({
        where: { id: tracking.id },
        data: { ctaClickedAt: tracking.ctaClickedAt ?? new Date() },
      })
    }
  } catch (err) {
    console.error('[Email:cta] error processing click:', err)
  }

  res.redirect(302, redirect)
})

export default router
