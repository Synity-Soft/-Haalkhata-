// Haalkhata (হালখাতা) Advanced Retail Features Engine & Mock Data
import type {
  Distributor,
  DistributorPriceComparison,
  PeerShopExchange,
  BatchStrategySuggestion,
  Expense,
  SupplierDue,
  VoiceParsedTransaction,
} from '@/types'

// ─── 1. Verified Distributors ───────────────────────────────────────────────
export const VERIFIED_DISTRIBUTORS: Distributor[] = [
  {
    id: 'dist-fresh',
    name: 'Meghna Group (Fresh)',
    nameBn: 'মেঘনা গ্রুপ অব ইন্ডাস্ট্রিজ (ফ্রেশ)',
    categories: ['oil', 'grain', 'dairy', 'snacks'],
    phone: '01711-234567',
    whatsapp: '8801711234567',
    contactPerson: 'তারেক মাহমুদ (এরিয়া ম্যানেজার)',
    territory: 'ঢাকা দক্ষিণ ও ধানমন্ডি জোন',
    rating: 4.9,
    deliveryTimeHours: 12,
    minOrderQuantity: 10,
    reliability: '৯৯% সময়মতো ডেলিভারি',
  },
  {
    id: 'dist-akij',
    name: 'Akij Essentials Ltd',
    nameBn: 'আকিজ এসেনশিয়ালস লিমিটেড',
    categories: ['grain', 'flour', 'staples', 'oil'],
    phone: '01819-876543',
    whatsapp: '8801819876543',
    contactPerson: 'কবির হোসেন (ডিস্ট্রিবিউশন ইনচার্জ)',
    territory: 'মিরপুর ও মোহাম্মদপুর জোন',
    rating: 4.8,
    deliveryTimeHours: 24,
    minOrderQuantity: 15,
    reliability: '৯৫% স্টক প্রাপ্যতা',
  },
  {
    id: 'dist-city',
    name: 'City Group (Teer)',
    nameBn: 'সিটি গ্রুপ (তীর ব্র্যান্ড)',
    categories: ['oil', 'sugar', 'flour', 'dal'],
    phone: '01912-345678',
    whatsapp: '8801912345678',
    contactPerson: 'সোহেল রানা (সেলস অফিসার)',
    territory: 'পুরান ঢাকা ও তেজগাঁও জোন',
    rating: 4.9,
    deliveryTimeHours: 18,
    minOrderQuantity: 12,
    reliability: '৯৮% বিশ্বস্ত সাপ্লাই',
  },
  {
    id: 'dist-pran',
    name: 'PRAN-RFL Consumer Goods',
    nameBn: 'প্রাণ-আরএফএল কনজিউমার গুডস',
    categories: ['spices', 'noodles', 'snacks', 'beverages', 'dairy'],
    phone: '01700-112233',
    whatsapp: '8801700112233',
    contactPerson: 'জাহিদ হাসান (টেরিটরি অফিসার)',
    territory: 'সমগ্র ঢাকা মেট্রো',
    rating: 4.7,
    deliveryTimeHours: 24,
    minOrderQuantity: 8,
    reliability: '৯৪% ডেলিভারি রেট',
  },
  {
    id: 'dist-square',
    name: 'Square Toiletries & Food (Radhuni/Ruchi)',
    nameBn: 'স্কয়ার ফুড অ্যান্ড বেভারেজ (রাঁধুনী/রুচি)',
    categories: ['spices', 'cleaning', 'hygiene', 'snacks'],
    phone: '01755-998877',
    whatsapp: '8801755998877',
    contactPerson: 'নাজমুল ইসলাম (সিনিয়র এক্সিকিউটিভ)',
    territory: 'গুলশান, বনানী ও ধানমন্ডি',
    rating: 4.9,
    deliveryTimeHours: 16,
    minOrderQuantity: 10,
    reliability: '৯৭% প্রিমিয়াম রেটিং',
  },
]

