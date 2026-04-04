import api from './api'

export interface ProductsParams {
  search?: string
  isActive?: string
}

export interface CreateProductPayload {
  name: string
  description?: string
  price: number
  category?: string
  maxDiscount?: number
  approvalType?: string
}

export interface DiscountRequestPayload {
  productId: string
  leadId: string
  requestedDiscount: number
}

export interface ReviewPayload {
  status: 'APPROVED' | 'REJECTED'
  rejectionReason?: string
}

export async function getProducts(params?: ProductsParams) {
  const response = await api.get('/products', { params })
  return response.data.data
}

export async function createProduct(payload: CreateProductPayload) {
  const response = await api.post('/products', payload)
  return response.data.data
}

export async function updateProduct(id: string, payload: Record<string, unknown>) {
  const response = await api.patch(`/products/${id}`, payload)
  return response.data.data
}

export async function deleteProduct(id: string) {
  const response = await api.delete(`/products/${id}`)
  return response.data.data
}

export async function getDiscountRequests(params?: { status?: string }) {
  const response = await api.get('/products/discount-requests', { params })
  return response.data.data
}

export async function createDiscountRequest(payload: DiscountRequestPayload) {
  const response = await api.post('/products/discount-requests', payload)
  return response.data.data
}

export async function reviewDiscountRequest(id: string, payload: ReviewPayload) {
  const response = await api.patch(`/products/discount-requests/${id}/review`, payload)
  return response.data.data
}

export default {
  getProducts, createProduct, updateProduct, deleteProduct,
  getDiscountRequests, createDiscountRequest, reviewDiscountRequest,
}
