// Unit tests for Discount engine
import { describe, it, expect } from 'vitest'
import { suggestDiscount } from '../discount'
import type { BatchWithRisk, Product } from '@/types'

describe('suggestDiscount', () => {
  const dummyProduct: Product = {
    id: 'prod-milk',
    shopId: 'shop-1',
    name: 'মিল্ক পাউডার',
    category: 'dairy',
    costPrice: 400,
    sellingPrice: 480,
    unit: 'pack',
    updatedAt: new Date().toISOString(),
    deleted: false,
  }

  it('SAFETY RULE: returns null for expired batch', () => {
    const expiredBatch: BatchWithRisk = {
      id: 'batch-exp',
      productId: 'prod-milk',
      shopId: 'shop-1',
      quantity: 10,
      expiryDate: '2026-01-01',
      addedAt: '2025-12-01',
      updatedAt: new Date().toISOString(),
      deleted: false,
      productName: 'মিল্ক পাউডার',
      productCategory: 'dairy',
      remainingQty: 10,
      daysRemaining: -5,
      risk: 'expired',
      expectedSalesBefore: 0,
      expectedUnsold: 10,
      potentialLoss: 4000,
    }

    const suggestion = suggestDiscount({
      batchWithRisk: expiredBatch,
      product: dummyProduct,
      recentDailySales: 1,
    })

    expect(suggestion).toBeNull()
  })

  it('suggests 25% discount for high-risk batch and rounds to nearest 5', () => {
    const highRiskBatch: BatchWithRisk = {
      id: 'batch-high',
      productId: 'prod-milk',
      shopId: 'shop-1',
      quantity: 10,
      expiryDate: '2026-11-18',
      addedAt: '2026-11-01',
      updatedAt: new Date().toISOString(),
      deleted: false,
      productName: 'মিল্ক পাউডার',
      productCategory: 'dairy',
      remainingQty: 8,
      daysRemaining: 2,
      risk: 'high',
      expectedSalesBefore: 2,
      expectedUnsold: 6,
      potentialLoss: 2400,
    }

    const suggestion = suggestDiscount({
      batchWithRisk: highRiskBatch,
      product: dummyProduct,
      recentDailySales: 1,
    })

    expect(suggestion).not.toBeNull()
    expect(suggestion?.discountPercent).toBe(25)
    // 480 * 0.75 = 360
    expect(suggestion?.suggestedPrice).toBe(360)
  })

  it('returns null for safe batches', () => {
    const safeBatch: BatchWithRisk = {
      id: 'batch-safe',
      productId: 'prod-milk',
      shopId: 'shop-1',
      quantity: 20,
      expiryDate: '2027-01-01',
      addedAt: '2026-11-01',
      updatedAt: new Date().toISOString(),
      deleted: false,
      productName: 'মিল্ক পাউডার',
      productCategory: 'dairy',
      remainingQty: 20,
      daysRemaining: 60,
      risk: 'safe',
      expectedSalesBefore: 20,
      expectedUnsold: 0,
      potentialLoss: 0,
    }

    const suggestion = suggestDiscount({
      batchWithRisk: safeBatch,
      product: dummyProduct,
      recentDailySales: 2,
    })

    expect(suggestion).toBeNull()
  })
})

