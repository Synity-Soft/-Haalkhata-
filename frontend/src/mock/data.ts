/**
 * Mock / demo data for Haat-Bazaar
 * Three shops — student area (Mirpur), garment-worker area (Ashulia),
 * affluent area (Gulshan).  All prices in BDT (Bangladeshi Taka).
 *
 * Sales history spans ~90 days with day-of-week and festival variation.
 * Batch expiry dates span all risk tiers: expired / high / medium / low risk.
 */
import type { Shop, Product, Batch, Sale, Credit } from '@/types'

// ─── Reference date (treat as "today" for expiry calculations) ───────────────
const REF = new Date()

function daysFromRef(offset: number): string {
  const d = new Date(REF)
  d.setDate(d.getDate() + offset)
  return d.toISOString().split('T')[0]
}

// ─── Shops ────────────────────────────────────────────────────────────────────

export const mockShops: Shop[] = [
  {
    id: 'shop-student-01',
    name: '৯/এ, ধানমন্ডি',
    nameEn: '9/A, Dhanmondi',
    area: 'Dhanmondi, Dhaka',
    ownerName: 'Shop Owner',
    phone: '01711-234567',
    address: 'Road 9/A, Dhanmondi, Dhaka-1209',
    lat: 23.7465,
    lng: 90.3760,
    currency: 'BDT',
    updatedAt: '2026-11-01T00:00:00.000Z',
    deleted: 0,
  },
  {
    id: 'shop-garment-01',
    name: 'মিরপুর-১০ শাখা',
    nameEn: 'Mirpur-10 Branch',
    area: 'Mirpur-10, Dhaka',
    ownerName: 'Shop Owner',
    phone: '01812-345678',
    address: 'Block-D, Mirpur-10, Dhaka-1216',
    lat: 23.8081,
    lng: 90.3673,
    currency: 'BDT',
    updatedAt: '2026-11-01T00:00:00.000Z',
    deleted: 0,
  },
  {
    id: 'shop-affluent-01',
    name: 'গুলশান-২ শাখা',
    nameEn: 'Gulshan-2 Branch',
    area: 'Gulshan-2, Dhaka',
    ownerName: 'Shop Owner',
    phone: '01911-456789',
    address: 'Road 53, Gulshan-2, Dhaka-1212',
    lat: 23.7961,
    lng: 90.4149,
    currency: 'BDT',
    updatedAt: '2026-11-01T00:00:00.000Z',
    deleted: 0,
  },
]

// ─── Products ─────────────────────────────────────────────────────────────────

