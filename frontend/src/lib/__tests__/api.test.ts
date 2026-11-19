import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  api,
  AUDITED_SHOP_MAPPINGS,
  getAuditedOutletId,
  type DashboardSummaryResponse,
  type OutletInventoryResponse,
  type ExpiryBatchesResponse,
  type SalesTrendResponse,
} from '../api'

describe('Audited Shop Mapping (Stage 4.7.1 & Stage 4.9)', () => {
  it('maps shop-garment-01 to OUT003', () => {
    expect(AUDITED_SHOP_MAPPINGS['shop-garment-01']).toBe('OUT003')
    expect(getAuditedOutletId('shop-garment-01')).toBe('OUT003')
  })

  it('maps shop-affluent-01 to OUT002', () => {
    expect(AUDITED_SHOP_MAPPINGS['shop-affluent-01']).toBe('OUT002')
    expect(getAuditedOutletId('shop-affluent-01')).toBe('OUT002')
  })

  it('passes through canonical outlet IDs starting with OUT', () => {
    expect(getAuditedOutletId('OUT001')).toBe('OUT001')
    expect(getAuditedOutletId('OUT003')).toBe('OUT003')
  })

  it('does NOT invent mappings for unsupported shops', () => {
    // shop-student-01 is not in the audited mapping for Stage 4.9 frontend
    expect(getAuditedOutletId('shop-student-01')).toBeNull()
    expect(getAuditedOutletId('shop-unknown')).toBeNull()
    expect(getAuditedOutletId('')).toBeNull()
  })
})

describe('Business API Client Methods', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('calls dashboardSummary with outlet_id and parses response', async () => {
    const mockSummary: Partial<DashboardSummaryResponse> = {
      outlet_id: 'OUT003',
      outlet_name: 'Bazar Grocery 003',
      distinct_stocked_products: 91,
      total_registered_products: 117,
      available_inventory_by_unit: { kg: 6400.0, litre: 1780.0 },
      low_stock_products_count: 26,
      low_stock_threshold_basis: 'reorder_point',
      batches_expiring_7d: 1,
      batches_expiring_30d: 15,
      batches_expired_with_stock: 441,
      sales_revenue_bdt: 1438165.97,
    }

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockSummary,
    } as any)

    const res = await api.dashboardSummary('OUT003')
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/dashboard/summary?outlet_id=OUT003'),
      expect.any(Object)
    )
    expect(res.outlet_id).toBe('OUT003')
    expect(res.distinct_stocked_products).toBe(91)
    expect(res.low_stock_products_count).toBe(26)
    expect(res.available_inventory_by_unit.kg).toBe(6400.0)
  })

  it('calls outletInventory with query params and parses response', async () => {
    const mockInventory: Partial<OutletInventoryResponse> = {
      outlet_id: 'OUT003',
      outlet_name: 'Bazar Grocery 003',
      total_matching_products: 91,
      limit: 50,
      offset: 0,
      items: [
        {
          product_id: 'PRD004',
          product_name: 'Masoor dal',
          product_name_bn: 'মসুর ডাল',
          category: 'Lentils and pulses',
          unit: 'kg',
          available_quantity: 350.0,
          active_batch_count: 13,
          selling_price_bdt: 151.0,
          purchase_cost_bdt: 130.0,
          is_low_stock: false,
          nearest_expiry_date: '2026-11-20',
        },
      ],
    }

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockInventory,
    } as any)

    const res = await api.outletInventory('OUT003', { limit: 50, category: 'Lentils and pulses' })
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/outlets/OUT003/inventory?category=Lentils+and+pulses&limit=50'),
      expect.any(Object)
    )
    expect(res.total_matching_products).toBe(91)
    expect(res.items[0].product_id).toBe('PRD004')
    expect(res.items[0].unit).toBe('kg')
  })

  it('calls expiryBatches and segregates upcoming vs expired batches', async () => {
    const mockExpiry: Partial<ExpiryBatchesResponse> = {
      outlet_id: 'OUT003',
      reference_date: '2026-11-16',
      days_horizon: 30,
      summary: {
        upcoming_batches_count: 15,
        upcoming_cost_exposure_bdt: 173655.40,
        expired_batches_count: 441,
        expired_cost_exposure_bdt: 4819741.0,
      },
      upcoming_batches: [
        {
          batch_id: 'BAT001',
          product_id: 'PRD004',
          product_name: 'Masoor dal',
          category: 'Lentils and pulses',
          unit: 'kg',
          remaining_quantity: 35.0,
          expiry_date: '2026-11-20',
          days_remaining: 4,
          unit_cost_bdt: 130.0,
          total_cost_exposure_bdt: 4550.0,
          status: 'upcoming',
        },
      ],
      expired_batches: [
        {
          batch_id: 'BAT002',
          product_id: 'PRD010',
          product_name: 'Soybean Oil',
          category: 'Cooking oil',
          unit: 'litre',
          remaining_quantity: 10.0,
          expiry_date: '2026-11-01',
          days_remaining: -15,
          unit_cost_bdt: 180.0,
          total_cost_exposure_bdt: 1800.0,
          status: 'expired',
        },
      ],
    }

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockExpiry,
    } as any)

    const res = await api.expiryBatches('OUT003', { days: 30 })
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/expiry/batches?outlet_id=OUT003&days=30'),
      expect.any(Object)
    )
    expect(res.summary.upcoming_batches_count).toBe(15)
    expect(res.summary.expired_batches_count).toBe(441)
    expect(res.upcoming_batches[0].status).toBe('upcoming')
    expect(res.expired_batches[0].status).toBe('expired')
    expect(res.expired_batches[0].days_remaining).toBeLessThan(0)
  })

  it('calls salesTrend and preserves 30-day timeline', async () => {
    const mockTrend: Partial<SalesTrendResponse> = {
      outlet_id: 'OUT003',
      start_date: '2026-10-17',
      end_date: '2026-11-15',
      days: 30,
      total_revenue_bdt: 1438165.97,
      average_daily_revenue_bdt: 47938.87,
      total_transactions: 1250,
      trend: [
        {
          date: '2026-10-17',
          revenue_bdt: 49120.50,
          transaction_count: 86,
          line_items_count: 182,
          units_sold_by_unit: { kg: 215.5, litre: 62.0 },
        },
      ],
    }

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockTrend,
    } as any)

    const res = await api.salesTrend('OUT003', { days: 30 })
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/reports/sales-trend?outlet_id=OUT003&days=30'),
      expect.any(Object)
    )
    expect(res.days).toBe(30)
    expect(res.total_revenue_bdt).toBe(1438165.97)
    expect(res.trend[0].date).toBe('2026-10-17')
  })

  it('throws informative error on API failure', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      text: async () => 'Outlet not found',
    } as any)

    await expect(api.dashboardSummary('OUT999')).rejects.toThrow('API error 404: Outlet not found')
  })
})
