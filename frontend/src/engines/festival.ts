// Festival and seasonal demand engine — Bangladeshi festival calendar
import type { Festival, ProductCategory } from '@/types'
import { differenceInDays, parseISO } from 'date-fns'

// ─── Hardcoded festival calendar 2025-2026 ───────────────────────────────────
// Dates use ISO-8601. Lunar festivals are approximate; adjust yearly.
const FESTIVAL_CALENDAR: Omit<Festival, 'daysUntil'>[] = [
  {
    name: 'Victory Day',
    nameBn: 'বিজয় দিবস',
    date: '2025-12-16',
    categories: ['snacks', 'beverages'],
    preparationDays: 3,
    expectedDemandMultiplier: 1.2,
    tips: ['Stock up on snacks and drinks for celebrations'],
    tipsBn: ['উৎসবের জন্য স্ন্যাকস ও পানীয় মজুদ করুন'],
  },
  {
    name: 'Christmas & New Year',
    nameBn: 'বড়দিন ও নববর্ষ',
    date: '2025-12-25',
    categories: ['snacks', 'beverages', 'dairy'],
    preparationDays: 7,
    expectedDemandMultiplier: 1.3,
    tips: ['Increase beverage and snack stocks for the festive period'],
    tipsBn: ['উৎসব মৌসুমে পানীয় ও স্ন্যাকস মজুদ বাড়ান'],
  },
  {
    name: 'New Year (Gregorian)',
    nameBn: 'ইংরেজি নববর্ষ',
    date: '2026-01-01',
    categories: ['beverages', 'snacks'],
    preparationDays: 3,
    expectedDemandMultiplier: 1.2,
    tips: ['Beverages and snacks sell faster around New Year'],
    tipsBn: ['নববর্ষে পানীয় ও স্ন্যাকস বেশি বিক্রি হয়'],
  },
  {
    name: 'Ramadan (pre-shopping)',
    nameBn: 'রমজান (আগাম কেনাকাটা)',
    date: '2026-02-18',   // approximate start of Ramadan 2026
    categories: ['grain', 'oil', 'spices', 'beverages', 'dairy'],
    preparationDays: 14,
    expectedDemandMultiplier: 1.6,
    tips: [
      'Demand for oil, lentils, and spices rises sharply before Ramadan',
      'Stock dates, vermicelli (semai), and chickpeas early',
      'Iftar beverages see 70% higher sales',
    ],
    tipsBn: [
      'রমজানের আগে তেল, ডাল ও মশলার চাহিদা তীব্রভাবে বাড়ে',
      'খেজুর, সেমাই ও বুটের ডাল আগেই মজুদ করুন',
      'ইফতারের পানীয় ৭০% বেশি বিক্রি হয়',
    ],
  },
  {
    name: 'Independence Day',
    nameBn: 'স্বাধীনতা দিবস',
    date: '2026-03-26',
    categories: ['snacks', 'beverages'],
    preparationDays: 3,
    expectedDemandMultiplier: 1.15,
    tips: ['Modest uplift in snacks and beverages'],
    tipsBn: ['স্ন্যাকস ও পানীয়তে মাঝারি চাহিদা বৃদ্ধি'],
  },
  {
    name: 'Eid ul-Fitr',
    nameBn: 'ঈদুল ফিতর',
    date: '2026-03-31',   // approximate Eid ul-Fitr 2026
    categories: ['grain', 'oil', 'spices', 'dairy', 'snacks', 'beverages'],
    preparationDays: 10,
    expectedDemandMultiplier: 1.8,
    tips: [
      'Highest demand spike of the year for most categories',
      'Stock grain, cooking oil, spices and vermicelli 10 days early',
      'Sweets and dairy see very high demand',
    ],
    tipsBn: [
      'বছরের সর্বোচ্চ চাহিদা বৃদ্ধি',
      '১০ দিন আগে থেকে চাল, তেল, মশলা ও সেমাই মজুদ করুন',
      'মিষ্টি ও দুগ্ধজাত পণ্যের চাহিদা অনেক বেশি',
    ],
  },
  {
    name: 'Pahela Baishakh (Bengali New Year)',
    nameBn: 'পহেলা বৈশাখ',
    date: '2026-04-14',
    categories: ['snacks', 'beverages', 'grain', 'spices'],
    preparationDays: 7,
    expectedDemandMultiplier: 1.5,
    tips: [
      'Panta rice accompaniments (hilsa, pickles) sell out fast',
      'Street-food snacks and cold drinks in high demand',
    ],
    tipsBn: [
      'পান্তা ভাতের সাথে ইলিশ ও আচার দ্রুত বিক্রি হয়',
      'স্ট্রিট ফুড স্ন্যাকস ও ঠান্ডা পানীয়ের চাহিদা বেশি',
    ],
  },
  {
    name: 'Eid ul-Adha',
    nameBn: 'ঈদুল আযহা',
    date: '2026-06-07',   // approximate Eid ul-Adha 2026
    categories: ['oil', 'spices', 'grain', 'vegetables'],
    preparationDays: 10,
    expectedDemandMultiplier: 1.7,
    tips: [
      'Cooking oil and spices spike due to mass meat cooking',
      'Stock extra grain and vegetables before the holiday',
    ],
    tipsBn: [
      'গরুর মাংস রান্নার কারণে তেল ও মশলার চাহিদা তীব্র বাড়ে',
      'ছুটির আগে চাল ও সবজি বাড়তি মজুদ করুন',
    ],
  },
  {
    name: 'Durga Puja',
    nameBn: 'দুর্গাপূজা',
    date: '2026-10-11',   // approximate Durga Puja 2026
    categories: ['snacks', 'dairy', 'beverages', 'grain'],
    preparationDays: 5,
    expectedDemandMultiplier: 1.3,
    tips: ['Sweets, dairy and snacks see higher demand during Puja'],
    tipsBn: ['পূজায় মিষ্টি, দুধ ও স্ন্যাকসের চাহিদা বাড়ে'],
  },
]