export const mockProducts: Product[] = [
  // ── Shop 1: Mirpur Student ────────────────────────────────────────────────
  {
    id: 'prod-s1-rice-mini',
    shopId: 'shop-student-01',
    name: 'মিনিকেট চাল',
    nameEn: 'Miniket Rice',
    category: 'grain',
    unit: 'kg',
    unitSize: 1,
    pricePerUnit: 72,
    lowStockThreshold: 20,
    imageEmoji: '🌾',
    updatedAt: '2026-11-01T00:00:00.000Z',
    deleted: 0,
  },
  {
    id: 'prod-s1-soybean',
    shopId: 'shop-student-01',
    name: 'সয়াবিন তেল',
    nameEn: 'Soybean Oil',
    category: 'oil',
    unit: 'litre',
    unitSize: 1,
    pricePerUnit: 165,
    lowStockThreshold: 10,
    imageEmoji: '🫙',
    updatedAt: '2026-11-01T00:00:00.000Z',
    deleted: 0,
  },
  {
    id: 'prod-s1-milk-powder',
    shopId: 'shop-student-01',
    name: 'গুড়ো দুধ (ডিপ্লোমা)',
    nameEn: 'Diploma Milk Powder',
    category: 'dairy',
    unit: 'packet',
    unitSize: 1,
    pricePerUnit: 55,
    lowStockThreshold: 15,
    imageEmoji: '🥛',
    updatedAt: '2026-11-01T00:00:00.000Z',
    deleted: 0,
  },
  {
    id: 'prod-s1-turmeric',
    shopId: 'shop-student-01',
    name: 'হলুদ গুঁড়া',
    nameEn: 'Turmeric Powder',
    category: 'spices',
    unit: 'packet',
    unitSize: 1,
    pricePerUnit: 45,
    lowStockThreshold: 10,
    imageEmoji: '🫛',
    updatedAt: '2026-11-01T00:00:00.000Z',
    deleted: 0,
  },
  {
    id: 'prod-s1-tea',
    shopId: 'shop-student-01',
    name: 'ইস্পাহানি চা',
    nameEn: 'Ispahani Tea',
    category: 'beverages',
    unit: 'packet',
    unitSize: 1,
    pricePerUnit: 90,
    lowStockThreshold: 10,
    imageEmoji: '🍵',
    updatedAt: '2026-11-01T00:00:00.000Z',
    deleted: 0,
  },
  {
    id: 'prod-s1-biscuit',
    shopId: 'shop-student-01',
    name: 'টাইগার বিস্কুট',
    nameEn: 'Tiger Biscuit',
    category: 'snacks',
    unit: 'pcs',
    unitSize: 1,
    pricePerUnit: 10,
    lowStockThreshold: 50,
    imageEmoji: '🍪',
    updatedAt: '2026-11-01T00:00:00.000Z',
    deleted: 0,
  },
  {
    id: 'prod-s1-potato',
    shopId: 'shop-student-01',
    name: 'আলু',
    nameEn: 'Potato',
    category: 'vegetables',
    unit: 'kg',
    unitSize: 1,
    pricePerUnit: 38,
    lowStockThreshold: 15,
    imageEmoji: '🥔',
    updatedAt: '2026-11-01T00:00:00.000Z',
    deleted: 0,
  },
  {
    id: 'prod-s1-soap',
    shopId: 'shop-student-01',
    name: 'লাক্স সাবান',
    nameEn: 'Lux Soap',
    category: 'cleaning',
    unit: 'pcs',
    unitSize: 1,
    pricePerUnit: 40,
    lowStockThreshold: 20,
    imageEmoji: '🧼',
    updatedAt: '2026-11-01T00:00:00.000Z',
    deleted: 0,
  },
  {
    id: 'prod-s1-lentil',
    shopId: 'shop-student-01',
    name: 'মসুর ডাল',
    nameEn: 'Red Lentil',
    category: 'grain',
    unit: 'kg',
    unitSize: 1,
    pricePerUnit: 115,
    lowStockThreshold: 10,
    imageEmoji: '🫘',
    updatedAt: '2026-11-01T00:00:00.000Z',
    deleted: 0,
  },

  // ── Shop 2: Ashulia Garment Workers ───────────────────────────────────────
  {
    id: 'prod-s2-coarse-rice',
    shopId: 'shop-garment-01',
    name: 'মোটা চাল (পাইজাম)',
    nameEn: 'Coarse Rice (Paijam)',
    category: 'grain',
    unit: 'kg',
    unitSize: 1,
    pricePerUnit: 55,
    lowStockThreshold: 30,
    imageEmoji: '🌾',
    updatedAt: '2026-11-01T00:00:00.000Z',
    deleted: 0,
  },
  {
    id: 'prod-s2-palm-oil',
    shopId: 'shop-garment-01',
    name: 'পাম অয়েল',
    nameEn: 'Palm Oil',
    category: 'oil',
    unit: 'litre',
    unitSize: 1,
    pricePerUnit: 130,
    lowStockThreshold: 10,
    imageEmoji: '🫙',
    updatedAt: '2026-11-01T00:00:00.000Z',
    deleted: 0,
  },
  {
    id: 'prod-s2-fresh-milk',
    shopId: 'shop-garment-01',
    name: 'টাটকা দুধ',
    nameEn: 'Fresh Cow Milk',
    category: 'dairy',
    unit: 'litre',
    unitSize: 1,
    pricePerUnit: 90,
    lowStockThreshold: 5,
    imageEmoji: '🥛',
    updatedAt: '2026-11-01T00:00:00.000Z',
    deleted: 0,
  },
  {
    id: 'prod-s2-chili',
    shopId: 'shop-garment-01',
    name: 'মরিচ গুঁড়া',
    nameEn: 'Red Chili Powder',
    category: 'spices',
    unit: 'packet',
    unitSize: 1,
    pricePerUnit: 50,
    lowStockThreshold: 10,
    imageEmoji: '🌶️',
    updatedAt: '2026-11-01T00:00:00.000Z',
    deleted: 0,
  },
  {
    id: 'prod-s2-tea-loose',
    shopId: 'shop-garment-01',
    name: 'খোলা চা (ব্লেন্ড)',
    nameEn: 'Loose Tea Blend',
    category: 'beverages',
    unit: 'kg',
    unitSize: 1,
    pricePerUnit: 320,
    lowStockThreshold: 5,
    imageEmoji: '🍵',
    updatedAt: '2026-11-01T00:00:00.000Z',
    deleted: 0,
  },
  {
    id: 'prod-s2-chanachur',
    shopId: 'shop-garment-01',
    name: 'ঝাল চানাচুর',
    nameEn: 'Spicy Chanachur',
    category: 'snacks',
    unit: 'packet',
    unitSize: 1,
    pricePerUnit: 20,
    lowStockThreshold: 30,
    imageEmoji: '🫙',
    updatedAt: '2026-11-01T00:00:00.000Z',
    deleted: 0,
  },
  {
    id: 'prod-s2-onion',
    shopId: 'shop-garment-01',
    name: 'পেঁয়াজ',
    nameEn: 'Onion',
    category: 'vegetables',
    unit: 'kg',
    unitSize: 1,
    pricePerUnit: 60,
    lowStockThreshold: 10,
    imageEmoji: '🧅',
    updatedAt: '2026-11-01T00:00:00.000Z',
    deleted: 0,
  },
  {
    id: 'prod-s2-detergent',
    shopId: 'shop-garment-01',
    name: 'হুইল ওয়াশিং পাউডার',
    nameEn: 'Wheel Washing Powder',
    category: 'cleaning',
    unit: 'packet',
    unitSize: 1,
    pricePerUnit: 65,
    lowStockThreshold: 15,
    imageEmoji: '🧺',
    updatedAt: '2026-11-01T00:00:00.000Z',
    deleted: 0,
  },
  {
    id: 'prod-s2-mustard-oil',
    shopId: 'shop-garment-01',
    name: 'সরিষার তেল',
    nameEn: 'Mustard Oil',
    category: 'oil',
    unit: 'litre',
    unitSize: 1,
    pricePerUnit: 220,
    lowStockThreshold: 5,
    imageEmoji: '🫙',
    updatedAt: '2026-11-01T00:00:00.000Z',
    deleted: 0,
  },

  // ── Shop 3: Gulshan Affluent ───────────────────────────────────────────────
  {
    id: 'prod-s3-basmati',
    shopId: 'shop-affluent-01',
    name: 'বাসমতি চাল (প্রিমিয়াম)',
    nameEn: 'Premium Basmati Rice',
    category: 'grain',
    unit: 'kg',
    unitSize: 1,
    pricePerUnit: 180,
    lowStockThreshold: 10,
    imageEmoji: '🌾',
    updatedAt: '2026-11-01T00:00:00.000Z',
    deleted: 0,
  },
  {
    id: 'prod-s3-olive-oil',
    shopId: 'shop-affluent-01',
    name: 'অলিভ অয়েল (এক্সট্রা ভার্জিন)',
    nameEn: 'Extra Virgin Olive Oil',
    category: 'oil',
    unit: 'litre',
    unitSize: 1,
    pricePerUnit: 950,
    lowStockThreshold: 5,
    imageEmoji: '🫒',
    updatedAt: '2026-11-01T00:00:00.000Z',
    deleted: 0,
  },
  {
    id: 'prod-s3-uht-milk',
    shopId: 'shop-affluent-01',
    name: 'আড়ং ফুল ক্রিম মিল্ক (ইউএইচটি)',
    nameEn: 'Aarong Full Cream UHT Milk',
    category: 'dairy',
    unit: 'litre',
    unitSize: 1,
    pricePerUnit: 125,
    lowStockThreshold: 10,
    imageEmoji: '🥛',
    updatedAt: '2026-11-01T00:00:00.000Z',
    deleted: 0,
  },
  {
    id: 'prod-s3-saffron',
    shopId: 'shop-affluent-01',
    name: 'জাফরান',
    nameEn: 'Saffron',
    category: 'spices',
    unit: 'pcs',
    unitSize: 1,
    pricePerUnit: 850,
    lowStockThreshold: 5,
    imageEmoji: '🌸',
    updatedAt: '2026-11-01T00:00:00.000Z',
    deleted: 0,
  },
  {
    id: 'prod-s3-green-tea',
    shopId: 'shop-affluent-01',
    name: 'অর্গানিক গ্রিন টি',
    nameEn: 'Organic Green Tea',
    category: 'beverages',
    unit: 'packet',
    unitSize: 1,
    pricePerUnit: 380,
    lowStockThreshold: 5,
    imageEmoji: '🍵',
    updatedAt: '2026-11-01T00:00:00.000Z',
    deleted: 0,
  },
  {
    id: 'prod-s3-granola',
    shopId: 'shop-affluent-01',
    name: 'গ্র্যানোলা বার',
    nameEn: 'Granola Bar (Imported)',
    category: 'snacks',
    unit: 'pcs',
    unitSize: 1,
    pricePerUnit: 120,
    lowStockThreshold: 10,
    imageEmoji: '🍫',
    updatedAt: '2026-11-01T00:00:00.000Z',
    deleted: 0,
  },
  {
    id: 'prod-s3-broccoli',
    shopId: 'shop-affluent-01',
    name: 'ব্রোকলি',
    nameEn: 'Broccoli',
    category: 'vegetables',
    unit: 'pcs',
    unitSize: 1,
    pricePerUnit: 90,
    lowStockThreshold: 5,
    imageEmoji: '🥦',
    updatedAt: '2026-11-01T00:00:00.000Z',
    deleted: 0,
  },
  {
    id: 'prod-s3-dishwasher',
    shopId: 'shop-affluent-01',
    name: 'ভিম লিকুইড ডিশওয়াশ',
    nameEn: 'Vim Liquid Dishwash',
    category: 'cleaning',
    unit: 'litre',
    unitSize: 1,
    pricePerUnit: 220,
    lowStockThreshold: 5,
    imageEmoji: '🧴',
    updatedAt: '2026-11-01T00:00:00.000Z',
    deleted: 0,
  },
  {
    id: 'prod-s3-yogurt',
    shopId: 'shop-affluent-01',
    name: 'টক দই (প্রাণ)',
    nameEn: 'Pran Yogurt',
    category: 'dairy',
    unit: 'packet',
    unitSize: 1,
    pricePerUnit: 60,
    lowStockThreshold: 10,
    imageEmoji: '🫙',
    updatedAt: '2026-11-01T00:00:00.000Z',
    deleted: 0,
  },
]

