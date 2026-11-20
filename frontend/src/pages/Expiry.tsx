// Expiry & wastage risk management — Batch Recognizer, FIFO priority, and Dynamic Clearance Engine
import { useState, useMemo, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import {
  Clock,
  AlertOctagon,
  AlertTriangle,
  TrendingDown,
  Trash2,
  Tag,
  Filter,
  CheckCircle,
  Calendar,
  ShieldAlert,
  Layers,
  Barcode,
  Scan,
  Plus,
  Sparkles,
  Zap,
  ArrowRight,
  ShieldCheck,
  Gift,
} from 'lucide-react'
import { useLang } from '@/i18n'
import { useShopContext } from '@/hooks/useShopContext'
import { useProducts, useBatches, useSales } from '@/db/hooks'
import { addBatch, deleteBatch } from '@/db/mutations'
import { calculateBatchRisk, calcExpiryStats, sortBatchesByRisk } from '@/engines/expiry'
import { Card, Badge, Button, DemoBadge, EmptyState, ProductIcon, Modal } from '@/components/ui'
import { getRiskBadgeColor, getProductName } from '@/lib/utils'
import { toBengaliDigits } from '@/lib/bn'
import { HourglassBadge, Stagger, showSaveToast } from '@/components/motion'
import { api, getAuditedOutletId, type ExpiryBatchesResponse, type ExpiryBatchItem } from '@/lib/api'
import {
  generateBatchCode,
  calculateBatchClearingStrategy,
} from '@/mock/haalkhataFeatures'
import type { BatchWithRisk, Product, ExpiryRisk, BatchStrategySuggestion } from '@/types'

// Default sample batches showcasing Section 4.3 specification (Fresh Bun FB-001, FB-002)
const INITIAL_DEMO_BATCHES = [
  {
    id: 'bat-fresh-bun-01',
    productName: 'Fresh Bun (ফ্রেশ বান)',
    batchCode: 'FB-001',
    barcode: '894101026001',
    quantity: 25,
    unit: 'পিস',
    purchasePrice: 20,
    sellingPrice: 30,
    receiveDate: '2026-10-10',
    expiryDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 5).toISOString().slice(0, 10), // 5 days left
    fifoOrder: 1,
  },
  {
    id: 'bat-fresh-bun-02',
    productName: 'Fresh Bun (ফ্রেশ বান)',
    batchCode: 'FB-002',
    barcode: '894102026002',
    quantity: 40,
    unit: 'পিস',
    purchasePrice: 20,
    sellingPrice: 30,
    receiveDate: '2026-10-20',
    expiryDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 15).toISOString().slice(0, 10), // 15 days left
    fifoOrder: 2,
  },
  {
    id: 'bat-bread-01',
    productName: 'Danish Bread (ড্যানিশ পাউরুটি)',
    batchCode: 'DB-001',
    barcode: '894101526003',
    quantity: 14,
    unit: 'পিস',
    purchasePrice: 45,
    sellingPrice: 65,
    receiveDate: '2026-10-15',
    expiryDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 2).toISOString().slice(0, 10), // 2 days left
    fifoOrder: 1,
  },
]

