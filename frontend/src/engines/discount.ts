// Smart discount suggestion engine — never discounts expired products
import type { BatchWithRisk, DiscountSuggestion, Product } from '@/types'
import { format, parseISO } from 'date-fns'

/** Round a price to the nearest 5 BDT */
function roundToNearest5(price: number): number {
  return Math.round(price / 5) * 5
}

const DISCOUNT_BY_RISK: Record<string, number> = {
  high: 25,
  medium: 15,
  low: 7,
}

export function suggestDiscount(params: {
  batchWithRisk: BatchWithRisk
  product: Product
  recentDailySales: number  // avg daily sales rate
}): DiscountSuggestion | null {
  const { batchWithRisk, product, recentDailySales } = params
  const { risk } = batchWithRisk

  // SAFETY: never discount expired products
  if (risk === 'expired') return null
  if (risk === 'safe') return null

  const discountPercent = DISCOUNT_BY_RISK[risk]
  if (discountPercent === undefined) return null

  const currentPrice = product.sellingPrice ?? product.pricePerUnit ?? 0
  const suggestedPrice = roundToNearest5(currentPrice * (1 - discountPercent / 100))

  const requiredDailySales =
    batchWithRisk.remainingQty / Math.max(batchWithRisk.daysRemaining, 1)

  // Financial impact: how much we save vs full loss (negative = savings)
  const financialImpact =
    -batchWithRisk.expectedUnsold * (discountPercent / 100) * currentPrice

  const clearByDate = format(parseISO(batchWithRisk.expiryDate), 'MM/dd')
  const explanation =
    `Sell ${Math.ceil(requiredDailySales)} units/day at ৳${suggestedPrice} ` +
    `to clear stock before ${clearByDate}`

  return {
    batchId: batchWithRisk.id,
    productId: batchWithRisk.productId,
    productName: batchWithRisk.productName,
    productNameEn: batchWithRisk.productNameEn,
    risk,
    currentPrice,
    suggestedPrice,
    discountPercent,
    requiredDailySales,
    currentDailyRate: recentDailySales,
    financialImpact,
    explanation,
  }
}