// ─── Batches ──────────────────────────────────────────────────────────────────
// Risk tiers relative to REF (2026-11-16):
//   expired  = expiry < today          (e.g. daysFromRef(-5))
//   high     = expires within 3 days   (daysFromRef(1..3))
//   medium   = expires in 4–7 days     (daysFromRef(4..7))
//   low      = expires in 8–14 days    (daysFromRef(8..14))
//   safe     = expires in 15+ days

export const mockBatches: Batch[] = [
  // ─── Shop 1 batches ─────────────────────────────────────────────────────
  {
    id: 'batch-s1-rice-01',
    productId: 'prod-s1-rice-mini',
    shopId: 'shop-student-01',
    quantity: 100,
    purchasePrice: 65,
    purchaseDate: daysFromRef(-45),
    expiryDate: daysFromRef(180),   // safe – packaged rice
    supplierName: 'ময়মনসিংহ রাইস মিল',
    updatedAt: '2026-11-01T00:00:00.000Z',
    deleted: 0,
  },
  {
    id: 'batch-s1-rice-02',
    productId: 'prod-s1-rice-mini',
    shopId: 'shop-student-01',
    quantity: 50,
    purchasePrice: 67,
    purchaseDate: daysFromRef(-10),
    expiryDate: daysFromRef(200),   // safe
    supplierName: 'ময়মনসিংহ রাইস মিল',
    updatedAt: '2026-11-01T00:00:00.000Z',
    deleted: 0,
  },
  {
    id: 'batch-s1-oil-01',
    productId: 'prod-s1-soybean',
    shopId: 'shop-student-01',
    quantity: 30,
    purchasePrice: 150,
    purchaseDate: daysFromRef(-60),
    expiryDate: daysFromRef(-5),    // ⚠️ EXPIRED
    supplierName: 'TK Food Products',
    updatedAt: '2026-11-01T00:00:00.000Z',
    deleted: 0,
  },
  {
    id: 'batch-s1-oil-02',
    productId: 'prod-s1-soybean',
    shopId: 'shop-student-01',
    quantity: 24,
    purchasePrice: 155,
    purchaseDate: daysFromRef(-15),
    expiryDate: daysFromRef(90),    // safe
    supplierName: 'TK Food Products',
    updatedAt: '2026-11-01T00:00:00.000Z',
    deleted: 0,
  },
  {
    id: 'batch-s1-milk-01',
    productId: 'prod-s1-milk-powder',
    shopId: 'shop-student-01',
    quantity: 40,
    purchasePrice: 48,
    purchaseDate: daysFromRef(-20),
    expiryDate: daysFromRef(2),     // 🔴 HIGH RISK (2 days)
    supplierName: 'BRAC Dairy',
    updatedAt: '2026-11-01T00:00:00.000Z',
    deleted: 0,
  },
  {
    id: 'batch-s1-milk-02',
    productId: 'prod-s1-milk-powder',
    shopId: 'shop-student-01',
    quantity: 30,
    purchasePrice: 50,
    purchaseDate: daysFromRef(-5),
    expiryDate: daysFromRef(120),   // safe
    supplierName: 'BRAC Dairy',
    updatedAt: '2026-11-01T00:00:00.000Z',
    deleted: 0,
  },
  {
    id: 'batch-s1-turmeric-01',
    productId: 'prod-s1-turmeric',
    shopId: 'shop-student-01',
    quantity: 50,
    purchasePrice: 38,
    purchaseDate: daysFromRef(-30),
    expiryDate: daysFromRef(6),     // 🟡 MEDIUM RISK (6 days)
    supplierName: 'বগুড়া মশলা হাউস',
    updatedAt: '2026-11-01T00:00:00.000Z',
    deleted: 0,
  },
  {
    id: 'batch-s1-tea-01',
    productId: 'prod-s1-tea',
    shopId: 'shop-student-01',
    quantity: 60,
    purchasePrice: 80,
    purchaseDate: daysFromRef(-45),
    expiryDate: daysFromRef(10),    // 🟠 LOW RISK (10 days)
    supplierName: 'Ispahani Mirza & Sons',
    updatedAt: '2026-11-01T00:00:00.000Z',
    deleted: 0,
  },
  {
    id: 'batch-s1-biscuit-01',
    productId: 'prod-s1-biscuit',
    shopId: 'shop-student-01',
    quantity: 200,
    purchasePrice: 8,
    purchaseDate: daysFromRef(-10),
    expiryDate: daysFromRef(3),     // 🔴 HIGH RISK (3 days)
    supplierName: 'Olympic Industries',
    updatedAt: '2026-11-01T00:00:00.000Z',
    deleted: 0,
  },
  {
    id: 'batch-s1-biscuit-02',
    productId: 'prod-s1-biscuit',
    shopId: 'shop-student-01',
    quantity: 300,
    purchasePrice: 8,
    purchaseDate: daysFromRef(-3),
    expiryDate: daysFromRef(90),    // safe
    supplierName: 'Olympic Industries',
    updatedAt: '2026-11-01T00:00:00.000Z',
    deleted: 0,
  },
  {
    id: 'batch-s1-potato-01',
    productId: 'prod-s1-potato',
    shopId: 'shop-student-01',
    quantity: 80,
    purchasePrice: 32,
    purchaseDate: daysFromRef(-7),
    expiryDate: daysFromRef(14),    // 🟠 LOW RISK (14 days)
    supplierName: 'মুন্সিগঞ্জ আলু ব্যবসায়ী',
    updatedAt: '2026-11-01T00:00:00.000Z',
    deleted: 0,
  },
  {
    id: 'batch-s1-soap-01',
    productId: 'prod-s1-soap',
    shopId: 'shop-student-01',
    quantity: 100,
    purchasePrice: 34,
    purchaseDate: daysFromRef(-60),
    expiryDate: daysFromRef(365),   // safe
    supplierName: 'Unilever Bangladesh',
    updatedAt: '2026-11-01T00:00:00.000Z',
    deleted: 0,
  },
  {
    id: 'batch-s1-lentil-01',
    productId: 'prod-s1-lentil',
    shopId: 'shop-student-01',
    quantity: 50,
    purchasePrice: 105,
    purchaseDate: daysFromRef(-20),
    expiryDate: daysFromRef(340),   // safe (dried legume)
    supplierName: 'চট্টগ্রাম ডাল মিল',
    updatedAt: '2026-11-01T00:00:00.000Z',
    deleted: 0,
  },

  // ─── Shop 2 batches ─────────────────────────────────────────────────────
  {
    id: 'batch-s2-crice-01',
    productId: 'prod-s2-coarse-rice',
    shopId: 'shop-garment-01',
    quantity: 200,
    purchasePrice: 48,
    purchaseDate: daysFromRef(-30),
    expiryDate: daysFromRef(240),   // safe
    supplierName: 'গাজীপুর রাইস মিল',
    updatedAt: '2026-11-01T00:00:00.000Z',
    deleted: 0,
  },
  {
    id: 'batch-s2-palm-01',
    productId: 'prod-s2-palm-oil',
    shopId: 'shop-garment-01',
    quantity: 50,
    purchasePrice: 118,
    purchaseDate: daysFromRef(-55),
    expiryDate: daysFromRef(-8),    // ⚠️ EXPIRED
    supplierName: 'City Group',
    updatedAt: '2026-11-01T00:00:00.000Z',
    deleted: 0,
  },
  {
    id: 'batch-s2-palm-02',
    productId: 'prod-s2-palm-oil',
    shopId: 'shop-garment-01',
    quantity: 40,
    purchasePrice: 122,
    purchaseDate: daysFromRef(-12),
    expiryDate: daysFromRef(85),    // safe
    supplierName: 'City Group',
    updatedAt: '2026-11-01T00:00:00.000Z',
    deleted: 0,
  },
  {
    id: 'batch-s2-milk-01',
    productId: 'prod-s2-fresh-milk',
    shopId: 'shop-garment-01',
    quantity: 20,
    purchasePrice: 80,
    purchaseDate: daysFromRef(-2),
    expiryDate: daysFromRef(1),     // 🔴 HIGH RISK (1 day) — fresh milk
    supplierName: 'স্থানীয় খামার',
    updatedAt: '2026-11-01T00:00:00.000Z',
    deleted: 0,
  },
  {
    id: 'batch-s2-chili-01',
    productId: 'prod-s2-chili',
    shopId: 'shop-garment-01',
    quantity: 60,
    purchasePrice: 42,
    purchaseDate: daysFromRef(-40),
    expiryDate: daysFromRef(5),     // 🟡 MEDIUM RISK (5 days)
    supplierName: 'বগুড়া মশলা হাউস',
    updatedAt: '2026-11-01T00:00:00.000Z',
    deleted: 0,
  },
  {
    id: 'batch-s2-tea-01',
    productId: 'prod-s2-tea-loose',
    shopId: 'shop-garment-01',
    quantity: 10,
    purchasePrice: 290,
    purchaseDate: daysFromRef(-20),
    expiryDate: daysFromRef(180),   // safe
    supplierName: 'সিলেট টি গার্ডেন',
    updatedAt: '2026-11-01T00:00:00.000Z',
    deleted: 0,
  },
  {
    id: 'batch-s2-chanachur-01',
    productId: 'prod-s2-chanachur',
    shopId: 'shop-garment-01',
    quantity: 150,
    purchasePrice: 16,
    purchaseDate: daysFromRef(-15),
    expiryDate: daysFromRef(7),     // 🟡 MEDIUM RISK (7 days)
    supplierName: 'Pran Foods',
    updatedAt: '2026-11-01T00:00:00.000Z',
    deleted: 0,
  },
  {
    id: 'batch-s2-chanachur-02',
    productId: 'prod-s2-chanachur',
    shopId: 'shop-garment-01',
    quantity: 200,
    purchasePrice: 16,
    purchaseDate: daysFromRef(-3),
    expiryDate: daysFromRef(90),    // safe
    supplierName: 'Pran Foods',
    updatedAt: '2026-11-01T00:00:00.000Z',
    deleted: 0,
  },
  {
    id: 'batch-s2-onion-01',
    productId: 'prod-s2-onion',
    shopId: 'shop-garment-01',
    quantity: 100,
    purchasePrice: 52,
    purchaseDate: daysFromRef(-8),
    expiryDate: daysFromRef(12),    // 🟠 LOW RISK (12 days)
    supplierName: 'পাবনা পেঁয়াজ আড়ৎ',
    updatedAt: '2026-11-01T00:00:00.000Z',
    deleted: 0,
  },
  {
    id: 'batch-s2-detergent-01',
    productId: 'prod-s2-detergent',
    shopId: 'shop-garment-01',
    quantity: 80,
    purchasePrice: 55,
    purchaseDate: daysFromRef(-45),
    expiryDate: daysFromRef(270),   // safe
    supplierName: 'Unilever Bangladesh',
    updatedAt: '2026-11-01T00:00:00.000Z',
    deleted: 0,
  },
  {
    id: 'batch-s2-mustard-01',
    productId: 'prod-s2-mustard-oil',
    shopId: 'shop-garment-01',
    quantity: 20,
    purchasePrice: 200,
    purchaseDate: daysFromRef(-25),
    expiryDate: daysFromRef(-3),    // ⚠️ EXPIRED
    supplierName: 'পুষ্টি সরিষা মিল',
    updatedAt: '2026-11-01T00:00:00.000Z',
    deleted: 0,
  },
  {
    id: 'batch-s2-mustard-02',
    productId: 'prod-s2-mustard-oil',
    shopId: 'shop-garment-01',
    quantity: 15,
    purchasePrice: 205,
    purchaseDate: daysFromRef(-5),
    expiryDate: daysFromRef(120),   // safe
    supplierName: 'পুষ্টি সরিষা মিল',
    updatedAt: '2026-11-01T00:00:00.000Z',
    deleted: 0,
  },

  // ─── Shop 3 batches ─────────────────────────────────────────────────────
  {
    id: 'batch-s3-basmati-01',
    productId: 'prod-s3-basmati',
    shopId: 'shop-affluent-01',
    quantity: 30,
    purchasePrice: 155,
    purchaseDate: daysFromRef(-20),
    expiryDate: daysFromRef(365),   // safe
    supplierName: 'India Import (Pran)',
    updatedAt: '2026-11-01T00:00:00.000Z',
    deleted: 0,
  },
  {
    id: 'batch-s3-olive-01',
    productId: 'prod-s3-olive-oil',
    shopId: 'shop-affluent-01',
    quantity: 12,
    purchasePrice: 850,
    purchaseDate: daysFromRef(-50),
    expiryDate: daysFromRef(9),     // 🟠 LOW RISK (9 days)
    supplierName: 'Mediterranean Imports',
    updatedAt: '2026-11-01T00:00:00.000Z',
    deleted: 0,
  },
  {
    id: 'batch-s3-olive-02',
    productId: 'prod-s3-olive-oil',
    shopId: 'shop-affluent-01',
    quantity: 10,
    purchasePrice: 870,
    purchaseDate: daysFromRef(-10),
    expiryDate: daysFromRef(400),   // safe
    supplierName: 'Mediterranean Imports',
    updatedAt: '2026-11-01T00:00:00.000Z',
    deleted: 0,
  },
  {
    id: 'batch-s3-uht-01',
    productId: 'prod-s3-uht-milk',
    shopId: 'shop-affluent-01',
    quantity: 48,
    purchasePrice: 110,
    purchaseDate: daysFromRef(-30),
    expiryDate: daysFromRef(2),     // 🔴 HIGH RISK (2 days)
    supplierName: 'Aarong Dairy',
    updatedAt: '2026-11-01T00:00:00.000Z',
    deleted: 0,
  },
  {
    id: 'batch-s3-uht-02',
    productId: 'prod-s3-uht-milk',
    shopId: 'shop-affluent-01',
    quantity: 60,
    purchasePrice: 112,
    purchaseDate: daysFromRef(-5),
    expiryDate: daysFromRef(90),    // safe
    supplierName: 'Aarong Dairy',
    updatedAt: '2026-11-01T00:00:00.000Z',
    deleted: 0,
  },
  {
    id: 'batch-s3-saffron-01',
    productId: 'prod-s3-saffron',
    shopId: 'shop-affluent-01',
    quantity: 20,
    purchasePrice: 750,
    purchaseDate: daysFromRef(-60),
    expiryDate: daysFromRef(-12),   // ⚠️ EXPIRED
    supplierName: 'Iran Direct Import',
    updatedAt: '2026-11-01T00:00:00.000Z',
    deleted: 0,
  },
  {
    id: 'batch-s3-saffron-02',
    productId: 'prod-s3-saffron',
    shopId: 'shop-affluent-01',
    quantity: 15,
    purchasePrice: 780,
    purchaseDate: daysFromRef(-7),
    expiryDate: daysFromRef(730),   // safe (shelf-stable spice)
    supplierName: 'Iran Direct Import',
    updatedAt: '2026-11-01T00:00:00.000Z',
    deleted: 0,
  },
  {
    id: 'batch-s3-greentea-01',
    productId: 'prod-s3-green-tea',
    shopId: 'shop-affluent-01',
    quantity: 25,
    purchasePrice: 340,
    purchaseDate: daysFromRef(-35),
    expiryDate: daysFromRef(4),     // 🟡 MEDIUM RISK (4 days)
    supplierName: 'Organic Valley BD',
    updatedAt: '2026-11-01T00:00:00.000Z',
    deleted: 0,
  },
  {
    id: 'batch-s3-granola-01',
    productId: 'prod-s3-granola',
    shopId: 'shop-affluent-01',
    quantity: 40,
    purchasePrice: 100,
    purchaseDate: daysFromRef(-20),
    expiryDate: daysFromRef(13),    // 🟠 LOW RISK (13 days)
    supplierName: 'Nature Valley (Import)',
    updatedAt: '2026-11-01T00:00:00.000Z',
    deleted: 0,
  },
  {
    id: 'batch-s3-broccoli-01',
    productId: 'prod-s3-broccoli',
    shopId: 'shop-affluent-01',
    quantity: 30,
    purchasePrice: 75,
    purchaseDate: daysFromRef(-3),
    expiryDate: daysFromRef(4),     // 🟡 MEDIUM RISK (4 days)
    supplierName: 'Narsingdi Fresh Farm',
    updatedAt: '2026-11-01T00:00:00.000Z',
    deleted: 0,
  },
  {
    id: 'batch-s3-dishwash-01',
    productId: 'prod-s3-dishwasher',
    shopId: 'shop-affluent-01',
    quantity: 24,
    purchasePrice: 195,
    purchaseDate: daysFromRef(-40),
    expiryDate: daysFromRef(320),   // safe
    supplierName: 'Hindustan Unilever',
    updatedAt: '2026-11-01T00:00:00.000Z',
    deleted: 0,
  },
  {
    id: 'batch-s3-yogurt-01',
    productId: 'prod-s3-yogurt',
    shopId: 'shop-affluent-01',
    quantity: 36,
    purchasePrice: 50,
    purchaseDate: daysFromRef(-6),
    expiryDate: daysFromRef(1),     // 🔴 HIGH RISK (1 day)
    supplierName: 'Pran Agro Ltd',
    updatedAt: '2026-11-01T00:00:00.000Z',
    deleted: 0,
  },
]

