// Credit (বাকি) tracking engine
import type { Credit } from '@/types'
import { isBefore, parseISO } from 'date-fns'

export interface CreditStats {
  totalOutstanding: number
  totalPaid: number
  overdueCount: number
  overdueAmount: number
  byCustomer: Array<{ customerName: string; total: number; unpaidCount: number }>
}

export function calcCreditStats(credits: Credit[]): CreditStats {
  const now = new Date()
  let totalOutstanding = 0
  let totalPaid = 0
  let overdueCount = 0
  let overdueAmount = 0

  const customerMap = new Map<string, { total: number; unpaidCount: number }>()

  for (const credit of credits) {
    if (credit.deleted) continue

    const custName = credit.customerName || 'Unknown Customer'
    const existing = customerMap.get(custName) || { total: 0, unpaidCount: 0 }

    if (credit.isPaid) {
      totalPaid += credit.amount
    } else {
      totalOutstanding += credit.amount
      existing.total += credit.amount
      existing.unpaidCount += 1

      if (credit.dueDate) {
        try {
          const due = parseISO(credit.dueDate)
          if (isBefore(due, now)) {
            overdueCount += 1
            overdueAmount += credit.amount
          }
        } catch {
          // ignore date parse error
        }
      }
    }

    customerMap.set(custName, existing)
  }

  const byCustomer = Array.from(customerMap.entries()).map(([customerName, data]) => ({
    customerName,
    total: data.total,
    unpaidCount: data.unpaidCount,
  }))

  return {
    totalOutstanding,
    totalPaid,
    overdueCount,
    overdueAmount,
    byCustomer,
  }
}

