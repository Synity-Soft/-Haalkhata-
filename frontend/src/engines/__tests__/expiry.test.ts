// Unit tests for Expiry engine
import { describe, it, expect } from 'vitest'
import { calculateBatchRisk, sortBatchesByRisk, calcExpiryStats } from '../expiry'
import type { Batch, Product, Sale, BatchWithRisk } from '@/types'

describe('calculateBatchRisk', () => {
  const dummyProduct: Product = {
    id: 'p1',
    shopId: 's1',
    name: 'মিনিকেট চাল',
    category: 'grain',
    costPrice: 60,
    sellingPrice: 70,
    unit: 'kg',
    updatedAt: new Date().toISOString(),
    deleted: false,
  }

  it('marks an expired batch as risk="expired" and calculates potential loss', () => {
    const expiredBatch: Batch = {
      id: 'b1',
      productId: 'p1',
      shopId: 's1',
      quantity: 10,
      expiryDate: '2020-01-01',
      addedAt: '2019-12-01',
      updatedAt: new Date().toISOString(),
      deleted: false,
    }

    const result = calculateBatchRisk({
      batch: expiredBatch,
      product: dummyProduct,
      recentSales: [],
    })

    expect(result.risk).toBe('expired')
    expect(result.potentialLoss).toBe(600) // 10 * 60
    expect(result.remainingQty).toBe(10)
  })

  it('marks a batch expiring in > 14 days with good sales as safe', () => {
    const futureDate = new Date()
    futureDate.setDate(futureDate.getDate() + 45)

    const freshBatch: Batch = {
      id: 'b2',
      productId: 'p1',
      shopId: 's1',
      quantity: 50,
      expiryDate: futureDate.toISOString().split('T')[0],
      addedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      deleted: false,
    }

    const recentSales: Sale[] = [
      {
        id: 'sale-1',
        batchId: 'b2',
        productId: 'p1',
        shopId: 's1',
        quantity: 30,
        pricePerUnit: 70,
        soldAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        deleted: false,
      },
    ]

    const result = calculateBatchRisk({
      batch: freshBatch,
      product: dummyProduct,
      recentSales,
    })

    expect(result.risk).toBe('safe')
    expect(result.remainingQty).toBe(20)
  })

  it('sorts batches: expired before high before medium before low before safe', () => {
    const items: BatchWithRisk[] = [
      { risk: 'safe', id: '1' } as BatchWithRisk,
      { risk: 'expired', id: '2' } as BatchWithRisk,
      { risk: 'high', id: '3' } as BatchWithRisk,
      { risk: 'medium', id: '4' } as BatchWithRisk,
    ]

    const sorted = sortBatchesByRisk(items)
    expect(sorted.map((s) => s.risk)).toEqual(['expired', 'high', 'medium', 'safe'])
  })
})

