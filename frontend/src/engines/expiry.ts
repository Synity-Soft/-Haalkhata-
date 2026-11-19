// Expiry and wastage risk engine — works fully offline
import type { Batch, Product, Sale, BatchWithRisk, ExpiryRisk } from '@/types'
import { daysUntilExpiry, getExpiryRisk } from '@/lib/utils'

const RISK_ORDER: ExpiryRisk[] = ['expired', 'high', 'medium', 'low', 'safe']

export function calculateBatchRisk(params: {
  batch: Batch
  product: Product
  recentSales: Sale[]  // sales of this product in last 30 days
}): BatchWithRisk {
  const { batch, product, recentSales } = params

  // Sum only sales that belong to this specific batch
  const batchSalesQty = recentSales
    .filter((s) => s.batchId === batch.id)
    .reduce((sum, s) => sum + s.quantity, 0)

  const remainingQty = Math.max(0, batch.quantity - batchSalesQty)

  const daysRemaining = daysUntilExpiry(batch.expiryDate)

  // Average across all recent product sales (last 30 days)
  const totalSaleQty = recentSales.reduce((sum, s) => sum + s.quantity, 0)
  const avgDailySales = recentSales.length > 0 ? totalSaleQty / 30 : 0

  const expectedSalesBefore = Math.min(
    avgDailySales * Math.max(daysRemaining, 0),
    remainingQty
  )

  const expectedUnsold = Math.max(remainingQty - expectedSalesBefore, 0)
  const cost = product.costPrice ?? product.pricePerUnit ?? 0
  const potentialLoss = expectedUnsold * cost
  const risk = getExpiryRisk(daysRemaining)

  return {
    ...batch,
    productName: product.name,
    productNameEn: product.nameEn,
    productCategory: product.category,
    remainingQty,
    daysRemaining,
    risk,
    expectedSalesBefore,
    expectedUnsold,
    potentialLoss,
  }
}

export function sortBatchesByRisk(batches: BatchWithRisk[]): BatchWithRisk[] {
  // sorts: expired first, then high, medium, low, safe
  return [...batches].sort(
    (a, b) => RISK_ORDER.indexOf(a.risk) - RISK_ORDER.indexOf(b.risk)
  )
}

export function calcExpiryStats(batches: BatchWithRisk[]): {
  totalExpired: number
  totalExpiringSoon: number  // daysRemaining <= 7
  highRiskBatches: number
  estimatedLoss: number
} {
  return {
    totalExpired: batches.filter((b) => b.risk === 'expired').length,
    totalExpiringSoon: batches.filter((b) => b.daysRemaining <= 7 && b.daysRemaining >= 0).length,
    highRiskBatches: batches.filter((b) => b.risk === 'high').length,
    estimatedLoss: batches.reduce((sum, b) => sum + b.potentialLoss, 0),
  }
}