// ─── 2. Distributor Price Comparison & Market Trend ─────────────────────────
export const DISTRIBUTOR_PRICE_COMPARISONS: DistributorPriceComparison[] = [
  {
    id: 'pc-oil-5l',
    productId: 'prod-oil-5l',
    productName: 'Soybean Oil 5L',
    productNameBn: 'সয়াবিন তেল ৫ লিটার',
    category: 'oil',
    marketMrp: 890,
    demandIndex: 96,
    rating: 4.9,
    reviewCount: 340,
    distributorOffers: [
      {
        distributorId: 'dist-fresh',
        distributorName: 'ফ্রেশ (Meghna Group)',
        wholesalePrice: 815,
        marginPercent: 8.4,
        stockStatus: 'in_stock',
        moq: 6,
        deliveryTime: '১২ ঘণ্টা',
      },
      {
        distributorId: 'dist-city',
        distributorName: 'তীর (City Group)',
        wholesalePrice: 808,
        marginPercent: 9.2,
        stockStatus: 'high_demand',
        moq: 12,
        deliveryTime: '১৮ ঘণ্টা',
      },
      {
        distributorId: 'dist-akij',
        distributorName: 'আকিজ এসেনশিয়ালস',
        wholesalePrice: 820,
        marginPercent: 7.9,
        stockStatus: 'in_stock',
        moq: 10,
        deliveryTime: '২৪ ঘণ্টা',
      },
    ],
  },
  {
    id: 'pc-rice-miniket',
    productId: 'prod-rice-25kg',
    productName: 'Miniket Rice 25kg Sack',
    productNameBn: 'মিনিকেট চাল ২৫ কেজি বস্তা',
    category: 'grain',
    marketMrp: 1850,
    demandIndex: 98,
    rating: 4.8,
    reviewCount: 420,
    distributorOffers: [
      {
        distributorId: 'dist-akij',
        distributorName: 'আকিজ এসেনশিয়ালস (ক্লাসিক)',
        wholesalePrice: 1680,
        marginPercent: 9.2,
        stockStatus: 'in_stock',
        moq: 5,
        deliveryTime: '২৪ ঘণ্টা',
      },
      {
        distributorId: 'dist-fresh',
        distributorName: 'ফ্রেশ মিনিকেট প্রিমিয়াম',
        wholesalePrice: 1710,
        marginPercent: 7.6,
        stockStatus: 'in_stock',
        moq: 8,
        deliveryTime: '১২ ঘণ্টা',
      },
      {
        distributorId: 'dist-city',
        distributorName: 'তীর মিনিকেট চাল',
        wholesalePrice: 1695,
        marginPercent: 8.4,
        stockStatus: 'limited',
        moq: 10,
        deliveryTime: '১৮ ঘণ্টা',
      },
    ],
  },
  {
    id: 'pc-sugar-1kg',
    productId: 'prod-sugar',
    productName: 'White Sugar 1kg Pack',
    productNameBn: 'সাদা চিনি ১ কেজি প্যাকেট',
    category: 'grain',
    marketMrp: 140,
    demandIndex: 92,
    rating: 4.7,
    reviewCount: 280,
    distributorOffers: [
      {
        distributorId: 'dist-city',
        distributorName: 'তীর চিনি (City Group)',
        wholesalePrice: 124,
        marginPercent: 11.4,
        stockStatus: 'in_stock',
        moq: 25,
        deliveryTime: '১২ ঘণ্টা',
      },
      {
        distributorId: 'dist-fresh',
        distributorName: 'ফ্রেশ চিনি (Meghna Group)',
        wholesalePrice: 125,
        marginPercent: 10.7,
        stockStatus: 'in_stock',
        moq: 20,
        deliveryTime: '১৮ ঘণ্টা',
      },
    ],
  },
  {
    id: 'pc-radhuni-spices',
    productId: 'prod-spices-pack',
    productName: 'Radhuni Turmeric Powder 200g',
    productNameBn: 'রাঁধুনী হলুদ গুঁড়া ২০০ গ্রাম',
    category: 'spices',
    marketMrp: 95,
    demandIndex: 88,
    rating: 4.9,
    reviewCount: 195,
    distributorOffers: [
      {
        distributorId: 'dist-square',
        distributorName: 'স্কয়ার ফুড (অফিসিয়াল)',
        wholesalePrice: 81,
        marginPercent: 14.7,
        stockStatus: 'in_stock',
        moq: 24,
        deliveryTime: '১৬ ঘণ্টা',
      },
      {
        distributorId: 'dist-pran',
        distributorName: 'প্রাণ গুঁড়া মসলা ডিস্ট্রিবিউশন',
        wholesalePrice: 83,
        marginPercent: 12.6,
        stockStatus: 'in_stock',
        moq: 20,
        deliveryTime: '২৪ ঘণ্টা',
      },
    ],
  },
]

