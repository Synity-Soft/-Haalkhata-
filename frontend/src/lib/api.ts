// All API calls go through this module. Frontend never calls Gemini or Supabase directly.
const RAW_URL =
  ((import.meta as any).env?.VITE_API_BASE_URL as string) ||
  ((import.meta as any).env?.MODE === 'production' || (import.meta as any).env?.PROD
    ? 'https://haalkhata-vjfs.onrender.com'
    : 'http://localhost:8000')

const BASE_URL = RAW_URL.replace(/\/+$/, '')

const TOKEN_STORAGE_KEY = 'hb_auth_token'

export function getAuthToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_STORAGE_KEY)
  } catch {
    return null
  }
}

export function setAuthToken(token: string): void {
  try {
    if (token) {
      localStorage.setItem(TOKEN_STORAGE_KEY, token)
    } else {
      localStorage.removeItem(TOKEN_STORAGE_KEY)
    }
  } catch (err) {
    console.error('Failed to set auth token:', err)
  }
}

export function clearAuthToken(): void {
  try {
    localStorage.removeItem(TOKEN_STORAGE_KEY)
  } catch (err) {
    console.error('Failed to clear auth token:', err)
  }
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const token = getAuthToken()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options?.headers as Record<string, string> | undefined),
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers,
  })
  if (!res.ok) throw new Error(`API error ${res.status}: ${await res.text()}`)
  return res.json() as Promise<T>
}

// ─── Audited Shop Mapping ───────────────────────────────────────────────────
// Audited mapping from frontend mock shop IDs to canonical backend outlet IDs.
// Strictly observes Stage 4.7.1 & Stage 4.9 requirements:
// - shop-garment-01 -> OUT003
// - shop-affluent-01 -> OUT002
// Do NOT invent mappings for unsupported shops.
export const AUDITED_SHOP_MAPPINGS: Record<string, string> = {
  'shop-garment-01': 'OUT003',
  'shop-affluent-01': 'OUT002',
}

export function getAuditedOutletId(shopId: string): string | null {
  if (!shopId) return null
  if (shopId.startsWith('OUT')) return shopId
  return AUDITED_SHOP_MAPPINGS[shopId] || null
}

// ─── Legacy / Existing Schemas ──────────────────────────────────────────────
export interface ShopSummary {
  id: string
  name: string
  areaType: string
}

export interface SyncPushResponse {
  synced: number
}

export interface SyncPullResponse {
  changes: unknown[]
  serverTime: string
}

export interface AssistantResponse {
  reply: string
}

export interface HealthResponse {
  status: string
}

// ─── Business Domain Schemas (Matching Backend Pydantic Models) ─────────────

// 1. Dashboard Summary
export interface DashboardReportingPeriod {
  start_date: string
  end_date: string
  days: number
}

export interface DashboardSummaryResponse {
  outlet_id: string
  outlet_name: string
  distinct_stocked_products: number
  total_registered_products: number
  available_inventory_by_unit: Record<string, number>
  low_stock_products_count: number
  low_stock_threshold_basis: string
  batches_expiring_7d: number
  batches_expiring_30d: number
  batches_expired_with_stock: number
  reference_date: string
  reporting_period: DashboardReportingPeriod
  sales_revenue_bdt: number
  sales_transactions_count: number
  sales_line_items_count: number
  units_sold_by_unit: Record<string, number>
}

// 2. Outlet Inventory
export interface OutletInventoryItem {
  product_id: string
  product_name: string
  product_name_bn?: string | null
  category: string
  unit: string
  available_quantity: number
  active_batch_count: number
  selling_price_bdt?: number | null
  purchase_cost_bdt?: number | null
  reorder_point?: number | null
  is_low_stock?: boolean
  nearest_expiry_date?: string | null
}

export interface OutletInventoryResponse {
  outlet_id: string
  outlet_name: string
  total_matching_products: number
  limit: number
  offset: number
  category_filter?: string | null
  items: OutletInventoryItem[]
}

// 3. Expiry Batches
export interface ExpiryBatchItem {
  batch_id: string
  product_id: string
  product_name: string
  product_name_bn?: string | null
  category: string
  unit: string
  remaining_quantity: number
  batch_received_date?: string | null
  expiry_date: string
  days_remaining: number
  unit_cost_bdt: number
  selling_price_bdt?: number | null
  total_cost_exposure_bdt: number
  status: string
}

