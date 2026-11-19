// Purchase suggestion engine — area-based demand estimation
import type { Product, Sale, PurchaseSuggestion, ProductCategory } from '@/types'

export const AREA_MULTIPLIERS: Record<string, Record<string, number>> = {
  student:  { grain: 1.3, oil: 1.0, dairy: 0.8, vegetables: 0.9, spices: 1.1, beverages: 1.4, snacks: 1.5, cleaning: 0.7, other: 1.0 },
  garment:  { grain: 1.4, oil: 1.2, dairy: 0.9, vegetables: 1.0, spices: 1.0, beverages: 1.2, snacks: 1.0, cleaning: 1.1, other: 1.0 },
  affluent: { grain: 0.8, oil: 0.9, dairy: 1.5, vegetables: 1.3, spices: 0.8, beverages: 1.3, snacks: 1.2, cleaning: 1.4, other: 1.1 },
  mixed:    { grain: 1.0, oil: 1.0, dairy: 1.0, vegetables: 1.0, spices: 1.0, beverages: 1.0, snacks: 1.0, cleaning: 1.0, other: 1.0 },
}

export function calcPurchaseSuggestion(params: {
  product: Product
  currentStock: number       // sum of remaining batch quantities
  recentSales: Sale[]        // last 60 days of sales for this product
  areaType: string
  planningDays: number       // e.g. 7, 14, or 30
  safetyStockDays: number    // e.g. 2
}): PurchaseSuggestion {
  const { product, currentStock, recentSales, areaType, planningDays, safetyStockDays } = params

  const totalSaleQty = recentSales.reduce((sum, s) => sum + s.quantity, 0)
  const avgDailySales = recentSales.length > 0 ? totalSaleQty / 60 : 0

  const categoryKey: string = product.category as ProductCategory
  const areaRow = AREA_MULTIPLIERS[areaType] ?? AREA_MULTIPLIERS['mixed']
  const areaMultiplier = areaRow[categoryKey] ?? 1.0

  const expectedDemand = avgDailySales * planningDays * areaMultiplier
  const safetyStock = avgDailySales * safetyStockDays
  const suggestedOrder = Math.max(0, Math.ceil(expectedDemand + safetyStock - currentStock))

  const boostNote =
    areaMultiplier !== 1.0
      ? ` (${areaType} area demand factor ×${areaMultiplier})`
      : ''
  const explanation =
    `Based on ${avgDailySales.toFixed(1)} units/day average, ` +
    `you need ${Math.ceil(expectedDemand)} units for ${planningDays} days${boostNote}. ` +
    `Suggested order: ${suggestedOrder} units.`

  return {
    productId: product.id,
    productName: product.name,
    productNameEn: product.nameEn,
    category: product.category,
    avgDailySales,
    areaMultiplier,
    expectedDemand,
    currentStock,
    safetyStock,
    suggestedOrder,
    explanation,
  }
}
