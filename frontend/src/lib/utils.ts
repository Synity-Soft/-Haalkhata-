// Shared utility helpers
export * from './bn'
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { differenceInDays, parseISO, format } from 'date-fns'
import type { ExpiryRisk, ExpiryTier } from '@/types'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getProductName(
  item: { name?: string; nameEn?: string; productName?: string; productNameEn?: string },
  lang: 'bn' | 'en' = 'en'
): string {
  if (lang === 'en') {
    return item.productNameEn || item.nameEn || item.productName || item.name || ''
  }
  return item.productName || item.name || item.productNameEn || item.nameEn || ''
}

export function daysUntilExpiry(expiryDate: string): number {
  return differenceInDays(parseISO(expiryDate), new Date())
}

export function getExpiryTier(daysRemaining: number): ExpiryTier {
  if (daysRemaining < 0) return 'EXPIRED'
  if (daysRemaining === 0) return 'EXPIRING_TODAY'
  if (daysRemaining <= 15) return 'NEAR_EXPIRY'
  return 'SAFE'
}

export function getExpiryRisk(daysRemaining: number): ExpiryRisk {
  if (daysRemaining <= 0) return 'expired'
  if (daysRemaining <= 3) return 'high'
  if (daysRemaining <= 7) return 'medium'
  if (daysRemaining <= 14) return 'low'
  return 'safe'
}

export function formatDate(dateStr: string, lang: 'bn' | 'en' = 'en'): string {
  const d = parseISO(dateStr)
  const formatted = format(d, 'dd MMM yyyy')
  if (lang === 'bn') return formatted.replace(/[0-9]/g, (digit) => '০১২৩৪৫৬৭৮৯'[+digit])
  return formatted
}

export function getRiskColor(risk: ExpiryRisk): string {
  switch (risk) {
    case 'expired':
      return 'text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-950 border-red-200'
    case 'high':
      return 'text-orange-700 dark:text-orange-400 bg-orange-50 dark:bg-orange-950 border-orange-200'
    case 'medium':
      return 'text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950 border-amber-200'
    case 'low':
      return 'text-yellow-700 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-950 border-yellow-200'
    case 'safe':
      return 'text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-950 border-green-200'
  }
}

export function getRiskBadgeColor(risk: ExpiryRisk): string {
  switch (risk) {
    case 'expired':
      return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
    case 'high':
      return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200'
    case 'medium':
      return 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200'
    case 'low':
      return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
    case 'safe':
      return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
  }
}

export function greetingTime(): 'morning' | 'noon' | 'afternoon' | 'evening' | 'night' {
  const hour = new Date().getHours()
  if (hour >= 5 && hour < 12) return 'morning'
  if (hour >= 12 && hour < 16) return 'noon'
  if (hour >= 16 && hour < 18) return 'afternoon'
  if (hour >= 18 && hour < 21) return 'evening'
  return 'night'
}