// ─── Category boost multipliers per festival ──────────────────────────────────
const FESTIVAL_CATEGORY_BOOST: Record<string, Partial<Record<ProductCategory, number>>> = {
  'Eid ul-Fitr': {
    grain: 1.5, oil: 1.6, spices: 1.7, dairy: 1.4, snacks: 1.5, beverages: 1.4,
  },
  'Eid ul-Adha': {
    oil: 1.8, spices: 1.8, grain: 1.5, vegetables: 1.4,
  },
  'Ramadan (pre-shopping)': {
    oil: 1.6, spices: 1.5, beverages: 1.7, grain: 1.4, dairy: 1.3,
  },
  'Pahela Baishakh (Bengali New Year)': {
    snacks: 1.8, beverages: 1.5, grain: 1.3, spices: 1.2,
  },
  'Durga Puja': {
    snacks: 1.5, dairy: 1.4, beverages: 1.3, grain: 1.2,
  },
  'Victory Day': { snacks: 1.3, beverages: 1.3 },
  'Christmas & New Year': { snacks: 1.3, beverages: 1.4, dairy: 1.2 },
  'New Year (Gregorian)': { beverages: 1.3, snacks: 1.2 },
  'Independence Day': { snacks: 1.2, beverages: 1.2 },
}

function withDaysUntil(f: Omit<Festival, 'daysUntil'>): Festival {
  const daysUntil = differenceInDays(parseISO(f.date), new Date())
  return { ...f, daysUntil }
}

export function getUpcomingFestivals(daysAhead: number = 90): Festival[] {
  return FESTIVAL_CALENDAR
    .map(withDaysUntil)
    .filter((f) => f.daysUntil >= 0 && f.daysUntil <= daysAhead)
    .sort((a, b) => a.daysUntil - b.daysUntil)
}

export function getFestivalBoost(festival: Festival, category: ProductCategory): number {
  const boostMap = FESTIVAL_CATEGORY_BOOST[festival.name]
  if (!boostMap) return festival.expectedDemandMultiplier
  return boostMap[category] ?? 1.0
}
