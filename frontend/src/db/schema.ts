// Dexie IndexedDB schema for offline-first Haat-Bazaar
import Dexie, { type Table } from 'dexie'
import type { Shop, Product, Batch, Sale, Credit, OutboxEntry } from '@/types'

export class HaatBazaarDB extends Dexie {
  shops!: Table<Shop>
  products!: Table<Product>
  batches!: Table<Batch>
  sales!: Table<Sale>
  credits!: Table<Credit>
  outbox!: Table<OutboxEntry>

  constructor() {
    super('HaatBazaarDB')
    this.version(1).stores({
      // & = primary key (unique), remaining = secondary indexes
      shops:    '&id, updatedAt, deleted',
      products: '&id, shopId, category, updatedAt, deleted',
      batches:  '&id, productId, shopId, expiryDate, updatedAt, deleted',
      sales:    '&id, batchId, productId, shopId, soldAt, updatedAt, deleted',
      credits:  '&id, shopId, isPaid, updatedAt, deleted',
      outbox:   '&id, table, recordId, createdAt',
    })
  }
}

export const db = new HaatBazaarDB()