export default function Expiry() {
  const { t, lang, formatNum, formatCurrency } = useLang()
  const { currentShop } = useShopContext()

  const shopId = currentShop?.id || 'shop-student-01'
  const rawProducts = useProducts(shopId) as Product[] | undefined
  const rawBatches = useBatches(shopId)
  const rawSales = useSales(shopId, 30)

  const products = rawProducts || []
  const batches = rawBatches || []
  const sales = rawSales || []

  // Main Active Tab: 'recognizer' (Batch Recognizer & FIFO Clearance) vs 'audit' (All Expiry Audits)
  const [activeTab, setActiveTab] = useState<'recognizer' | 'audit'>('recognizer')

  // Backend Integration State (Stage 4.9)
  const outletId = getAuditedOutletId(shopId)
  const [backendExpiry, setBackendExpiry] = useState<ExpiryBatchesResponse | null>(null)
  const [expiryLoading, setExpiryLoading] = useState(false)
  const [expiryError, setExpiryError] = useState<string | null>(null)

  // Batch Recognizer Form & List State
  const [recognizedBatches, setRecognizedBatches] = useState(INITIAL_DEMO_BATCHES)
  const [isAddBatchModalOpen, setIsAddBatchModalOpen] = useState(false)

  // Form Fields
  const [newProductName, setNewProductName] = useState('Fresh Bun (ফ্রেশ বান)')
  const [newBatchNumber, setNewBatchNumber] = useState<number>(3)
  const [newBatchCode, setNewBatchCode] = useState('FB-003')
  const [newBarcode, setNewBarcode] = useState('894829103841')
  const [newReceiveDate, setNewReceiveDate] = useState(new Date().toISOString().slice(0, 10))
  const [newExpiryDate, setNewExpiryDate] = useState(
    new Date(Date.now() + 1000 * 60 * 60 * 24 * 12).toISOString().slice(0, 10)
  )
  const [newQty, setNewQty] = useState<number>(30)
  const [newUnit, setNewUnit] = useState('পিস')
  const [newCostPrice, setNewCostPrice] = useState<number>(20)
  const [newSellingPrice, setNewSellingPrice] = useState<number>(30)

  const fetchExpiryBatches = useCallback(async () => {
    if (!outletId) {
      setBackendExpiry(null)
      setExpiryLoading(false)
      setExpiryError(null)
      return
    }
    setExpiryLoading(true)
    setExpiryError(null)
    try {
      const res = await api.expiryBatches(outletId, { days: 30 })
      setBackendExpiry(res)
    } catch (err: any) {
      console.warn('Expiry backend fetch failed, using local fallback:', err)
      setExpiryError(err.message || 'Backend unreachable')
      setBackendExpiry(null)
    } finally {
      setExpiryLoading(false)
    }
  }, [outletId])

  useEffect(() => {
    fetchExpiryBatches()
  }, [fetchExpiryBatches])

  const dataSource: 'backend' | 'local' | 'loading' | 'error' = expiryLoading
    ? 'loading'
    : expiryError
    ? 'error'
    : backendExpiry
    ? 'backend'
    : 'local'

  const [selectedRiskFilter, setSelectedRiskFilter] = useState<string>('all')

  // Calculate batch risks for regular inventory
  const batchesWithRisk = useMemo<BatchWithRisk[]>(() => {
    if (!products.length || !batches.length) return []
    const prodMap = new Map(products.map((p) => [p.id, p]))
    const calculated = batches
      .filter((b) => !b.deleted)
      .map((b) => {
        const p = prodMap.get(b.productId) || {
          id: b.productId,
          shopId: b.shopId,
          name: 'Unknown',
          category: 'other' as const,
          costPrice: 0,
          sellingPrice: 0,
          unit: 'unit',
          updatedAt: b.updatedAt,
          deleted: false,
        }
        const prodSales = sales.filter((s) => s.productId === b.productId)
        return calculateBatchRisk({ batch: b, product: p, recentSales: prodSales })
      })
    return sortBatchesByRisk(calculated)
  }, [products, batches, sales])

  // Summary statistics
  const stats = useMemo(() => calcExpiryStats(batchesWithRisk), [batchesWithRisk])

  // Filtered regular batches
  const filteredBatches = useMemo(() => {
    if (selectedRiskFilter === 'all') return batchesWithRisk
    return batchesWithRisk.filter((b) => b.risk === selectedRiskFilter)
  }, [batchesWithRisk, selectedRiskFilter])

  // Remove from sale handler (deletes the expired batch)
  const handleRemoveFromSale = async (batchId: string) => {
    if (
      window.confirm(
        lang === 'bn'
          ? 'আপনি কি নিশ্চিত যে এই মেয়াদোত্তীর্ণ ব্যাচটি বিক্রয় থেকে সরাতে চান?'
          : 'Are you sure you want to remove this expired batch from sale?'
      )
    ) {
      await deleteBatch(batchId)
    }
  }

  // Handle generating fresh batch code & barcode
  const handleGenerateCode = (prodName: string, batchNum: number) => {
    const { batchCode, barcode } = generateBatchCode(prodName, batchNum)
    setNewBatchCode(batchCode)
    setNewBarcode(barcode)
  }

  // Handle saving new batch in Batch Recognizer
  const handleSaveNewRecognizedBatch = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newProductName.trim() || newQty <= 0) return

    // Find any existing batches of same product to assign FIFO sequence
    const existingSame = recognizedBatches.filter(
      (b) => b.productName.toLowerCase() === newProductName.toLowerCase()
    )
    const assignedFifo = existingSame.length + 1

    const newBatch = {
      id: `bat-custom-${Date.now()}`,
      productName: newProductName.trim(),
      batchCode: newBatchCode,
      barcode: newBarcode,
      quantity: Number(newQty),
      unit: newUnit,
      purchasePrice: Number(newCostPrice),
      sellingPrice: Number(newSellingPrice),
      receiveDate: newReceiveDate,
      expiryDate: newExpiryDate,
      fifoOrder: assignedFifo,
    }

    setRecognizedBatches((prev) => [newBatch, ...prev])
    setIsAddBatchModalOpen(false)
    showSaveToast(
      lang === 'bn'
        ? `নতুন ব্যাচ (${newBatchCode}) সফলভাবে ইনপুট নেওয়া হয়েছে ✓`
        : `New batch (${newBatchCode}) successfully recognized ✓`
    )
  }

  // Dynamic Clearance Strategies computed for all recognized batches
  const strategySuggestions = useMemo<BatchStrategySuggestion[]>(() => {
    return recognizedBatches.map((b) => calculateBatchClearingStrategy(b))
  }, [recognizedBatches])

  // Apply clearance discount strategy action
  const handleApplyStrategy = (strategy: BatchStrategySuggestion) => {
    showSaveToast(
      lang === 'bn'
        ? `${strategy.productName} (${strategy.batchCode})-এ ${strategy.discountPercent}% ছাড় ও অফার কার্যকর হয়েছে ✓`
        : `Applied ${strategy.discountPercent}% clearance discount for ${strategy.batchCode} ✓`
    )
  }

  const riskFilters = [
    { id: 'all', label: lang === 'bn' ? 'সব ব্যাচ' : 'All Batches', count: batchesWithRisk.length },
    { id: 'expired', label: t.expiry.expired, count: batchesWithRisk.filter((b) => b.risk === 'expired').length },
    { id: 'high', label: t.expiry.highRisk, count: batchesWithRisk.filter((b) => b.risk === 'high').length },
    { id: 'medium', label: t.expiry.mediumRisk, count: batchesWithRisk.filter((b) => b.risk === 'medium').length },
    { id: 'low', label: t.expiry.lowRisk, count: batchesWithRisk.filter((b) => b.risk === 'low').length },
  ]

  return (
    <div className="space-y-6">
      {/* Page Title & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl sm:text-2xl font-bold text-brand-brown dark:text-brand-cream">
              {lang === 'bn'
                ? '🏷️ হালখাতা ব্যাচ রিকগনিশন ও লোকসান রোধ কৌশল'
                : '🏷️ Batch Recognizer & FIFO Loss-Prevention'}
            </h1>
            <DemoBadge
              source={dataSource}
              outletId={outletId}
              error={expiryError}
              onRetry={fetchExpiryBatches}
            />
          </div>
          <p className="text-sm text-brand-brown/70 dark:text-brand-cream/70 mt-1">
            {lang === 'bn'
              ? 'বারকোড ও ব্যাচ ট্র্যাকিং, FIFO সেল অগ্রাধিকার এবং মেয়াদ ভিত্তিক ডায়নামিক ছাড়ে খাদ্য নষ্ট রোধ'
              : 'Batch tracking with barcodes, FIFO release order, and dynamic discount schedules to prevent loss'}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button
            onClick={() => {
              handleGenerateCode(newProductName, recognizedBatches.length + 1)
              setIsAddBatchModalOpen(true)
            }}
            className="bg-brand-yellow hover:bg-brand-orange text-brand-brown font-bold flex items-center gap-1.5 px-4 py-2.5 rounded-xl shadow-sm text-xs sm:text-sm"
          >
            <Barcode className="w-4 h-4 text-brand-brown" />
            <span>{lang === 'bn' ? 'নতুন ব্যাচ / বারকোড স্ক্যান' : 'Recognize New Batch'}</span>
          </Button>
        </div>
      </div>

      {/* Safety Banner */}
      <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700/60 flex items-center gap-3">
        <AlertOctagon className="w-5 h-5 text-amber-700 dark:text-amber-400 flex-shrink-0" />
        <p className="text-xs sm:text-sm text-amber-900 dark:text-amber-200">
          <strong>{lang === 'bn' ? 'ব্যবসায়িক অ্যালগরিদম নীতি:' : 'Business Logic Rule:'}</strong>{' '}
          {lang === 'bn'
            ? 'খাদ্য বা মুদি পণ্য মেয়াদোত্তীর্ণ হয়ে ফেলে দিলে ১০০% লোকসান। তাই মেয়াদ শেষ হওয়ার আগে শিডিউল মাফিক ১০%, ২০%, ৩০% বা Buy 1 Get 1/3 দিয়ে হলেও মূলধন ও লাভ উদ্ধার করুন।'
            : 'Prevent total inventory write-off by triggering progressive clearance discounts before expiry.'}
        </p>
      </div>

      {/* Main Tabs */}
      <div className="flex items-center gap-2 border-b border-border pb-2 overflow-x-auto">
        <button
          onClick={() => setActiveTab('recognizer')}
          className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 whitespace-nowrap transition-all ${
            activeTab === 'recognizer'
              ? 'bg-brand-yellow text-brand-brown shadow-sm'
              : 'text-text-secondary hover:text-text hover:bg-background-secondary'
          }`}
        >
          <Barcode className="w-4 h-4" />
          <span>{lang === 'bn' ? 'ব্যাচ রিকগনিশন ও FIFO ক্লিয়ারেন্স স্ট্র্যাটেজি' : 'Batch Recognizer & FIFO Engine'}</span>
          <span className="px-1.5 py-0.2 rounded-full bg-brand-orange text-white text-[10px] font-bold">
            {formatNum(recognizedBatches.length)} ব্যাচ
          </span>
        </button>

        <button
          onClick={() => setActiveTab('audit')}
          className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 whitespace-nowrap transition-all ${
            activeTab === 'audit'
              ? 'bg-brand-yellow text-brand-brown shadow-sm'
              : 'text-text-secondary hover:text-text hover:bg-background-secondary'
          }`}
        >
          <Clock className="w-4 h-4" />
          <span>{lang === 'bn' ? 'সকল ইনভেন্টরি মেয়াদ অডিট' : 'Full Inventory Expiry Audit'}</span>
        </button>
      </div>

      {/* ─── TAB 1: BATCH RECOGNIZER & FIFO CLEARANCE STRATEGY ───────────────── */}
      {activeTab === 'recognizer' && (
        <div className="space-y-6">
          {/* Dynamic Strategy Explanation Cards (Section 4.3) */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <Card className="p-3.5 border-l-4 border-l-blue-500 bg-blue-50/20 dark:bg-blue-950/20">
              <span className="text-[10px] font-bold uppercase text-blue-700 dark:text-blue-300 block">
                {lang === 'bn' ? 'মেয়াদ বাকি: ১৫ দিন' : 'Shelf Life: 15 Days'}
              </span>
              <strong className="text-base text-blue-800 dark:text-blue-200 block mt-1">১০% ছাড় সুপারিশ</strong>
              <p className="text-[11px] text-brand-brown/70 dark:text-brand-cream/70 mt-1">
                স্বাভাবিক গতিতে দ্রুত বিক্রি নিশ্চিত করে অপচয় রোধ।
              </p>
            </Card>

            <Card className="p-3.5 border-l-4 border-l-amber-500 bg-amber-50/20 dark:bg-amber-950/20">
              <span className="text-[10px] font-bold uppercase text-amber-700 dark:text-amber-300 block">
                {lang === 'bn' ? 'মেয়াদ বাকি: ১০ দিন' : 'Shelf Life: 10 Days'}
              </span>
              <strong className="text-base text-amber-800 dark:text-amber-200 block mt-1">১৫–২০% ছাড়</strong>
              <p className="text-[11px] text-brand-brown/70 dark:text-brand-cream/70 mt-1">
                মেয়াদ ঘনিয়ে আসার আগে সেল বেগবান করার সুপারিশ।
              </p>
            </Card>

            <Card className="p-3.5 border-l-4 border-l-orange-500 bg-orange-50/20 dark:bg-orange-950/20">
              <span className="text-[10px] font-bold uppercase text-orange-700 dark:text-orange-300 block">
                {lang === 'bn' ? 'মেয়াদ বাকি: ৫ দিন' : 'Shelf Life: 5 Days'}
              </span>
              <strong className="text-base text-orange-800 dark:text-orange-200 block mt-1">২৫–৩০% ছাড় / Buy 1 Get 1</strong>
              <p className="text-[11px] text-brand-brown/70 dark:text-brand-cream/70 mt-1">
                জরুরি আকর্ষণীয় বান্ডেল অফারে দ্রুত স্টক খালি করা।
              </p>
            </Card>

            <Card className="p-3.5 border-l-4 border-l-red-500 bg-red-50/20 dark:bg-red-950/20">
              <span className="text-[10px] font-bold uppercase text-red-700 dark:text-red-300 block">
                {lang === 'bn' ? 'মেয়াদ অতি সন্নিকটে (≤ ২ দিন)' : 'Very Close to Expiry'}
              </span>
              <strong className="text-base text-red-800 dark:text-red-200 block mt-1">Buy 2 Get 1 / স্পেশাল অফার</strong>
              <p className="text-[11px] text-brand-brown/70 dark:text-brand-cream/70 mt-1">
                পণ্য নষ্ট হওয়ার আগেই সর্বোচ্চ মূলধন পুনরুদ্ধার।
              </p>
            </Card>
          </div>

          {/* List of batches with FIFO sequence and strategy advice */}
          <div className="space-y-4">
            {strategySuggestions.map((item) => {
              const isUrgent = item.daysUntilExpiry <= 7
              const isFifoFirst = item.fifoOrder === 1

              return (
                <Card
                  key={item.batchId}
                  className={`p-5 transition-all ${
                    isUrgent
                      ? 'border-l-4 border-l-red-500 bg-red-50/10'
                      : 'border-l-4 border-l-brand-orange'
                  }`}
                >
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    {/* Left: Batch Info & Barcode */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-xl bg-amber-100 dark:bg-amber-950/60 text-brand-orange flex items-center justify-center font-bold flex-shrink-0">
                          <Barcode className="w-7 h-7" />
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-extrabold text-base sm:text-lg text-brand-brown dark:text-brand-cream">
                              {item.productName}
                            </h3>

                            {/* FEFO Order Badge */}
                            {isFifoFirst ? (
                              <span className="px-2.5 py-0.5 rounded-full bg-red-600 text-white font-extrabold text-xs flex items-center gap-1 shadow-sm">
                                <Zap className="w-3.5 h-3.5" />
                                <span>FEFO অগ্রাধিকার: আগে এই ব্যাচটি রিলিজ করুন (Earlier Expiry)</span>
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full bg-gray-200 text-gray-800 dark:bg-gray-800 dark:text-gray-300 font-semibold text-xs">
                                FEFO ক্রম #{formatNum(item.fifoOrder)} (পরের ব্যাচ / হোল্ড)
                              </span>
                            )}

                            <span className="px-2 py-0.5 rounded-lg bg-brand-cream dark:bg-stone-800 font-mono text-xs font-bold text-brand-brown dark:text-brand-cream border border-border">
                              {item.batchCode}
                            </span>
                          </div>

                          <div className="flex items-center gap-3 mt-1.5 text-xs text-brand-brown/70 dark:text-brand-cream/70 flex-wrap">
                            <span className="font-mono text-xs bg-black/5 dark:bg-white/10 px-2 py-0.5 rounded">
                              বারকোড: {item.barcode}
                            </span>
                            <span>•</span>
                            <span>পণ্য প্রবেশের তারিখ: {item.receiveDate}</span>
                            <span>•</span>
                            <span className={isUrgent ? 'text-red-600 font-bold' : ''}>
                              মেয়াদ উত্তীর্ণ: {item.expiryDate} ({formatNum(item.daysUntilExpiry)} দিন বাকি)
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Stock & Financial Stats */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 text-xs">
                        <div>
                          <span className="text-brand-brown/60 dark:text-brand-cream/60 block">বর্তমান স্টক</span>
                          <strong className="text-sm text-brand-brown dark:text-brand-cream">
                            {formatNum(item.quantity)} {item.unit}
                          </strong>
                        </div>
                        <div>
                          <span className="text-brand-brown/60 dark:text-brand-cream/60 block">ক্রয় খরচ (একক)</span>
                          <strong className="text-sm text-brand-brown dark:text-brand-cream">
                            ৳{formatNum(item.purchaseCost)}
                          </strong>
                        </div>
                        <div>
                          <span className="text-brand-brown/60 dark:text-brand-cream/60 block">বর্তমান খুচরা দর</span>
                          <strong className="text-sm text-brand-brown dark:text-brand-cream">
                            ৳{formatNum(item.retailPrice)}
                          </strong>
                        </div>
                        <div>
                          <span className="text-brand-brown/60 dark:text-brand-cream/60 block">প্রত্যাশিত সংরক্ষিত মুনাফা</span>
                          <strong className="text-sm text-green-600 font-bold">
                            +৳{formatNum(item.projectedProfitOrLoss)}
                          </strong>
                        </div>
                      </div>

                      {/* Dynamic Strategy Advice Box */}
                      <div className="mt-3 p-3 rounded-xl bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-300 dark:border-amber-700/60 text-xs">
                        <div className="flex items-start gap-2">
                          <Sparkles className="w-4 h-4 text-brand-orange flex-shrink-0 mt-0.5" />
                          <div>
                            <span className="font-bold text-brand-orange">হালখাতা ক্লিয়ারেন্স পলিসি: </span>
                            <span className="text-brand-brown dark:text-brand-cream">{item.advice}</span>
                            {item.bundleOffer && (
                              <div className="mt-1 font-bold text-red-600 flex items-center gap-1">
                                <Gift className="w-3.5 h-3.5" />
                                <span>অফার: {item.bundleOffer}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Right: Discount Callout & Action */}
                    <div className="flex lg:flex-col items-center justify-between lg:justify-center border-t lg:border-t-0 pt-3 lg:pt-0 min-w-[170px] gap-3">
                      <div className="text-center">
                        <span className="text-xs font-bold uppercase text-brand-brown/70 dark:text-brand-cream/70 block">
                          প্রস্তাবিত ছাড়
                        </span>
                        <div className="px-4 py-2 rounded-2xl bg-brand-yellow border-2 border-brand-orange text-brand-brown font-black text-2xl mt-0.5 shadow-sm">
                          {formatNum(item.discountPercent)}% OFF
                        </div>
                        {item.bundleOffer && (
                          <span className="text-[10px] text-red-600 font-bold mt-1 block">
                            বান্ডেল সক্রিয়
                          </span>
                        )}
                      </div>

                      <Button
                        size="sm"
                        onClick={() => handleApplyStrategy(item)}
                        className="bg-brand-orange hover:bg-amber-600 text-white font-bold text-xs flex items-center gap-1.5 px-3.5 py-2 rounded-xl shadow-sm whitespace-nowrap"
                      >
                        <Tag className="w-3.5 h-3.5" />
                        <span>ছাড় কার্যকর করুন</span>
                      </Button>
                    </div>
                  </div>
                </Card>
              )
            })}
          </div>
        </div>
      )}

      {/* ─── TAB 2: FULL INVENTORY EXPIRY AUDIT ──────────────────────────────── */}
      {activeTab === 'audit' && (
        <div className="space-y-6">
          {/* Summary Metrics Row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
            <Card className="p-4 border-l-4 border-l-red-500">
              <span className="text-xs font-semibold uppercase text-red-600">{t.expiry.totalExpired}</span>
              <p className="text-2xl font-bold text-red-600 mt-2">
                {backendExpiry ? formatNum(backendExpiry.summary.expired_batches_count) : formatNum(stats.totalExpired)}
              </p>
              <span className="text-xs text-red-700 dark:text-red-400 font-medium mt-1 block">
                {t.expiry.removeFromSale}
              </span>
            </Card>

            <Card className="p-4 border-l-4 border-l-orange-500">
              <span className="text-xs font-semibold uppercase text-orange-600">
                {backendExpiry ? 'আসন্ন মেয়াদ (৩০ দিন)' : t.expiry.totalExpiringSoon}
              </span>
              <p className="text-2xl font-bold text-orange-600 mt-2">
                {backendExpiry ? formatNum(backendExpiry.summary.upcoming_batches_count) : formatNum(stats.totalExpiringSoon)}
              </p>
              <span className="text-xs text-brand-brown/70 dark:text-brand-cream/70 mt-1 block">
                {lang === 'bn' ? '৭ দিনের মধ্যে' : 'Within 7 days'}
              </span>
            </Card>

            <Card className="p-4 border-l-4 border-l-amber-500">
              <span className="text-xs font-semibold uppercase text-amber-600">
                {backendExpiry ? 'ছাড়যোগ্য মূল্য ঝুঁকি' : t.expiry.highRiskBatches}
              </span>
              <p className="text-2xl font-bold text-amber-600 mt-2">
                {backendExpiry ? `৳${formatNum(backendExpiry.summary.upcoming_cost_exposure_bdt)}` : formatNum(stats.highRiskBatches)}
              </p>
              <span className="text-xs text-brand-brown/70 dark:text-brand-cream/70 mt-1 block">
                {lang === 'bn' ? 'জরুরি পদক্ষেপ প্রয়োজন' : 'Needs fast action'}
              </span>
            </Card>

            <Card className="p-4 border-l-4 border-l-red-600">
              <span className="text-xs font-semibold uppercase text-red-600">
                {backendExpiry ? 'মেয়াদোত্তীর্ণ ক্ষতি' : t.expiry.estimatedLoss}
              </span>
              <p className="text-2xl font-bold text-red-600 mt-2">
                {backendExpiry ? `৳${formatNum(backendExpiry.summary.expired_cost_exposure_bdt)}` : formatCurrency(stats.estimatedLoss)}
              </p>
              <span className="text-xs text-brand-brown/70 dark:text-brand-cream/70 mt-1 block">
                {lang === 'bn' ? 'সম্ভাব্য নষ্ট পণ্যের ক্ষতি' : 'Total potential loss'}
              </span>
            </Card>
          </div>

          {/* Filter Tabs */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            {riskFilters.map((rf) => (
              <button
                key={rf.id}
                onClick={() => setSelectedRiskFilter(rf.id)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap transition-colors ${
                  selectedRiskFilter === rf.id
                    ? 'bg-brand-yellow text-brand-brown shadow-sm'
                    : 'bg-white dark:bg-[#1a0f07] text-brand-brown/70 dark:text-brand-cream/70 border border-[#F0D080]/60 hover:bg-brand-cream/40'
                }`}
              >
                <span>{rf.label}</span>
                <span className="px-1.5 py-0.2 rounded-full bg-black/10 dark:bg-white/10 text-[10px]">
                  {formatNum(rf.count)}
                </span>
              </button>
            ))}
          </div>

          {/* Audit List */}
          {filteredBatches.length === 0 ? (
            <EmptyState
              icon={CheckCircle}
              title={lang === 'bn' ? 'কোনো মেয়াদ ঝুঁকি নেই!' : 'No expiry risks found!'}
              description={
                lang === 'bn'
                  ? 'আপনার বর্তমান মজুদ পণ্যের মেয়াদ সন্তোষজনক পর্যায়ে রয়েছে।'
                  : 'All your current batches have safe expiry dates.'
              }
            />
          ) : (
            <Stagger className="space-y-3">
              {filteredBatches.map((item) => {
                const isExpired = item.risk === 'expired'

                return (
                  <Card
                    key={item.id}
                    className={`p-4 sm:p-5 transition-all ${
                      isExpired
                        ? 'border-l-4 border-l-red-600 bg-red-50/20 dark:bg-red-950/10'
                        : item.risk === 'high'
                        ? 'border-l-4 border-l-orange-500'
                        : ''
                    }`}
                  >
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3">
                          <ProductIcon name={item.productName || ''} category={item.productCategory} size={36} />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3 className="font-bold text-base sm:text-lg text-brand-brown dark:text-brand-cream">
                                {getProductName(item, lang)}
                              </h3>
                              <Badge className={getRiskBadgeColor(item.risk)}>
                                {isExpired
                                  ? t.expiry.expired
                                  : item.risk === 'high'
                                  ? t.expiry.highRisk
                                  : item.risk === 'medium'
                                  ? t.expiry.mediumRisk
                                  : item.risk === 'low'
                                  ? t.expiry.lowRisk
                                  : t.expiry.safe}
                              </Badge>
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3 text-xs">
                          <div>
                            <span className="text-brand-brown/60 dark:text-brand-cream/60 block">{t.inventory.quantity}</span>
                            <strong className="text-sm text-brand-brown dark:text-brand-cream">{formatNum(item.remainingQty)}</strong>
                          </div>
                          <div>
                            <span className="text-brand-brown/60 dark:text-brand-cream/60 block">{t.expiry.daysRemaining}</span>
                            <strong className={`text-sm ${isExpired ? 'text-red-600 font-bold' : 'text-brand-brown dark:text-brand-cream'}`}>
                              {isExpired ? `${formatNum(Math.abs(item.daysRemaining))} দিন আগে শেষ` : `${formatNum(item.daysRemaining)} দিন`}
                            </strong>
                          </div>
                          <div>
                            <span className="text-brand-brown/60 dark:text-brand-cream/60 block">{t.expiry.potentialLoss}</span>
                            <strong className="text-sm text-red-600">{formatCurrency(item.potentialLoss)}</strong>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-end gap-2 border-t md:border-t-0 pt-3 md:pt-0">
                        {isExpired ? (
                          <Button
                            variant="danger"
                            size="sm"
                            onClick={() => handleRemoveFromSale(item.id)}
                            className="flex items-center gap-1.5 text-xs font-bold whitespace-nowrap"
                          >
                            <Trash2 className="w-4 h-4" />
                            <span>{t.expiry.removeFromSale}</span>
                          </Button>
                        ) : (
                          <button
                            onClick={() => setActiveTab('recognizer')}
                            className="px-4 py-2 rounded-xl bg-brand-yellow hover:bg-brand-orange text-brand-brown font-bold text-xs flex items-center gap-1.5 transition-colors shadow-sm"
                          >
                            <Tag className="w-4 h-4" />
                            <span>ক্লিয়ারেন্স ছাড় দিন</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </Card>
                )
              })}
            </Stagger>
          )}
        </div>
      )}

      {/* ─── ADD RECOGNIZED BATCH MODAL (With Barcode & FIFO Logic) ─────────────── */}
      <Modal
        isOpen={isAddBatchModalOpen}
        onClose={() => setIsAddBatchModalOpen(false)}
        title={lang === 'bn' ? '🏷️ নতুন ব্যাচ রিকগনিশন ও বারকোড এন্ট্রি' : '🏷️ Recognize New Batch & Barcode'}
      >
        <form onSubmit={handleSaveNewRecognizedBatch} className="space-y-4">
          <p className="text-xs text-brand-brown/70 dark:text-brand-cream/70">
            {lang === 'bn'
              ? 'নতুন আসা ব্যাচের পণ্যের জন্য ইউনিক ব্যাচ কোড ও বারকোড ইনপুট দিন। সিস্টেম স্বয়ংক্রিয়ভাবে FIFO অর্ডার সেট করবে।'
              : 'Record incoming product batch with unique batch code and expiry date.'}
          </p>

          <div>
            <label className="block text-xs font-bold text-brand-brown dark:text-brand-cream mb-1">
              পণ্যের নাম *
            </label>
            <input
              type="text"
              required
              value={newProductName}
              onChange={(e) => {
                setNewProductName(e.target.value)
                handleGenerateCode(e.target.value, newBatchNumber)
              }}
              placeholder="e.g. ফ্রেশ বান (Fresh Bun)"
              className="w-full px-3 py-2 rounded-xl border border-[#F0D080] dark:border-[#4D2A00] bg-white dark:bg-[#1a0f07] text-sm focus:ring-2 focus:ring-brand-yellow font-bold"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-brand-brown dark:text-brand-cream mb-1">
                ব্যাচ নম্বর
              </label>
              <input
                type="number"
                min="1"
                value={newBatchNumber}
                onChange={(e) => {
                  const num = Number(e.target.value)
                  setNewBatchNumber(num)
                  handleGenerateCode(newProductName, num)
                }}
                className="w-full px-3 py-2 rounded-xl border border-[#F0D080] dark:border-[#4D2A00] bg-white dark:bg-[#1a0f07] text-sm focus:ring-2 focus:ring-brand-yellow font-bold"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-brand-brown dark:text-brand-cream mb-1">
                স্বয়ংক্রিয় বারকোড
              </label>
              <input
                type="text"
                readOnly
                value={newBarcode}
                className="w-full px-3 py-2 rounded-xl border border-gray-300 bg-gray-50 dark:bg-[#160d05] text-sm font-mono font-bold"
              />
            </div>
          </div>

          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="text-xs font-bold text-brand-brown dark:text-brand-cream">
                ব্যাচ কোড (ইউনিক আইডেন্টিফায়ার)
              </label>
              <button
                type="button"
                onClick={() => handleGenerateCode(newProductName, newBatchNumber)}
                className="text-xs text-brand-orange hover:underline font-semibold"
              >
                রি-জেনারেট করুন
              </button>
            </div>
            <input
              type="text"
              required
              value={newBatchCode}
              onChange={(e) => setNewBatchCode(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-[#F0D080] dark:border-[#4D2A00] bg-white dark:bg-[#1a0f07] text-sm font-mono focus:ring-2 focus:ring-brand-yellow"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-brand-brown dark:text-brand-cream mb-1">
                পণ্য গ্রহণের তারিখ
              </label>
              <input
                type="date"
                required
                value={newReceiveDate}
                onChange={(e) => setNewReceiveDate(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-[#F0D080] dark:border-[#4D2A00] bg-white dark:bg-[#1a0f07] text-sm focus:ring-2 focus:ring-brand-yellow"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-brand-brown dark:text-brand-cream mb-1">
                মেয়াদ উত্তীর্ণের তারিখ *
              </label>
              <input
                type="date"
                required
                value={newExpiryDate}
                onChange={(e) => setNewExpiryDate(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-[#F0D080] dark:border-[#4D2A00] bg-white dark:bg-[#1a0f07] text-sm focus:ring-2 focus:ring-brand-yellow font-bold text-red-600"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-brand-brown dark:text-brand-cream mb-1">
                পরিমাণ *
              </label>
              <input
                type="number"
                min="1"
                required
                value={newQty}
                onChange={(e) => setNewQty(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-xl border border-[#F0D080] dark:border-[#4D2A00] bg-white dark:bg-[#1a0f07] text-sm focus:ring-2 focus:ring-brand-yellow font-bold"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-brand-brown dark:text-brand-cream mb-1">
                কেনা দর (৳)
              </label>
              <input
                type="number"
                min="1"
                value={newCostPrice}
                onChange={(e) => setNewCostPrice(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-xl border border-[#F0D080] dark:border-[#4D2A00] bg-white dark:bg-[#1a0f07] text-sm focus:ring-2 focus:ring-brand-yellow"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-brand-brown dark:text-brand-cream mb-1">
                বিক্রি দর (৳)
              </label>
              <input
                type="number"
                min="1"
                value={newSellingPrice}
                onChange={(e) => setNewSellingPrice(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-xl border border-[#F0D080] dark:border-[#4D2A00] bg-white dark:bg-[#1a0f07] text-sm focus:ring-2 focus:ring-brand-yellow"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
            <Button type="button" variant="outline" onClick={() => setIsAddBatchModalOpen(false)}>
              {t.common.cancel}
            </Button>
            <Button
              type="submit"
              className="bg-brand-yellow hover:bg-brand-orange text-brand-brown font-bold flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>ব্যাচ যুক্ত করুন</span>
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