// ─── 3. Peer Shop Network (দোকান নেটওয়ার্ক) ──────────────────────────────────
export const INITIAL_PEER_EXCHANGES: PeerShopExchange[] = [
  {
    id: 'exch-01',
    type: 'overstock',
    shopId: 'shop-bhai-bhai',
    shopName: 'ভাই ভাই জেনারেল স্টোর (Shop B)',
    distanceMeters: 250,
    productName: 'তীর সয়াবিন তেল ১ লিটার',
    quantity: 15,
    unit: 'বোতল',
    offeredPrice: 172,
    regularPrice: 185,
    urgency: 'medium',
    status: 'open',
    note: 'আমাদের কাছে ১৫ বোতল বাড়তি মজুদ আছে, সেল ধীর। পাইকারি মূল্যে নিতে পারেন।',
    createdAt: new Date(Date.now() - 3600000 * 3).toISOString(),
  },
  {
    id: 'exch-02',
    type: 'emergency',
    shopId: 'shop-mayer-doa',
    shopName: 'মায়ের দোয়া এন্টারপ্রাইজ (Shop C)',
    distanceMeters: 400,
    productName: 'ফ্রেশ চিনি ১ কেজি প্যাকেট',
    quantity: 10,
    unit: 'কেজি',
    offeredPrice: 135,
    regularPrice: 140,
    urgency: 'high',
    status: 'open',
    note: 'জরুরি কাস্টমার অর্ডার আসছে, দোকানে চিনি শেষ! দ্রুত ১০ প্যাকেট ধার বা কিনতে চাই।',
    createdAt: new Date(Date.now() - 3600000 * 1).toISOString(),
  },
  {
    id: 'exch-03',
    type: 'overstock',
    shopId: 'shop-jonota',
    shopName: 'জনতা সুপার শপ (Shop D)',
    distanceMeters: 550,
    productName: 'ম্যাগি মাসালা নুডলস ফ্যামিলি প্যাক',
    quantity: 8,
    unit: 'প্যাক',
    offeredPrice: 190,
    regularPrice: 220,
    urgency: 'standard',
    status: 'open',
    note: 'অতিরিক্ত মজুদ ক্লিয়ারেন্স। যেকোনো প্রতিবেশী দোকানদার নিতে পারেন।',
    createdAt: new Date(Date.now() - 3600000 * 6).toISOString(),
  },
]

// ─── 4. Batch Recognizer & FIFO Escalating Discount Strategy ─────────────────

/**
 * Generates an auto-incremented or standardized batch code & barcode
 * Supports FB-001, FB-002 style codes (e.g. Fresh Bun -> FB-001)
 */
