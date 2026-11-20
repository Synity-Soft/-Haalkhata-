// Festival and seasonal demand engine — Bangladeshi festival calendar
import type { Festival, ProductCategory } from '@/types'
import { differenceInDays, parseISO } from 'date-fns'

// ─── Hardcoded festival calendar 2026-2027 (relative to current time) ─────────
// Dates use ISO-8601. Major Bangladeshi festivals per Section 4.6.
const FESTIVAL_CALENDAR: Omit<Festival, 'daysUntil'>[] = [
  {
    name: 'Victory Day',
    nameBn: 'বিজয় দিবস',
    date: '2026-12-16',
    categories: ['snacks', 'beverages'],
    preparationDays: 5,
    expectedDemandMultiplier: 1.3,
    tips: ['Stock up on snacks and drinks for celebrations'],
    tipsBn: ['উৎসবের জন্য স্ন্যাকস ও পানীয় বাড়তি মজুদ করুন'],
  },
  {
    name: 'Christmas & New Year',
    nameBn: 'বড়দিন ও নববর্ষ',
    date: '2026-12-25',
    categories: ['snacks', 'beverages', 'dairy'],
    preparationDays: 7,
    expectedDemandMultiplier: 1.3,
    tips: ['Increase beverage and snack stocks for the festive period'],
    tipsBn: ['উৎসব মৌসুমে পানীয় ও স্ন্যাকস মজুদ বাড়ান'],
  },
  {
    name: 'New Year (Gregorian)',
    nameBn: 'ইংরেজি নববর্ষ',
    date: '2027-01-01',
    categories: ['beverages', 'snacks'],
    preparationDays: 3,
    expectedDemandMultiplier: 1.25,
    tips: ['Beverages and snacks sell faster around New Year'],
    tipsBn: ['নববর্ষে পানীয় ও স্ন্যাকস বেশি বিক্রি হয়'],
  },
  {
    name: 'Ramadan (pre-shopping)',
    nameBn: 'রমজান (আগাম কেনাকাটা)',
    date: '2027-02-15',
    categories: ['grain', 'oil', 'spices', 'beverages', 'dairy'],
    preparationDays: 14,
    expectedDemandMultiplier: 1.7,
    tips: [
      'Demand for oil, lentils, and spices rises sharply before Ramadan',
      'Stock dates, chickpeas, semai, and gram flour (besan) early',
      'Iftar beverages like Rooh Afza and tang see peak sales',
    ],
    tipsBn: [
      'রমজানের আগে সয়াবিন তেল, মসুর ও ছোলার ডালের চাহিদা তীব্র বাড়ে',
      'খেজুর, ছোলা, সেমাই ও বেসন ২ সপ্তাহ আগে থেকেই মজুদ করুন',
      'ইফতারের শরবত ও ট্যাং-এর বিক্রি দ্বিগুণ বৃদ্ধি পায়',
    ],
  },
  {
    name: 'Eid ul-Fitr',
    nameBn: 'ঈদুল ফিতর',
    date: '2027-03-20',
    categories: ['grain', 'oil', 'spices', 'dairy', 'snacks', 'beverages'],
    preparationDays: 12,
    expectedDemandMultiplier: 2.0,
    tips: [
      'Highest demand spike of the year across all grocery categories',
      'Stock rice, oil, sugar, semai, and milk powder 10 days early',
      'Ghee and whole spices spike dramatically for Eid dishes',
    ],
    tipsBn: [
      'বছরের সর্বোচ্চ চাহিদা বৃদ্ধি — চাল, তেল, চিনি, সেমাই ও গুঁড়া দুধ',
      '১০-১২ দিন আগে থেকেই পর্যাপ্ত স্টক নিশ্চিত করুন',
      'ঘি ও গরম মসলার চাহিদা ৮০-১০০% বৃদ্ধি পায়',
    ],
  },
  {
    name: 'Pahela Baishakh (Bengali New Year)',
    nameBn: 'পহেলা বৈশাখ',
    date: '2027-04-14',
    categories: ['snacks', 'beverages', 'grain', 'spices'],
    preparationDays: 7,
    expectedDemandMultiplier: 1.6,
    tips: [
      'Panta rice accompaniments (mustard oil, pickles, green chili) surge',
      'Street-food snacks, chanachur, and cold drinks in high demand',
    ],
    tipsBn: [
      'পান্তা ভাতের অনুষঙ্গ — সরিষার তেল, কাঁচামরিচ, ডাল ও আচার দ্রুত বিক্রি হয়',
      'চানাচুর, মিষ্টি ও ঠান্ডা পানীয়ের বিপুল চাহিদা থাকে',
    ],
  },
  {
    name: 'Eid ul-Adha',
    nameBn: 'ঈদুল আযহা (কোরবানি)',
    date: '2027-05-28',
    categories: ['oil', 'spices', 'grain', 'vegetables'],
    preparationDays: 12,
    expectedDemandMultiplier: 1.9,
    tips: [
      'Mass meat cooking spikes cooking oil and ground/whole spices',
      'Stock extra salt, vinegar, garlic, ginger, and onion early',
    ],
    tipsBn: [
      'মাংস রান্নার জন্য তেল, আদা, রসুন ও মশলার চাহিদা বিপুল বাড়ে',
      'কোরবানির ১০ দিন আগে লবণ, সিরকা ও পোলাও চালের মজুদ বাড়ান',
    ],
  },
  {
    name: 'Durga Puja',
    nameBn: 'শারদীয় দুর্গাপূজা',
    date: '2027-10-09',
    categories: ['snacks', 'dairy', 'beverages', 'grain', 'oil'],
    preparationDays: 8,
    expectedDemandMultiplier: 1.5,
    tips: [
      'Sweets, dairy, ghee, flour, and sugar see heavy purchasing',
      'Puja snacks and festive ingredients in high demand',
    ],
    tipsBn: [
      'পূজায় মিষ্টি, দুগ্ধজাত পণ্য, সুজি, ময়দা ও চিনির চাহিদা বাড়ে',
      'ফলমূল ও ঘি বিক্রির মাত্রা বৃদ্ধি পায়',
    ],
  },
]

