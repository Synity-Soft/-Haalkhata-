// DB mutation helpers — every write also pushes to the outbox for future sync
import { v4 as uuidv4 } from 'uuid'
import { db } from './schema'
import type {
  Product,
  Batch,
  Sale,
  Credit,
  OutboxEntry,
  OutboxTable,
  OutboxOperation,
} from '@/types'

// ─── Outbox helper ───────────────────────────────────────────────────────────

async function pushOutbox(
  table: OutboxTable,
  recordId: string,
  operation: OutboxOperation,
  payload: unknown
) {
  const entry: OutboxEntry = {
    id: uuidv4(),
    table,
    recordId,
    operation,
    payload,
    createdAt: new Date().toISOString(),
    attempts: 0,
  }
  await db.outbox.add(entry)
}

// ─── Products ─────────────────────────────────────────────────────────────────

export async function addProduct(
  product: Omit<Product, 'id' | 'updatedAt' | 'deleted'>
): Promise<string> {
  const now = new Date().toISOString()
  const record: Product = {
    ...product,
    id: uuidv4(),
    updatedAt: now,
    deleted: 0,
  }
  await db.products.add(record)
  await pushOutbox('products', record.id, 'create', record)
  return record.id
}

export async function updateProduct(
  id: string,
  updates: Partial<Omit<Product, 'id'>>
): Promise<void> {
  const now = new Date().toISOString()
  const patch = { ...updates, updatedAt: now }
  await db.products.update(id, patch)
  const updated = await db.products.get(id)
  await pushOutbox('products', id, 'update', updated)
}

export async function deleteProduct(id: string): Promise<void> {
  const now = new Date().toISOString()
  await db.products.update(id, { deleted: 1, updatedAt: now })
  await pushOutbox('products', id, 'delete', { id, deletedAt: now })
}

// ─── Batches ─────────────────────────────────────────────────────────────────

export async function addBatch(
  batch: Omit<Batch, 'id' | 'updatedAt' | 'deleted'>
): Promise<string> {
  const now = new Date().toISOString()
  const record: Batch = {
    ...batch,
    id: uuidv4(),
    updatedAt: now,
    deleted: 0,
  }
  await db.batches.add(record)
  await pushOutbox('batches', record.id, 'create', record)
  return record.id
}

export async function updateBatch(
  id: string,
  updates: Partial<Omit<Batch, 'id'>>
): Promise<void> {
  const now = new Date().toISOString()
  const patch = { ...updates, updatedAt: now }
  await db.batches.update(id, patch)
  const updated = await db.batches.get(id)
  await pushOutbox('batches', id, 'update', updated)
}

export async function deleteBatch(id: string): Promise<void> {
  const now = new Date().toISOString()
  await db.batches.update(id, { deleted: 1, updatedAt: now })
  await pushOutbox('batches', id, 'delete', { id, deletedAt: now })
}

// ─── Sales ────────────────────────────────────────────────────────────────────

export async function addSale(
  sale: Omit<Sale, 'id' | 'updatedAt' | 'deleted'>
): Promise<string> {
  const now = new Date().toISOString()
  const record: Sale = {
    ...sale,
    id: uuidv4(),
    updatedAt: now,
    deleted: 0,
  }
  await db.sales.add(record)
  await pushOutbox('sales', record.id, 'create', record)
  return record.id
}

// ─── Credits ─────────────────────────────────────────────────────────────────

export async function addCredit(
  credit: Omit<Credit, 'id' | 'updatedAt' | 'deleted'>
): Promise<string> {
  const now = new Date().toISOString()
  const record: Credit = {
    ...credit,
    id: uuidv4(),
    updatedAt: now,
    deleted: 0,
  }
  await db.credits.add(record)
  await pushOutbox('credits', record.id, 'create', record)
  return record.id
}

export async function updateCredit(
  id: string,
  updates: Partial<Omit<Credit, 'id'>>
): Promise<void> {
  const now = new Date().toISOString()
  const patch = { ...updates, updatedAt: now }
  await db.credits.update(id, patch)
  const updated = await db.credits.get(id)
  await pushOutbox('credits', id, 'update', updated)
}

export async function markCreditPaid(id: string): Promise<void> {
  await updateCredit(id, { isPaid: 1, paidAt: new Date().toISOString() })
}

// ─── Outbox management ───────────────────────────────────────────────────────

export async function removeOutboxEntry(id: string): Promise<void> {
  await db.outbox.delete(id)
}

export async function incrementOutboxAttempt(id: string, error?: string): Promise<void> {
  const entry = await db.outbox.get(id)
  if (!entry) return
  await db.outbox.update(id, {
    attempts: (entry.attempts ?? 0) + 1,
    lastAttemptAt: new Date().toISOString(),
    error,
  })
}
