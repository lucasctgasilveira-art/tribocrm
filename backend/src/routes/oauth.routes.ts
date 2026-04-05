import { Router } from 'express'
const router = Router()
router.get('/ping', (_req, res) => res.json({ pong: true }))
router.get('/google/callback', (_req, res) => res.json({ callback: true, query: _req.query }))
export default router