// ─── Sales history generator ──────────────────────────────────────────────────

interface SaleSpec {
  shopId: string
  productId: string
  batchId: string
  price: number
  baseQty: number    // typical daily quantity sold
}

const saleSpecs: SaleSpec[] = [
  // Shop 1
  { shopId: 'shop-student-01', productId: 'prod-s1-rice-mini',   batchId: 'batch-s1-rice-01',   price: 72,  baseQty: 8 },
  { shopId: 'shop-student-01', productId: 'prod-s1-soybean',     batchId: 'batch-s1-oil-02',    price: 165, baseQty: 3 },
  { shopId: 'shop-student-01', productId: 'prod-s1-milk-powder', batchId: 'batch-s1-milk-01',   price: 55,  baseQty: 4 },
  { shopId: 'shop-student-01', productId: 'prod-s1-turmeric',    batchId: 'batch-s1-turmeric-01',price: 45, baseQty: 3 },
  { shopId: 'shop-student-01', productId: 'prod-s1-tea',         batchId: 'batch-s1-tea-01',    price: 90,  baseQty: 5 },
  { shopId: 'shop-student-01', productId: 'prod-s1-biscuit',     batchId: 'batch-s1-biscuit-02',price: 10,  baseQty: 25 },
  { shopId: 'shop-student-01', productId: 'prod-s1-potato',      batchId: 'batch-s1-potato-01', price: 38,  baseQty: 6 },
  { shopId: 'shop-student-01', productId: 'prod-s1-soap',        batchId: 'batch-s1-soap-01',   price: 40,  baseQty: 5 },
  { shopId: 'shop-student-01', productId: 'prod-s1-lentil',      batchId: 'batch-s1-lentil-01', price: 115, baseQty: 4 },

  // Shop 2
  { shopId: 'shop-garment-01', productId: 'prod-s2-coarse-rice', batchId: 'batch-s2-crice-01',  price: 55,  baseQty: 15 },
  { shopId: 'shop-garment-01', productId: 'prod-s2-palm-oil',    batchId: 'batch-s2-palm-02',   price: 130, baseQty: 5 },
  { shopId: 'shop-garment-01', productId: 'prod-s2-fresh-milk',  batchId: 'batch-s2-milk-01',   price: 90,  baseQty: 8 },
  { shopId: 'shop-garment-01', productId: 'prod-s2-chili',       batchId: 'batch-s2-chili-01',  price: 50,  baseQty: 4 },
  { shopId: 'shop-garment-01', productId: 'prod-s2-tea-loose',   batchId: 'batch-s2-tea-01',    price: 320, baseQty: 2 },
  { shopId: 'shop-garment-01', productId: 'prod-s2-chanachur',   batchId: 'batch-s2-chanachur-02',price: 20,baseQty: 20 },
  { shopId: 'shop-garment-01', productId: 'prod-s2-onion',       batchId: 'batch-s2-onion-01',  price: 60,  baseQty: 10 },
  { shopId: 'shop-garment-01', productId: 'prod-s2-detergent',   batchId: 'batch-s2-detergent-01',price:65, baseQty: 6 },
  { shopId: 'shop-garment-01', productId: 'prod-s2-mustard-oil', batchId: 'batch-s2-mustard-02',price: 220, baseQty: 2 },

  // Shop 3
  { shopId: 'shop-affluent-01', productId: 'prod-s3-basmati',   batchId: 'batch-s3-basmati-01', price: 180, baseQty: 3 },
  { shopId: 'shop-affluent-01', productId: 'prod-s3-olive-oil', batchId: 'batch-s3-olive-02',   price: 950, baseQty: 1 },
  { shopId: 'shop-affluent-01', productId: 'prod-s3-uht-milk',  batchId: 'batch-s3-uht-02',     price: 125, baseQty: 6 },
  { shopId: 'shop-affluent-01', productId: 'prod-s3-saffron',   batchId: 'batch-s3-saffron-02', price: 850, baseQty: 1 },
  { shopId: 'shop-affluent-01', productId: 'prod-s3-green-tea', batchId: 'batch-s3-greentea-01',price: 380, baseQty: 2 },
  { shopId: 'shop-affluent-01', productId: 'prod-s3-granola',   batchId: 'batch-s3-granola-01', price: 120, baseQty: 3 },
  { shopId: 'shop-affluent-01', productId: 'prod-s3-broccoli',  batchId: 'batch-s3-broccoli-01',price: 90,  baseQty: 4 },
  { shopId: 'shop-affluent-01', productId: 'prod-s3-dishwasher',batchId: 'batch-s3-dishwash-01',price: 220, baseQty: 2 },
  { shopId: 'shop-affluent-01', productId: 'prod-s3-yogurt',    batchId: 'batch-s3-yogurt-01',  price: 60,  baseQty: 5 },
]