// Product-level recommended preparation list per festival (Section 4.6)
export const FESTIVAL_RECOMMENDED_PRODUCTS: Record<
  string,
  Array<{ name: string; category: ProductCategory; recommendedMultiplier: string; reason: string }>
> = {
  'Eid ul-Fitr': [
    { name: 'লাচ্ছা ও বাংলা সেমাই', category: 'snacks', recommendedMultiplier: '+২০০%', reason: 'ঈদের সকালের প্রধান মিষ্টি খাবার' },
    { name: 'সয়াবিন তেল (৫ লিটার)', category: 'oil', recommendedMultiplier: '+৬০%', reason: 'পারিবারিক রান্নায় তেলের ব্যবহার দ্বিগুণ' },
    { name: 'মিনিকেট ও পোলাও চাল', category: 'grain', recommendedMultiplier: '+৫০%', reason: 'বিরিয়ানি ও পোলাও রান্নার চাহিদা' },
    { name: 'সাদা চিনি', category: 'grain', recommendedMultiplier: '+৭০%', reason: 'সেমাই ও মিষ্টান্ন তৈরির প্রধান উপাদান' },
    { name: 'গুঁড়া দুধ ও তরল দুধ', category: 'dairy', recommendedMultiplier: '+৮০%', reason: 'ডেজার্ট ও সেমাই রান্নার অপরিহার্য' },
    { name: 'গরম মসলা ও ঘি', category: 'spices', recommendedMultiplier: '+৯০%', reason: 'ঈদের স্পেশাল মাংস ও পোলাওয়ের সুবাস' },
  ],
  'Ramadan (pre-shopping)': [
    { name: 'ছোলা ও বুটের ডাল', category: 'grain', recommendedMultiplier: '+১০০%', reason: 'প্রতিদিনের ইফতারের প্রধান আইটেম' },
    { name: 'খেজুর (প্রিমিয়াম ও সাধারণ)', category: 'snacks', recommendedMultiplier: '+১৫০%', reason: 'রোজা ভাঙার সুন্নত অনুষঙ্গ' },
    { name: 'সয়াবিন তেল', category: 'oil', recommendedMultiplier: '+৬০%', reason: 'ইফতারের ভাজাপোড়া তৈরিতে প্রচুর তেল লাগে' },
    { name: 'রুহ আফজা ও ট্যাং', category: 'beverages', recommendedMultiplier: '+১০০%', reason: 'ইফতারের তৃষ্ণার্ত শরবত' },
    { name: 'বেসন ও মুড়ি', category: 'grain', recommendedMultiplier: '+৮০%', reason: 'পেঁয়াজু, বেগুনি ও মুড়ি মাখানোর জন্য' },
  ],
  'Eid ul-Adha': [
    { name: 'সয়াবিন তেল ও সরিষার তেল', category: 'oil', recommendedMultiplier: '+৮০%', reason: 'কোরবানির মাংস রান্নার মূল ভিত্তি' },
    { name: 'আদা, রসুন ও পেঁয়াজ বাটা', category: 'spices', recommendedMultiplier: '+১০০%', reason: 'মাংস কষানোর জন্য বিপুল প্রয়োজন' },
    { name: 'প্যাকেট মসলা ও হলুদ গুঁড়া', category: 'spices', recommendedMultiplier: '+৯০%', reason: 'মাংস সংরক্ষণে মসলার ব্যবহার' },
    { name: 'খাবার লবণ (বড় প্যাকেট)', category: 'spices', recommendedMultiplier: '+৭০%', reason: 'মাংস ধোয়া ও রান্নায় প্রচুর লবণ লাগে' },
  ],
  'Durga Puja': [
    { name: 'সাদা চিনি ও গুড়', category: 'grain', recommendedMultiplier: '+৭০%', reason: 'পূজার নাড়ু ও মিষ্টি তৈরিতে লাগে' },
    { name: 'ময়দা ও সুজি', category: 'grain', recommendedMultiplier: '+৬০%', reason: 'লুচি ও হালুয়া প্রস্তুতের উপকরণ' },
    { name: 'খাঁটি গাওয়া ঘি', category: 'dairy', recommendedMultiplier: '+৮০%', reason: 'ভোগ রান্না ও পূজার প্রদীপ জ্বালানো' },
    { name: 'দুধ ও মিষ্টি সামগ্রী', category: 'dairy', recommendedMultiplier: '+৮০%', reason: 'প্রসাদ বিতরণ ও অতিথি আপ্যায়ন' },
  ],
  'Victory Day': [
    { name: 'চিপস ও স্ন্যাকস প্যাক', category: 'snacks', recommendedMultiplier: '+৪০%', reason: 'ছুটির দিনে বন্ধুদের আড্ডা ও ঘোরাঘুরি' },
    { name: 'ঠান্ডা সফট ড্রিংকস', category: 'beverages', recommendedMultiplier: '+৩৫%', reason: 'পার্টি ও পিকনিকের পানীয়' },
  ],
}

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