export function generateBatchCode(productName: string, batchNumber: number = 1): {
  batchCode: string
  barcode: string
} {
  // Check if product has recognized initials like Fresh Bun -> FB
  const words = productName.trim().split(/\s+/)
  let initials = ''
  if (words.length >= 2) {
    initials = (words[0][0] + words[1][0]).toUpperCase().replace(/[^A-Z]/g, '')
  }
  if (!initials || initials.length < 2) {
    initials = productName.slice(0, 2).toUpperCase().replace(/[^A-Z]/g, 'FB') || 'FB'
  }
  const paddedNum = String(batchNumber).padStart(3, '0')
  const batchCode = `${initials}-${paddedNum}`
  const barcode = `894${Math.floor(100000000 + Math.random() * 900000000)}`
  return { batchCode, barcode }
}

/**
 * Computes business-driven dynamic clearance strategies to prevent food/grocery loss
 * FEFO (First Expired, First Out) Priority
 * Discount Escalation according to Section 4.3:
 *   - 15 days remaining: 10% discount
 *   - 10 days remaining: 15–20% discount
 *   - 5 days remaining:  25–30% discount
 *   - Very close (<= 2 days): Special offers or bundle promotions: Buy 1 Get 1, Buy 2 Get 1, Bundle offers, Special clearance
 */
export function calculateBatchClearingStrategy(
  batch: {
    id: string
    productName: string
    batchCode?: string
    barcode?: string
    quantity: number
    unit?: string
    purchasePrice?: number
    sellingPrice?: number
    expiryDate: string
    receiveDate?: string
    fifoOrder?: number
  }
): BatchStrategySuggestion {
  const now = Date.now()
  const expTime = new Date(batch.expiryDate).getTime()
  const daysUntil = Math.ceil((expTime - now) / (1000 * 60 * 60 * 24))

  const cost = batch.purchasePrice || 20
  const retail = batch.sellingPrice || Math.round(cost * 1.5)
  const qty = batch.quantity || 1
  const unit = batch.unit || 'পিস'

  let discountPercent = 0
  let strategyType: BatchStrategySuggestion['strategyType'] = 'standard'
  let bundleOffer: string | undefined = undefined
  let advice = ''

  if (daysUntil > 12) {
    discountPercent = 10
    strategyType = 'early_clearance'
    advice = '১৫ দিন সময় আছে। ১০% প্রারম্ভিক ছাড়ে স্বাভাবিক বিক্রির গতি নিশ্চিত করুন।'
  } else if (daysUntil >= 8 && daysUntil <= 12) {
    discountPercent = 20
    strategyType = 'early_clearance'
    advice = 'মেয়াদ ঘনিয়ে আসছে (১০ দিন বাকি)। ১৫–২০% ছাড়ে দ্রুত পণ্য সেল করুন।'
  } else if (daysUntil >= 3 && daysUntil <= 7) {
    discountPercent = 30
    strategyType = 'bundle_bogo'
    bundleOffer = '১টি কিনলে ১টি ফ্রি (Buy 1 Get 1)'
    advice = 'জরুরি সময় (৫ দিন বাকি)। ২৫–৩০% ছাড় বা ১টি কিনলে ১টি ফ্রি বান্ডেল অফারে কাস্টমার টানুন।'
  } else {
    discountPercent = 50
    strategyType = 'flash_clearout'
    bundleOffer = '২টি কিনলে ১টি ফ্রি (Buy 2 Get 1) / ক্লিয়ারেন্স'
    advice = 'অতি জরুরি (<২ দিন)! বিশেষ বান্ডেল বা ফ্ল্যাশ ক্লিয়ারেন্সে শতভাগ মূলধন উদ্ধার করুন, অপচয় রোধ করুন।'
  }

  const effectiveSellingPrice = Math.max(retail * (1 - discountPercent / 100), cost * 0.9)
  const totalRevenue = effectiveSellingPrice * qty
  const totalCost = cost * qty
  const projectedProfitOrLoss = Math.round(totalRevenue - totalCost)

  return {
    batchId: batch.id,
    batchCode: batch.batchCode || `FB-${String(batch.fifoOrder || 1).padStart(3, '0')}`,
    barcode: batch.barcode || `894123456789`,
    productId: batch.id,
    productName: batch.productName,
    fifoOrder: batch.fifoOrder || 1,
    receiveDate: batch.receiveDate || new Date().toISOString().slice(0, 10),
    expiryDate: batch.expiryDate,
    daysUntilExpiry: daysUntil,
    quantity: qty,
    unit,
    purchaseCost: cost,
    retailPrice: retail,
    discountPercent,
    strategyType,
    bundleOffer,
    projectedProfitOrLoss,
    advice,
  }
}