// Festival/peak days (offsets from REF) — EID, Puja, etc.
const FESTIVAL_OFFSETS = new Set([-3, -2, -1, 0, 1, -35, -34, -33, -60, -59])

function isFestival(dayOffset: number): boolean {
  return FESTIVAL_OFFSETS.has(dayOffset)
}

function isWeekend(date: Date): boolean {
  const day = date.getDay() // 0=Sunday, 5=Friday, 6=Saturday
  return day === 5 || day === 6 // BD weekend
}

/** Seeded pseudo-random to keep builds deterministic */
function seededRandom(seed: number): number {
  const x = Math.sin(seed) * 10000
  return x - Math.floor(x)
}

function buildSales(): Sale[] {
  const sales: Sale[] = []
  const DAYS = 90

  saleSpecs.forEach((spec, specIdx) => {
    for (let d = DAYS; d >= 0; d--) {
      const date = new Date(REF)
      date.setDate(date.getDate() - d)

      const dayOffset = -d
      const weekend = isWeekend(date)
      const festival = isFestival(dayOffset)

      // Quantity multiplier: festival > weekend > normal
      const mult = festival ? 1.8 : weekend ? 1.3 : 1.0

      // Add slight random variance (± 30%) using seeded RNG
      const seed = specIdx * 10000 + d
      const jitter = 0.7 + seededRandom(seed) * 0.6  // 0.7 – 1.3
      const rawQty = Math.max(1, Math.round(spec.baseQty * mult * jitter))

      const soldAt = new Date(date)
      soldAt.setHours(8 + Math.floor(seededRandom(seed + 1) * 12)) // 8 AM – 8 PM
      soldAt.setMinutes(Math.floor(seededRandom(seed + 2) * 60))

      const saleId = `sale-${spec.shopId.slice(-2)}-${spec.productId.slice(-6)}-d${d}`
      const totalAmount = rawQty * spec.price

      const item = {
        batchId: spec.batchId,
        productId: spec.productId,
        quantity: rawQty,
        pricePerUnit: spec.price,
        subtotal: totalAmount,
      }

      const paymentMethods: Sale['paymentMethod'][] = ['cash', 'bkash', 'nagad', 'credit']
      const payMethod = paymentMethods[Math.floor(seededRandom(seed + 3) * 4)]

      sales.push({
        id: saleId,
        shopId: spec.shopId,
        batchId: spec.batchId,
        productId: spec.productId,
        quantity: rawQty,
        pricePerUnit: spec.price,
        items: [item],
        totalAmount,
        paymentMethod: payMethod,
        soldAt: soldAt.toISOString(),
        updatedAt: soldAt.toISOString(),
        deleted: 0,
      })
    }
  })

  return sales
}

