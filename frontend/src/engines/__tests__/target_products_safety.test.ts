import { describe, it, expect } from 'vitest'
import { calculateBatchClearingStrategy } from '@/mock/haalkhataFeatures'
import { suggestDiscount } from '@/engines/discount'
import { calculateBatchRisk } from '@/engines/expiry'
import type { Batch, Product, Sale } from '@/types'

describe('CRITICAL EXPIRY SAFETY: 4 Target Products Verification', () => {
  const todayStr = new Date().toISOString().slice(0, 10)
  const pastDateStr = (daysAgo: number) => {
    const d = new Date()
    d.setDate(d.getDate() - daysAgo)
    return d.toISOString().slice(0, 10)
  }

  // Target 1: জাফরান (15 days expired)
  it('Product 1: জাফরান (15 days expired) -> EXPIRED, zero discount, zero BOGO, quarantine advice', () => {
    const batch = {
      id: 'batch-saffron-01',
      productName: 'জাফরান',
      quantity: 20,
      purchasePrice: 750,
      sellingPrice: 850,
      expiryDate: pastDateStr(15),
    }

    const strategy = calculateBatchClearingStrategy(batch)
    expect(strategy.expiryTier).toBe('EXPIRED')
    expect(strategy.strategyType).toBe('quarantine_expired')
    expect(strategy.discountPercent).toBe(0)
    expect(strategy.bundleOffer).toBeUndefined()
    expect(strategy.advice).toContain('বিক্রি সম্পূর্ণ নিষিদ্ধ')
    expect(strategy.advice).toContain('কোয়ারেন্টাইন')

    const product: Product = {
      id: 'prod-saffron',
      shopId: 'shop-affluent-01',
      name: 'জাফরান',
      category: 'spices',
      costPrice: 750,
      sellingPrice: 850,
      unit: 'pcs',
      updatedAt: new Date().toISOString(),
      deleted: false,
    }
    const batchObj: Batch = {
      id: 'batch-saffron-01',
      productId: 'prod-saffron',
      shopId: 'shop-affluent-01',
      quantity: 20,
      expiryDate: pastDateStr(15),
      addedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      deleted: false,
    }

    const batchRisk = calculateBatchRisk({ batch: batchObj, product, recentSales: [] })
    expect(batchRisk.expiryTier).toBe('EXPIRED')
    expect(batchRisk.risk).toBe('expired')

    const discount = suggestDiscount({ batchWithRisk: batchRisk, product, recentDailySales: 1 })
    expect(discount).toBeNull() // Zero discount!
  })

  // Target 2: টক দই (প্রাণ) (2 days expired)
  it('Product 2: টক দই (প্রাণ) (2 days expired) -> EXPIRED, zero discount, zero BOGO, quarantine advice', () => {
    const batch = {
      id: 'batch-yogurt-01',
      productName: 'টক দই (প্রাণ)',
      quantity: 36,
      purchasePrice: 50,
      sellingPrice: 60,
      expiryDate: pastDateStr(2),
    }

    const strategy = calculateBatchClearingStrategy(batch)
    expect(strategy.expiryTier).toBe('EXPIRED')
    expect(strategy.strategyType).toBe('quarantine_expired')
    expect(strategy.discountPercent).toBe(0)
    expect(strategy.bundleOffer).toBeUndefined()
    expect(strategy.advice).toContain('বিক্রি সম্পূর্ণ নিষিদ্ধ')

    const product: Product = {
      id: 'prod-yogurt',
      shopId: 'shop-affluent-01',
      name: 'টক দই (প্রাণ)',
      category: 'dairy',
      costPrice: 50,
      sellingPrice: 60,
      unit: 'packet',
      updatedAt: new Date().toISOString(),
      deleted: false,
    }
    const batchObj: Batch = {
      id: 'batch-yogurt-01',
      productId: 'prod-yogurt',
      shopId: 'shop-affluent-01',
      quantity: 36,
      expiryDate: pastDateStr(2),
      addedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      deleted: false,
    }

    const batchRisk = calculateBatchRisk({ batch: batchObj, product, recentSales: [] })
    expect(batchRisk.expiryTier).toBe('EXPIRED')
    expect(batchRisk.risk).toBe('expired')

    const discount = suggestDiscount({ batchWithRisk: batchRisk, product, recentDailySales: 2 })
    expect(discount).toBeNull()
  })

  // Target 3: আড়ং ফুল ক্রিম মিল্ক (ইউএইচটি) (1 day expired)
  it('Product 3: আড়ং ফুল ক্রিম মিল্ক (ইউএইচটি) (1 day expired) -> EXPIRED, zero discount, zero BOGO', () => {
    const batch = {
      id: 'batch-milk-01',
      productName: 'আড়ং ফুল ক্রিম মিল্ক (ইউএইচটি)',
      quantity: 48,
      purchasePrice: 110,
      sellingPrice: 125,
      expiryDate: pastDateStr(1),
    }

    const strategy = calculateBatchClearingStrategy(batch)
    expect(strategy.expiryTier).toBe('EXPIRED')
    expect(strategy.strategyType).toBe('quarantine_expired')
    expect(strategy.discountPercent).toBe(0)
    expect(strategy.bundleOffer).toBeUndefined()
    expect(strategy.advice).toContain('বিক্রি সম্পূর্ণ নিষিদ্ধ')

    const product: Product = {
      id: 'prod-milk',
      shopId: 'shop-affluent-01',
      name: 'আড়ং ফুল ক্রিম মিল্ক (ইউএইচটি)',
      category: 'dairy',
      costPrice: 110,
      sellingPrice: 125,
      unit: 'litre',
      updatedAt: new Date().toISOString(),
      deleted: false,
    }
    const batchObj: Batch = {
      id: 'batch-milk-01',
      productId: 'prod-milk',
      shopId: 'shop-affluent-01',
      quantity: 48,
      expiryDate: pastDateStr(1),
      addedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      deleted: false,
    }

    const batchRisk = calculateBatchRisk({ batch: batchObj, product, recentSales: [] })
    expect(batchRisk.expiryTier).toBe('EXPIRED')
    expect(batchRisk.risk).toBe('expired')

    const discount = suggestDiscount({ batchWithRisk: batchRisk, product, recentDailySales: 4 })
    expect(discount).toBeNull()
  })

  // Target 4: ব্রোকলি (expiry date is today, 0 days remaining)
  it('Product 4: ব্রোকলি (expiry date is today) -> EXPIRING_TODAY, zero discount, zero BOGO, remove from sale', () => {
    const batch = {
      id: 'batch-broccoli-01',
      productName: 'ব্রোকলি',
      quantity: 30,
      purchasePrice: 75,
      sellingPrice: 90,
      expiryDate: todayStr,
    }

    const strategy = calculateBatchClearingStrategy(batch)
    expect(strategy.expiryTier).toBe('EXPIRING_TODAY')
    expect(strategy.strategyType).toBe('expiring_today')
    expect(strategy.discountPercent).toBe(0)
    expect(strategy.bundleOffer).toBeUndefined()
    expect(strategy.advice).toContain('আজই মেয়াদ উত্তীর্ণের দিন')
    expect(strategy.advice).toContain('কোনো ছাড় বা BOGO অফার প্রযোজ্য নয়')

    const product: Product = {
      id: 'prod-broccoli',
      shopId: 'shop-affluent-01',
      name: 'ব্রোকলি',
      category: 'vegetables',
      costPrice: 75,
      sellingPrice: 90,
      unit: 'pcs',
      updatedAt: new Date().toISOString(),
      deleted: false,
    }
    const batchObj: Batch = {
      id: 'batch-broccoli-01',
      productId: 'prod-broccoli',
      shopId: 'shop-affluent-01',
      quantity: 30,
      expiryDate: todayStr,
      addedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      deleted: false,
    }

    const batchRisk = calculateBatchRisk({ batch: batchObj, product, recentSales: [] })
    expect(batchRisk.expiryTier).toBe('EXPIRING_TODAY')
    expect(batchRisk.daysRemaining).toBe(0)
    expect(batchRisk.risk).toBe('expired')

    const discount = suggestDiscount({ batchWithRisk: batchRisk, product, recentDailySales: 3 })
    expect(discount).toBeNull() // Zero discount!
  })
})