// ─── 5. SMS Generator Helpers ───────────────────────────────────────────────
export function formatCustomerSmsReminder({
  customerName,
  dueAmount,
  shopName = 'হালখাতা স্টোর',
  dueDate,
  tone = 'friendly',
}: {
  customerName: string
  dueAmount: number
  shopName?: string
  dueDate?: string
  tone?: 'friendly' | 'urgent'
}): string {
  if (tone === 'urgent') {
    return `জরুরি তাগাদা: জনাব ${customerName}, ${shopName}-এ আপনার বকেয়া ৳${dueAmount.toLocaleString('en-US')} পরিশোধের সময় পার হয়ে গিয়েছে। অনুগ্রহ করে দ্রুত যোগাযোগ করে বাকি পরিশোধ করুন। ধন্যবাদ।`
  }
  return `প্রিয় গ্রাহক, ${customerName} ভাই, ${shopName} হালখাতা অনুযায়ী আপনার বকেয়া ৳${dueAmount.toLocaleString('en-US')}${dueDate ? ` (পরিশোধের তারিখ: ${dueDate})` : ''}। অনুগ্রহ করে সুবিধাজনক সময়ে পরিশোধ করার অনুরোধ রইল। ধন্যবাদ।`
}

// ─── 6. AI Voice Bookkeeping Natural Language Processing (4.1) ───────────────
export function parseNaturalLanguageTransaction(text: string): VoiceParsedTransaction {
  // Normalize Bengali digits to English
  const bnToEnMap: Record<string, string> = {
    '০': '0', '১': '1', '২': '2', '৩': '3', '৪': '4',
    '৫': '5', '৬': '6', '৭': '7', '৮': '8', '৯': '9'
  }
  let normalized = text.replace(/[০-৯]/g, (match) => bnToEnMap[match] || match).toLowerCase()

  // Convert multipliers like "১৫ হাজার", "5k", "২ লাখ"
  normalized = normalized.replace(/(\d+)\s*(হাজার|hazar|thousand|k)/gi, (_, n) => String(Number(n) * 1000))
  normalized = normalized.replace(/(\d+)\s*(লাখ|lac|lakh)/gi, (_, n) => String(Number(n) * 100000))

  let totalSales: number | undefined = undefined
  let cashReceived: number | undefined = undefined
  let customerCredit: number | undefined = undefined
  let expenseAmount: number | undefined = undefined
  let customerName: string | undefined = undefined
  let expenseCategory: string | undefined = undefined
  const items: string[] = []

  // Extract products mentioned
  const itemKeywords = [
    'চাল', 'ডাল', 'তেল', 'চিনি', 'বান', 'পাউরুটি', 'দুধ', 'মসলা', 'নুডলস', 'বিস্কুট',
    'আটা', 'ময়দা', 'লবণ', 'সেমাই', 'ছোলা', 'খেজুর', 'rice', 'oil', 'sugar', 'bread', 'milk'
  ]
  for (const it of itemKeywords) {
    if (normalized.includes(it)) {
      items.push(it)
    }
  }

  // Detect customer name (e.g., "রহিম ভাই", "করিম সাহেব", "Mr. John")
  const custMatch = normalized.match(/([^\s]+)\s*(ভাই|কাকু|সাহেব|আঙ্কেল|কাস্টমার|mr\.|md\.)/i)
  if (custMatch) {
    customerName = `${custMatch[1]} ${custMatch[2]}`
  }

  // Detect expense
  const isExpense =
    normalized.includes('খরচ') ||
    normalized.includes('বিল') ||
    normalized.includes('ভাড়া') ||
    normalized.includes('ভাড়া') ||
    normalized.includes('বেতন') ||
    normalized.includes('expense') ||
    normalized.includes('rent') ||
    normalized.includes('bill')

  if (isExpense) {
    const expMatch =
      normalized.match(/(\d+)\s*(টাকা|টাকার|tk)?\s*(খরচ|বিল|ভাড়া|ভাড়া|বেতন|expense)/) ||
      normalized.match(/(ভাড়া|ভাড়া|বিল|খরচ|বেতন|expense)\s*(\d+)/) ||
      normalized.match(/(\d+)/)
    if (expMatch) {
      const val = Number(expMatch[1] || expMatch[2])
      if (!isNaN(val) && val > 0) expenseAmount = val
    }

    if (normalized.includes('ভাড়া') || normalized.includes('ভাড়া') || normalized.includes('rent')) {
      expenseCategory = 'rent'
    } else if (normalized.includes('বিল') || normalized.includes('বিদ্যুৎ') || normalized.includes('utility')) {
      expenseCategory = 'utility'
    } else if (normalized.includes('নাস্তা') || normalized.includes('চা') || normalized.includes('snack')) {
      expenseCategory = 'snack'
    } else if (normalized.includes('বেতন') || normalized.includes('salary')) {
      expenseCategory = 'salary'
    } else {
      expenseCategory = 'other'
    }
  }

  // Detect sales, cash, credit
  const salesMatch =
    normalized.match(/(\d+)\s*(টাকা|টাকার|tk)?\s*(বিক্রি|সেল|sales|sold)/) ||
    normalized.match(/(বিক্রি|সেল|sales)\s*(হয়েছে|হলো)?\s*(\d+)/)
  const cashMatch =
    normalized.match(/(\d+)\s*(টাকা|tk)?\s*(ক্যাশ|নগদ|নগদে|cash)/) ||
    normalized.match(/(ক্যাশ|নগদ|cash)\s*(\d+)/)
  const creditMatch =
    normalized.match(/(\d+)\s*(টাকা|tk)?\s*(বাকি|ধার|credit|due)/) ||
    normalized.match(/(বাকি|ধার|credit|due)\s*(\d+)/)

  if (salesMatch) {
    totalSales = Number(salesMatch[1] || salesMatch[3])
  }
  if (cashMatch) {
    cashReceived = Number(cashMatch[1] || cashMatch[2])
  }
  if (creditMatch) {
    customerCredit = Number(creditMatch[1] || creditMatch[2])
  }

  // Fallback pattern parser (e.g. "১৫ হাজার বিক্রি, ৫ হাজার ক্যাশ, ১০ হাজার বাকি")
  const allNumbers = (normalized.match(/\b\d+\b/g) || []).map(Number).filter((n) => n >= 10)
  if (!totalSales && !cashReceived && !customerCredit && !expenseAmount && allNumbers.length > 0) {
    if (allNumbers.length === 3) {
      totalSales = allNumbers[0]
      cashReceived = allNumbers[1]
      customerCredit = allNumbers[2]
    } else if (allNumbers.length === 2 && normalized.includes('বাকি')) {
      cashReceived = allNumbers[0]
      customerCredit = allNumbers[1]
      totalSales = cashReceived + customerCredit
    } else if (normalized.includes('বাকি') || normalized.includes('credit')) {
      customerCredit = allNumbers[0]
    } else if (normalized.includes('খরচ') || normalized.includes('expense')) {
      expenseAmount = allNumbers[0]
    } else {
      totalSales = allNumbers[0]
      cashReceived = allNumbers[0]
    }
  }

  // Reconcile amounts
  if (totalSales && cashReceived !== undefined && customerCredit === undefined) {
    customerCredit = Math.max(0, totalSales - cashReceived)
  } else if (cashReceived !== undefined && customerCredit !== undefined && !totalSales) {
    totalSales = cashReceived + customerCredit
  }

  let type: VoiceParsedTransaction['type'] = 'sale'
  if (expenseAmount) {
    type = 'expense'
  } else if (cashReceived !== undefined && customerCredit && customerCredit > 0) {
    type = 'mixed'
  } else if (customerCredit && customerCredit > 0 && (!cashReceived || cashReceived === 0)) {
    type = 'credit'
  }

  return {
    type,
    rawText: text,
    totalSales,
    cashReceived,
    customerCredit,
    expenseAmount,
    customerName,
    expenseCategory,
    items: items.length > 0 ? items : undefined,
    date: new Date().toISOString().slice(0, 10),
    confidence: (totalSales || expenseAmount || customerCredit) ? 0.95 : 0.6,
  }
}