export const mockSales: Sale[] = buildSales()

// ─── Credits ──────────────────────────────────────────────────────────────────

export const mockCredits: Credit[] = [
  // Shop 1 — student customers
  {
    id: 'credit-s1-01',
    shopId: 'shop-student-01',
    customerName: 'আরিফুল হাসান',
    customerPhone: '01735-123456',
    amount: 450,
    note: 'চাল ও তেল বাকি',
    isPaid: 0,
    createdAt: daysFromRef(-15) + 'T10:00:00.000Z',
    updatedAt: daysFromRef(-15) + 'T10:00:00.000Z',
    deleted: 0,
  },
  {
    id: 'credit-s1-02',
    shopId: 'shop-student-01',
    customerName: 'সুমাইয়া বেগম',
    customerPhone: '01845-234567',
    amount: 180,
    note: 'বিস্কুট ও চা বাকি',
    isPaid: 1,
    paidAt: daysFromRef(-5) + 'T14:00:00.000Z',
    createdAt: daysFromRef(-20) + 'T09:30:00.000Z',
    updatedAt: daysFromRef(-5) + 'T14:00:00.000Z',
    deleted: 0,
  },
  {
    id: 'credit-s1-03',
    shopId: 'shop-student-01',
    customerName: 'তানভীর হোসেন',
    amount: 320,
    note: 'ডাল ও মশলা বাকি',
    isPaid: 0,
    createdAt: daysFromRef(-8) + 'T11:00:00.000Z',
    updatedAt: daysFromRef(-8) + 'T11:00:00.000Z',
    deleted: 0,
  },

  // Shop 2 — garment worker customers
  {
    id: 'credit-s2-01',
    shopId: 'shop-garment-01',
    customerName: 'রহিমা খাতুন',
    customerPhone: '01612-345678',
    amount: 650,
    note: 'চাল ও পাম অয়েল বাকি (মাস শেষ)',
    isPaid: 0,
    createdAt: daysFromRef(-3) + 'T08:00:00.000Z',
    updatedAt: daysFromRef(-3) + 'T08:00:00.000Z',
    deleted: 0,
  },
  {
    id: 'credit-s2-02',
    shopId: 'shop-garment-01',
    customerName: 'করিম মিয়া',
    customerPhone: '01512-456789',
    amount: 420,
    note: 'পেঁয়াজ ও ডিটারজেন্ট',
    isPaid: 0,
    createdAt: daysFromRef(-10) + 'T09:00:00.000Z',
    updatedAt: daysFromRef(-10) + 'T09:00:00.000Z',
    deleted: 0,
  },
  {
    id: 'credit-s2-03',
    shopId: 'shop-garment-01',
    customerName: 'ফাতেমা আক্তার',
    amount: 280,
    note: 'চানাচুর ও মরিচ',
    isPaid: 1,
    paidAt: daysFromRef(-2) + 'T16:00:00.000Z',
    createdAt: daysFromRef(-18) + 'T10:30:00.000Z',
    updatedAt: daysFromRef(-2) + 'T16:00:00.000Z',
    deleted: 0,
  },

  // Shop 3 — affluent customers
  {
    id: 'credit-s3-01',
    shopId: 'shop-affluent-01',
    customerName: 'ড. শারমিন নওশীন',
    customerPhone: '01711-567890',
    amount: 2800,
    note: 'অলিভ অয়েল ও বাসমতি (মাসিক হিসাব)',
    isPaid: 0,
    createdAt: daysFromRef(-12) + 'T11:00:00.000Z',
    updatedAt: daysFromRef(-12) + 'T11:00:00.000Z',
    deleted: 0,
  },
  {
    id: 'credit-s3-02',
    shopId: 'shop-affluent-01',
    customerName: 'ইঞ্জিনিয়ার রিয়াজ',
    customerPhone: '01812-678901',
    amount: 950,
    note: 'গ্রিন টি ও গ্র্যানোলা',
    isPaid: 1,
    paidAt: daysFromRef(-1) + 'T12:00:00.000Z',
    createdAt: daysFromRef(-20) + 'T13:00:00.000Z',
    updatedAt: daysFromRef(-1) + 'T12:00:00.000Z',
    deleted: 0,
  },
]
