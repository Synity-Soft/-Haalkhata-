// Haat-Bazaar — TypeScript data models

export type ProductCategory =
  | 'grain'
  | 'oil'
  | 'dairy'
  | 'vegetables'
  | 'spices'
  | 'beverages'
  | 'snacks'
  | 'cleaning'
  | 'other'

export type ExpiryRisk = 'expired' | 'high' | 'medium' | 'low' | 'safe'

export interface AuthUser {
  id: string
  username: string
  fullName?: string
  shopName?: string
  role?: string
  phone?: string
  address?: string
  district?: string
  area?: string
  branches?: Array<{ id: string; name: string; district: string; area: string }>
  createdAt?: string
}

// ─── Core entities ───────────────────────────────────────────────────────────

export interface Shop {
  id: string
  name: string
  nameEn?: string
  areaType?: 'student' | 'garment' | 'affluent' | 'mixed'
  area?: string
  location?: string
  ownerName?: string
  phone?: string
  address?: string
  lat?: number
  lng?: number
  currency?: string
  updatedAt: string
  deleted: boolean | number
}

export interface Product {
  id: string
  shopId: string
  name: string
  nameEn?: string
  category: ProductCategory
  costPrice?: number
  sellingPrice?: number
  unit: string
  unitSize?: number
  pricePerUnit?: number
  lowStockThreshold?: number
  imageEmoji?: string
  updatedAt: string
  deleted: boolean | number
}

export interface Batch {
  id: string
  productId: string
  shopId: string
  quantity: number
  expiryDate: string
  purchasePrice?: number
  purchaseDate?: string
  supplierName?: string
  addedAt?: string
  updatedAt: string
  deleted: boolean | number
}

export interface Sale {
  id: string
  batchId?: string
  productId?: string
  shopId: string
  quantity: number
  pricePerUnit: number
  soldAt: string
  paymentMethod?: string
  totalAmount?: number
  items?: unknown[]
  updatedAt: string
  deleted: boolean | number
}

export interface Credit {
  id: string
  shopId: string
  customerName: string
  customerPhone?: string
  amount: number
  description?: string
  note?: string
  dueDate?: string
  isPaid: boolean | number
  paidAt?: string
  createdAt: string
  updatedAt: string
  deleted: boolean | number
}

// ─── Sync / offline ──────────────────────────────────────────────────────────

export type OutboxTable = 'shops' | 'products' | 'batches' | 'sales' | 'credits'
export type OutboxOperation = 'create' | 'update' | 'delete'

export interface OutboxEntry {
  id: string
  table: string
  recordId: string
  operation: OutboxOperation
  payload: unknown
  createdAt: string
  attempts?: number
  lastAttemptAt?: string
  error?: string
}

// ─── AI assistant ────────────────────────────────────────────────────────────

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: string
}

// ─── Computed / derived types ─────────────────────────────────────────────────

export interface BatchWithRisk extends Batch {
  productName: string
  productNameEn?: string
  productCategory: ProductCategory
  remainingQty: number
  daysRemaining: number
  risk: ExpiryRisk
  expectedSalesBefore: number
  expectedUnsold: number
  potentialLoss: number
}

export interface DiscountSuggestion {
  batchId: string
  productId: string
  productName: string
  productNameEn?: string
  risk: ExpiryRisk
  currentPrice: number
  suggestedPrice: number
  discountPercent: number
  requiredDailySales: number
  currentDailyRate: number
  financialImpact: number
  explanation: string
}

export interface PurchaseSuggestion {
  productId: string
  productName: string
  productNameEn?: string
  category: ProductCategory
  avgDailySales: number
  areaMultiplier: number
  expectedDemand: number
  currentStock: number
  safetyStock: number
  suggestedOrder: number
  explanation: string
}

export interface Festival {
  name: string
  nameBn: string
  date: string
  daysUntil: number
  categories: ProductCategory[]
  preparationDays: number
  expectedDemandMultiplier: number
  tips: string[]
  tipsBn: string[]
}
