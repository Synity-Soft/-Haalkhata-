// Unit tests for Purchase engine
import { describe, it, expect } from 'vitest'
import { calcPurchaseSuggestion } from '../purchase'
import type { Product, Sale } from '@/types'

describe('calcPurchaseSuggestion', () => {
  const dummyProduct: Product = {
    id: 'prod-rice',
    shopId: 'shop-1',
    name: 'মিনিকেট চাল',
    category: 'grain',
    costPrice: 60,
    sellingPrice: 70,
    unit: 'kg',
    updatedAt: new Date().toISOString(),
    deleted: false,
  }

  // 60 sales of 2 units each = 120 total / 60 days = 2 units/day
  const dummySales: Sale[] = Array.from({ length: 60 }, (_, i) => ({
    id: `sale-${i}`,
    batchId: 'batch-1',
    productId: 'prod-rice',
    shopId: 'shop-1',
    quantity: 2,
    pricePerUnit: 70,
    soldAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    deleted: false,
  }))

  it('suggests 0 order when current stock exceeds expected demand + safety stock', () => {
    const result = calcPurchaseSuggestion({
      product: dummyProduct,
      currentStock: 100, // plenty of stock
      recentSales: dummySales,
      areaType: 'mixed',
      planningDays: 7,
      safetyStockDays: 2,
    })

    // Expected demand = 2 * 7 * 1.0 = 14, safety = 2 * 2 = 4, needed = 18, stock = 100
    expect(result.suggestedOrder).toBe(0)
  })

  it('applies area multiplier for student area (1.3 for grain) to increase demand', () => {
    const mixed = calcPurchaseSuggestion({
      product: dummyProduct,
      currentStock: 0,
      recentSales: dummySales,
      areaType: 'mixed',
      planningDays: 10,
      safetyStockDays: 2,
    })

    const student = calcPurchaseSuggestion({
      product: dummyProduct,
      currentStock: 0,
      recentSales: dummySales,
      areaType: 'student',
      planningDays: 10,
      safetyStockDays: 2,
    })

    expect(student.areaMultiplier).toBe(1.3)
    expect(student.expectedDemand).toBeGreaterThan(mixed.expectedDemand)
  })

  it('calculates approximately double the order when planning days is doubled', () => {
    const period7 = calcPurchaseSuggestion({
      product: dummyProduct,
      currentStock: 0,
      recentSales: dummySales,
      areaType: 'mixed',
      planningDays: 7,
      safetyStockDays: 0,
    })

    const period14 = calcPurchaseSuggestion({
      product: dummyProduct,
      currentStock: 0,
      recentSales: dummySales,
      areaType: 'mixed',
      planningDays: 14,
      safetyStockDays: 0,
    })

    expect(period14.expectedDemand).toBe(period7.expectedDemand * 2)
  })
})

