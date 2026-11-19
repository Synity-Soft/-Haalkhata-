// Haalkhata (হালখাতা) Advanced Retail Features Engine & Mock Data
import type {
  Distributor,
  DistributorPriceComparison,
  PeerShopExchange,
  BatchStrategySuggestion,
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
 */
export function generateBatchCode(productName: string, batchNumber: number = 1): {
  batchCode: string
  barcode: string
} {
  const prefix = productName.slice(0, 3).toUpperCase().replace(/[^A-Z]/g, 'PRD') || 'BAT'
  const dateStr = new Date().toISOString().slice(2, 10).replace(/-/g, '')
  const batchCode = `BATCH-${prefix}-${dateStr}-B${batchNumber}`
  const barcode = `894${Math.floor(100000000 + Math.random() * 900000000)}`
  return { batchCode, barcode }
}

/**
 * Computes business-driven dynamic clearance strategies to prevent food/grocery loss
 * FIFO Priority: Earlier batch released first
 * Discount Escalation:
 *   - > 15 days: 10% discount (Early clearance)
 *   - 8-15 days: 20% discount (Accelerate sell-through)
 *   - 3-7 days:  30% discount + Buy 1 Get 1 (BOGO)
 *   - <= 2 days: 50% discount + Buy 1 Get 3 / Flash clear-out (Capital recovery, 0 loss)
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

  const cost = batch.purchasePrice || 80
  const retail = batch.sellingPrice || Math.round(cost * 1.25)
  const qty = batch.quantity || 1
  const unit = batch.unit || 'পিস'

  let discountPercent = 0
  let strategyType: BatchStrategySuggestion['strategyType'] = 'standard'
  let bundleOffer: string | undefined = undefined
  let advice = ''

  if (daysUntil > 15) {
    discountPercent = 10
    strategyType = 'early_clearance'
    advice = '১৫ দিন সময় আছে। ১০% ছাড়ে পণ্যটি দ্রুত বিক্রয় নিশ্চিত করুন।'
  } else if (daysUntil >= 8 && daysUntil <= 15) {
    discountPercent = 20
    strategyType = 'early_clearance'
    advice = 'মেয়াদ ঘনিয়ে আসছে (৮-১৫ দিন)। ২০% ছাড় কার্যকর করে স্টক খালি করুন।'
  } else if (daysUntil >= 3 && daysUntil <= 7) {
    discountPercent = 30
    strategyType = 'bundle_bogo'
    bundleOffer = '১টি কিনলে ১টি ফ্রি (Buy 1 Get 1)'
    advice = 'জরুরি সময় (৩-৭ দিন)। ৩০% ছাড় বা ১টি কিনলে ১টি ফ্রি অফার দিয়ে ক্রেতাকে আকৃষ্ট করুন।'
  } else {
    discountPercent = 50
    strategyType = 'flash_clearout'
    bundleOffer = '১টি কিনলে ৩টি ফ্রি (Buy 1 Get 3)'
    advice = 'অতি জরুরি (<২ দিন)! ৫০% ফ্ল্যাশ সেল বা বান্ডেল অফারে মূলধন রক্ষা করুন, পণ্য নষ্ট হওয়া রোধ করুন।'
  }

  const effectiveSellingPrice = Math.max(retail * (1 - discountPercent / 100), cost * 0.9)
  const totalRevenue = effectiveSellingPrice * qty
  const totalCost = cost * qty
  const projectedProfitOrLoss = Math.round(totalRevenue - totalCost)

  return {
    batchId: batch.id,
    batchCode: batch.batchCode || `BATCH-${batch.id.slice(0, 8)}`,
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
  return `আসসালামু আলাইকুম ${customerName} ভাই, ${shopName} হালখাতা অনুযায়ী আপনার বকেয়া ৳${dueAmount.toLocaleString('en-US')}${dueDate ? ` (পরিশোধের তারিখ: ${dueDate})` : ''}। সুবিধাজনক সময়ে পরিশোধ করার বিনীত অনুরোধ। ধন্যবাদ।`
}