// ─── 7. Digital Ledger Expenses & Supplier Dues Data (4.2) ───────────────────
export const INITIAL_EXPENSES: Expense[] = [
  {
    id: 'exp-01',
    shopId: 'shop-student-01',
    category: 'rent',
    title: 'দোকান ভাড়া (চলতি মাস)',
    amount: 8000,
    date: new Date().toISOString().slice(0, 10),
    note: 'মার্কেট মালিক সমিতিকে পরিশোধ',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'exp-02',
    shopId: 'shop-student-01',
    category: 'utility',
    title: 'বিদ্যুৎ বিল ও ডেসকো চার্জ',
    amount: 1450,
    date: new Date(Date.now() - 86400000 * 2).toISOString().slice(0, 10),
    note: 'অক্টোবর মাসের বিল',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'exp-03',
    shopId: 'shop-student-01',
    category: 'transport',
    title: 'মোকাম থেকে ভ্যান ও কুলি খরচ',
    amount: 600,
    date: new Date(Date.now() - 86400000 * 4).toISOString().slice(0, 10),
    note: 'চাল ও তেলের বস্তা আনয়ন',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'exp-04',
    shopId: 'shop-student-01',
    category: 'snack',
    title: 'দোকানের চা ও নাস্তা খরচ',
    amount: 250,
    date: new Date().toISOString().slice(0, 10),
    createdAt: new Date().toISOString(),
  },
]

