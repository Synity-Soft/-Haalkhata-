// Dexie React hooks — live-query wrappers for Haat-Bazaar tables
import { useLiveQuery } from 'dexie-react-hooks'
import { subDays, startOfDay } from 'date-fns'
import { db } from './schema'

/** All non-deleted shops */
export function useShops() {
  return useLiveQuery(
    () => db.shops.where('deleted').equals(0).sortBy('name'),
    [],
    []
  )
}

/** All non-deleted products for a specific shop */
export function useProducts(shopId: string) {
  return useLiveQuery(
    () =>
      db.products
        .where('[shopId+deleted]')
        // Dexie compound index workaround: filter manually for simplicity
        .equals([shopId, 0])
        .sortBy('name')
        .catch(() =>
          // fallback if compound index not available
          db.products
            .where('shopId')
            .equals(shopId)
            .filter(p => p.deleted === 0)
            .sortBy('name')
        ),
    [shopId],
    []
  )
}

/** All non-deleted batches for a specific shop */
export function useBatches(shopId: string) {
  return useLiveQuery(
    () =>
      db.batches
        .where('shopId')
        .equals(shopId)
        .filter(b => b.deleted === 0)
        .sortBy('expiryDate'),
    [shopId],
    []
  )
}

/**
 * Sales for a shop within the last `days` days (default 90).
 * Sorted ascending by soldAt.
 */
export function useSales(shopId: string, days = 90) {
  return useLiveQuery(
    () => {
      const since = startOfDay(subDays(new Date(), days)).toISOString()
      return db.sales
        .where('shopId')
        .equals(shopId)
        .filter(s => s.deleted === 0 && s.soldAt >= since)
        .sortBy('soldAt')
    },
    [shopId, days],
    []
  )
}

/** All non-deleted credits for a specific shop */
export function useCredits(shopId: string) {
  return useLiveQuery(
    () =>
      db.credits
        .where('shopId')
        .equals(shopId)
        .filter(c => c.deleted === 0)
        .sortBy('createdAt'),
    [shopId],
    []
  )
}

/** A single product plus all its non-deleted batches */
export function useProductWithBatches(productId: string) {
  return useLiveQuery(async () => {
    const product = await db.products.get(productId)
    if (!product || product.deleted === 1) return null
    const batches = await db.batches
      .where('productId')
      .equals(productId)
      .filter(b => b.deleted === 0)
      .sortBy('expiryDate')
    return { product, batches }
  }, [productId])
}

/** Outbox entries ordered by createdAt ascending (oldest first for sync) */
export function useOutbox() {
  return useLiveQuery(
    () => db.outbox.orderBy('createdAt').toArray(),
    [],
    []
  )
}