export interface ExpirySummary {
  upcoming_batches_count: number
  upcoming_cost_exposure_bdt: number
  expired_batches_count: number
  expired_cost_exposure_bdt: number
}

export interface ExpiryBatchesResponse {
  outlet_id: string
  outlet_name: string
  reference_date: string
  days_horizon: number
  summary: ExpirySummary
  upcoming_batches: ExpiryBatchItem[]
  expired_batches: ExpiryBatchItem[]
}

// 4. Sales Trend Report
export interface DailySalesPoint {
  date: string
  revenue_bdt: number
  transaction_count: number
  line_items_count: number
  units_sold_by_unit: Record<string, number>
}

export interface SalesTrendResponse {
  outlet_id: string
  outlet_name: string
  start_date: string
  end_date: string
  days: number
  total_revenue_bdt: number
  average_daily_revenue_bdt: number
  total_transactions: number
  total_line_items: number
  trend: DailySalesPoint[]
}

// ─── API Client Methods ─────────────────────────────────────────────────────

export const api = {
  health: () => request<HealthResponse>('/api/health'),

  shops: () => request<ShopSummary[]>('/api/shops'),

  syncPush: (changes: unknown[]) =>
    request<SyncPushResponse>('/api/sync/push', {
      method: 'POST',
      body: JSON.stringify({ changes }),
    }),

  syncPull: (since: string) =>
    request<SyncPullResponse>(`/api/sync/pull?since=${encodeURIComponent(since)}`),

  assistant: (shopId: string, message: string, context: unknown) =>
    request<AssistantResponse>(`/api/shops/${encodeURIComponent(shopId)}/assistant`, {
      method: 'POST',
      body: JSON.stringify({ message, context }),
    }),

  // Business Domain APIs
  dashboardSummary: (outletId: string, referenceDate?: string) => {
    const params = new URLSearchParams({ outlet_id: outletId })
    if (referenceDate) params.append('reference_date', referenceDate)
    return request<DashboardSummaryResponse>(`/api/v1/dashboard/summary?${params.toString()}`)
  },

  outletInventory: (
    outletId: string,
    params?: { category?: string; limit?: number; offset?: number }
  ) => {
    const q = new URLSearchParams()
    if (params?.category) q.append('category', params.category)
    if (params?.limit !== undefined) q.append('limit', String(params.limit))
    if (params?.offset !== undefined) q.append('offset', String(params.offset))
    const qs = q.toString() ? `?${q.toString()}` : ''
    return request<OutletInventoryResponse>(`/api/v1/outlets/${encodeURIComponent(outletId)}/inventory${qs}`)
  },

  expiryBatches: (
    outletId: string,
    params?: { days?: number; status_filter?: string; reference_date?: string }
  ) => {
    const q = new URLSearchParams({ outlet_id: outletId })
    if (params?.days !== undefined) q.append('days', String(params.days))
    if (params?.status_filter) q.append('status_filter', params.status_filter)
    if (params?.reference_date) q.append('reference_date', params.reference_date)
    return request<ExpiryBatchesResponse>(`/api/v1/expiry/batches?${q.toString()}`)
  },

  salesTrend: (
    outletId: string,
    params?: { days?: number; end_date?: string }
  ) => {
    const q = new URLSearchParams({ outlet_id: outletId })
    if (params?.days !== undefined) q.append('days', String(params.days))
    if (params?.end_date) q.append('end_date', params.end_date)
    return request<SalesTrendResponse>(`/api/v1/reports/sales-trend?${q.toString()}`)
  },

  setAuthToken,
  getAuthToken,
  clearAuthToken,

  authLogin: (credentials: { username: string; password: string }) => {
    return request<{ success: boolean; access_token?: string; token_type?: string; user?: any; error?: string }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    })
  },

  authRegister: (data: any) => {
    return request<{ success: boolean; access_token?: string; token_type?: string; user?: any; error?: string }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  },

  authBranches: () => {
    return request<{ success: boolean; branches: Array<{ outlet_id: string; outlet_name: string; outlet_type: string; district?: string; area?: string; role: string; is_primary: boolean }> }>('/api/auth/branches')
  },

  authProfile: () => {
    return request<any>('/api/auth/me')
  },
}
