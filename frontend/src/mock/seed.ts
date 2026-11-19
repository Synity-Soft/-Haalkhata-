// Seeds IndexedDB with demo data on first load
import { db } from '@/db/schema'
import { mockShops, mockProducts, mockBatches, mockSales, mockCredits } from './data'

export async function seedIfEmpty(): Promise<void> {
  try {
    const count = await db.shops.count()
    if (count > 0) {
      // Update branch names and details if already seeded
      await db.transaction('rw', db.shops, async () => {
        for (const s of mockShops) {
          await db.shops.put(s as any)
        }
      })
      return
    }

    await db.transaction('rw', [db.shops, db.products, db.batches, db.sales, db.credits], async () => {
      await db.shops.bulkAdd(mockShops as any)
      await db.products.bulkAdd(mockProducts as any)
      await db.batches.bulkAdd(mockBatches as any)
      await db.sales.bulkAdd(mockSales as any)
      await db.credits.bulkAdd(mockCredits as any)
    })

    console.log('[Haat-Bazaar] Demo data seeded successfully')
  } catch (error) {
    console.error('[Haat-Bazaar] Error seeding demo data:', error)
  }
}

