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
export type ExpiryTier = 'EXPIRED' | 'EXPIRING_TODAY' | 'NEAR_EXPIRY' | 'SAFE'

export interface AuthBranch {
  id: string
  name: string
  district?: string
  area?: string
  outlet_id?: string
  outlet_name?: string
  outlet_type?: string
  role?: string
  is_primary?: boolean
}

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
  branches?: AuthBranch[]
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
  batchCode?: string
  barcode?: string
  receivedDate?: string
  batchNumber?: number
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
  lastSmsSentAt?: string
  smsCount?: number
  createdAt: string
  updatedAt: string
  deleted: boolean | number
}

// ─── Smart Digital Ledger & Voice Bookkeeping ────────────────────────────────
export interface Expense {
  id: string
  shopId: string
  category: 'rent' | 'utility' | 'salary' | 'transport' | 'snack' | 'stock' | 'other'
  title: string
  amount: number
  date: string
  note?: string
  createdAt: string
}

export interface SupplierDue {
  id: string
  shopId: string
  supplierName: string
  supplierPhone?: string
  companyName: string
  amount: number
  paidAmount: number
  dueDate?: string
  status: 'unpaid' | 'partial' | 'paid'
  note?: string
  createdAt: string
  updatedAt: string
}

export interface VoiceParsedTransaction {
  type: 'sale' | 'expense' | 'credit' | 'mixed'
  rawText: string
  totalSales?: number
  cashReceived?: number
  customerCredit?: number
  expenseAmount?: number
  customerName?: string
  supplierName?: string
  expenseCategory?: string
  items?: string[]
  date: string
  confidence: number
}

// ─── Distributor & Wholesale ────────────────────────────────────────────────
export interface Distributor {
  id: string
  name: string
  nameBn: string
  categories: string[]
  phone: string
  whatsapp: string
  contactPerson: string
  territory: string
  rating: number
  deliveryTimeHours: number
  minOrderQuantity: number
  reliability: string
}

export interface DistributorPriceComparison {
  id: string
  productId: string
  productName: string
  productNameBn: string
  category: string
  marketMrp: number
  demandIndex: number
  rating: number
  reviewCount: number
  distributorOffers: Array<{
    distributorId: string
    distributorName: string
    wholesalePrice: number
    marginPercent: number
    stockStatus: 'in_stock' | 'limited' | 'high_demand'
    moq: number
    deliveryTime: string
  }>
}

// ─── Peer Shop Network ──────────────────────────────────────────────────────
export interface PeerShopExchange {
  id: string
  type: 'overstock' | 'emergency'
  shopId: string
  shopName: string
  distanceMeters: number
  productId?: string
  productName: string
  quantity: number
  unit: string
  offeredPrice: number
  regularPrice?: number
  urgency: 'high' | 'medium' | 'standard'
  status: 'open' | 'accepted' | 'completed'
  note?: string
  createdAt: string
}

// ─── Batch Clearance Strategy ───────────────────────────────────────────────
export interface BatchStrategySuggestion {
  batchId: string
  batchCode: string
  barcode?: string
  productId: string
  productName: string
  fifoOrder: number
  receiveDate: string
  expiryDate: string
  daysUntilExpiry: number
  quantity: number
  unit: string
  purchaseCost: number
  retailPrice: number
  discountPercent: number
  strategyType: 'standard' | 'early_clearance' | 'bundle_bogo' | 'flash_clearout' | 'quarantine_expired' | 'expiring_today'
  expiryTier?: ExpiryTier
  bundleOffer?: string
  projectedProfitOrLoss: number
  advice: string
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
  expiryTier?: ExpiryTier
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
