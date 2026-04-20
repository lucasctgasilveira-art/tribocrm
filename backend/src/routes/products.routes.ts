import { Router } from 'express'
import { authMiddleware } from '../middleware/auth.middleware'
import { tenantStatusGuard } from '../middleware/tenant-status.middleware'
import {
  getProducts, createProduct, updateProduct, deleteProduct,
  getDiscountRequests, createDiscountRequest, reviewDiscountRequest,
} from '../controllers/products.controller'

const router = Router()

router.use(authMiddleware)
router.use(tenantStatusGuard)

// Products
router.get('/', getProducts)
router.post('/', createProduct)
router.patch('/:id', updateProduct)
router.delete('/:id', deleteProduct)

// Discount Requests
router.get('/discount-requests', getDiscountRequests)
router.post('/discount-requests', createDiscountRequest)
router.patch('/discount-requests/:id/review', reviewDiscountRequest)

export default router