export const INITIAL_SUPPLIER_DUES: SupplierDue[] = [
  {
    id: 'sup-01',
    shopId: 'shop-student-01',
    supplierName: 'তারেক মাহমুদ (এরিয়া ম্যানেজার)',
    companyName: 'মেঘনা গ্রুপ (ফ্রেশ ডিস্ট্রিবিউশন)',
    supplierPhone: '01711-234567',
    amount: 18500,
    paidAmount: 10000,
    dueDate: new Date(Date.now() + 86400000 * 5).toISOString().slice(0, 10),
    status: 'partial',
    note: 'সয়াবিন তেল ও ময়দা চালানের বকেয়া',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'sup-02',
    shopId: 'shop-student-01',
    supplierName: 'কবির হোসেন (ডিলার)',
    companyName: 'আকিজ এসেনশিয়ালস লিমিটেড',
    supplierPhone: '01819-876543',
    amount: 12000,
    paidAmount: 12000,
    dueDate: new Date(Date.now() - 86400000 * 2).toISOString().slice(0, 10),
    status: 'paid',
    note: 'মিনিকেট চাল ২৫ কেজি বস্তা পরিশোধিত',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'sup-03',
    shopId: 'shop-student-01',
    supplierName: 'সোহেল রানা',
    companyName: 'সিটি গ্রুপ (তীর ডিলার)',
    supplierPhone: '01912-345678',
    amount: 9500,
    paidAmount: 0,
    dueDate: new Date(Date.now() + 86400000 * 3).toISOString().slice(0, 10),
    status: 'unpaid',
    note: 'চিনি ও ডাল সরবরাহের পাওনা',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
]
