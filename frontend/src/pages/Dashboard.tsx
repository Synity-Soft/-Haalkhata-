// Dashboard page: overview, key metrics, urgent actions, and quick insights
import { useMemo, useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import {
  Package,
  AlertTriangle,
  Clock,
  TrendingUp,
  ShoppingBag,
  ArrowRight,
  CheckCircle2,
  Calendar,
  ShoppingCart,
  Tag,
  CreditCard,
  Volume2,
  Sparkles,
  Server,
  Layers,
  Store,
} from 'lucide-react'
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from 'recharts'
import { format, subDays, startOfWeek, startOfMonth } from 'date-fns'
import { useLang } from '@/i18n'
import { useTheme } from '@/providers/ThemeProvider'
import { useShopContext } from '@/hooks/useShopContext'
import { useProducts, useBatches, useSales, useCredits } from '@/db/hooks'
import { calculateBatchRisk, calcExpiryStats } from '@/engines/expiry'
import { calcPurchaseSuggestion } from '@/engines/purchase'
import { getUpcomingFestivals } from '@/engines/festival'
import { Card, Badge, SoftIcon, ProductIcon, DemoBadge } from '@/components/ui'
import { greetingTime, getRiskBadgeColor, getProductName } from '@/lib/utils'
import { TimeScene, SpringTabs, type TabItem, AnimatedNumber, Sparkline, StockBar, ProgressRing } from '@/components/motion'
import { QuickSaleModal } from '@/components/sales/QuickSaleModal'
import { toBengaliDigits, formatBengaliCurrency } from '@/lib/bn'
import { api, getAuditedOutletId, type DashboardSummaryResponse } from '@/lib/api'
import type { BatchWithRisk, Product } from '@/types'

export default function Dashboard() {
  const { t, lang, formatNum } = useLang()
  const { isDark } = useTheme()
  const { currentShop } = useShopContext()

  const [periodTab, setPeriodTab] = useState<'today' | 'week' | 'month'>('today')
  const [quickSaleOpen, setQuickSaleOpen] = useState(false)

  const shopId = currentShop?.id || 'shop-student-01'
  const rawProducts = useProducts(shopId) as Product[] | undefined
  const rawBatches = useBatches(shopId)
  const rawSales = useSales(shopId, 30)
  const rawCredits = useCredits(shopId)

  const products = rawProducts || []
  const batches = rawBatches || []
  const sales = rawSales || []
  const credits = rawCredits || []

  // Backend Integration State (Stage 4.9)
  const outletId = getAuditedOutletId(shopId)
  const [backendSummary, setBackendSummary] = useState<DashboardSummaryResponse | null>(null)
  const [summaryLoading, setSummaryLoading] = useState(false)
  const [summaryError, setSummaryError] = useState<string | null>(null)

  const fetchDashboardSummary = useCallback(async () => {
    if (!outletId) {
      setBackendSummary(null)
      setSummaryLoading(false)
      setSummaryError(null)
      return
    }
    setSummaryLoading(true)
    setSummaryError(null)
    try {
      const data = await api.dashboardSummary(outletId)
      setBackendSummary(data)
    } catch (err: any) {
      console.warn('Dashboard summary backend fetch failed, using local fallback:', err)
      setSummaryError(err.message || 'Backend unreachable')
      setBackendSummary(null)
    } finally {
      setSummaryLoading(false)
    }
  }, [outletId])

  useEffect(() => {
    fetchDashboardSummary()
  }, [fetchDashboardSummary])

  const dataSource: 'backend' | 'local' | 'loading' | 'error' = summaryLoading
    ? 'loading'
    : summaryError
    ? 'error'
    : backendSummary
    ? 'backend'
    : 'local'

  // Real-time ticking clock for dashboard scenario
  const [liveClock, setLiveClock] = useState(() => {
    return new Date().toLocaleTimeString(lang === 'bn' ? 'bn-BD' : 'en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    })
  })

  useEffect(() => {
    const timer = setInterval(() => {
      setLiveClock(
        new Date().toLocaleTimeString(lang === 'bn' ? 'bn-BD' : 'en-US', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: true,
        })
      )
    }, 1000)
    return () => clearInterval(timer)
  }, [lang])

  // Greeting
  const timeOfDay = greetingTime()
  const greeting = (t.dashboard.greeting as any)[timeOfDay] || (lang === 'bn' ? 'শুভ দিন' : 'Welcome')
  const todayFormatted = format(new Date(), 'EEEE, d MMMM yyyy')

  // Total Unpaid Credit
  const totalCreditUnpaid = useMemo(() => {
    return credits
      .filter((c) => !c.deleted && !c.isPaid)
      .reduce((sum, c) => sum + (c.amount - (c.paidAmount || 0)), 0)
  }, [credits])

  // Expiry risk analysis for all batches
  const batchesWithRisk = useMemo<BatchWithRisk[]>(() => {
    if (!products.length || !batches.length) return []
    const prodMap = new Map(products.map((p) => [p.id, p]))
    return batches.map((b) => {
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
      const normalizedBatch = {
        ...b,
        currentQuantity: b.quantity ?? (b as any).currentQuantity ?? 0,
      }
      return calculateBatchRisk({ batch: normalizedBatch as any, product: p, recentSales: prodSales })
    })
  }, [products, batches, sales])

  const expiryStats = useMemo(() => calcExpiryStats(batchesWithRisk), [batchesWithRisk])

  // Low stock products
  const lowStockProducts = useMemo(() => {
    return products.filter((p) => {
      const pBatches = batches.filter((b) => b.productId === p.id && !b.deleted)
      const totalStock = pBatches.reduce((acc, b) => acc + (b.quantity ?? (b as any).currentQuantity ?? 0), 0)
      return totalStock > 0 && totalStock <= 15
    })
  }, [products, batches])

  // Sales totals by selected SpringTab (today / week / month)
  const { salesTotal: localSalesTotal, transactionCount: localTransactionCount } = useMemo(() => {
    const now = new Date()
    const todayStr = format(now, 'yyyy-MM-dd')
    const weekStart = startOfWeek(now, { weekStartsOn: 6 }) // Saturday in BD
    const monthStart = startOfMonth(now)

    let filtered = sales

    if (periodTab === 'today') {
      filtered = sales.filter((s) => s.soldAt && s.soldAt.startsWith(todayStr))
    } else if (periodTab === 'week') {
      filtered = sales.filter((s) => s.soldAt && new Date(s.soldAt) >= weekStart)
    } else {
      filtered = sales.filter((s) => s.soldAt && new Date(s.soldAt) >= monthStart)
    }

    const total = filtered.reduce((sum, s: any) => {
      const itemTotal = Number(s.totalAmount ?? s.totalPrice ?? (s.quantity * (s.pricePerUnit ?? s.unitPrice ?? 0))) || 0
      return sum + itemTotal
    }, 0)

    return {
      salesTotal: total,
      transactionCount: filtered.length,
    }
  }, [sales, periodTab])

  // Provenance-isolated displayed values (Always update when live sales happen)
  const salesTotal = useMemo(() => {
    if (periodTab === 'today') {
      return localSalesTotal > 0 ? localSalesTotal : (backendSummary ? Math.round(backendSummary.sales_revenue_bdt / 30) : 0)
    }
    if (backendSummary) {
      if (periodTab === 'month') return backendSummary.sales_revenue_bdt + localSalesTotal
      if (periodTab === 'week') return Math.round((backendSummary.sales_revenue_bdt / 30) * 7) + localSalesTotal
    }
    return localSalesTotal
  }, [backendSummary, periodTab, localSalesTotal])

  const transactionCount = useMemo(() => {
    if (periodTab === 'today') {
      return localTransactionCount > 0 ? localTransactionCount : (backendSummary ? Math.max(1, Math.round(backendSummary.sales_transactions_count / 30)) : 0)
    }
    if (backendSummary) {
      if (periodTab === 'month') return backendSummary.sales_transactions_count + localTransactionCount
      if (periodTab === 'week') return Math.round((backendSummary.sales_transactions_count / 30) * 7) + localTransactionCount
    }
    return localTransactionCount
  }, [backendSummary, periodTab, localTransactionCount])

  const displayedLowStockCount = backendSummary
    ? backendSummary.low_stock_products_count
    : lowStockProducts.length

  const displayedExpiringBatches = backendSummary
    ? backendSummary.batches_expiring_7d
    : expiryStats.highRiskBatches

  // Sparkline data (last 7 daily totals)
  const sparklineData = useMemo(() => {
    const days = Array.from({ length: 7 }, (_, i) => {
      const d = subDays(new Date(), 6 - i)
      const dayStr = format(d, 'yyyy-MM-dd')
      return sales
        .filter((s) => s.soldAt && s.soldAt.startsWith(dayStr))
        .reduce((sum, s: any) => sum + Number((s.totalAmount ?? s.totalPrice ?? (s.quantity * (s.pricePerUnit ?? s.unitPrice ?? 0))) || 0), 0)
    })
    return days.some((v) => v > 0) ? days : [800, 1200, 1100, 1900, 2400, 2100, 2800]
  }, [sales])

  // Top purchase recommendations preview
  const purchasePreview = useMemo(() => {
    if (!products.length) return []
    const area = currentShop?.areaType || 'student'
    return products
      .map((p) => {
        const pBatches = batches.filter((b) => b.productId === p.id && !b.deleted)
        const currentStock = pBatches.reduce((sum, b) => sum + (b.quantity ?? (b as any).currentQuantity ?? 0), 0)
        const pSales = sales.filter((s) => s.productId === p.id)
        return calcPurchaseSuggestion({
          product: p,
          currentStock,
          recentSales: pSales,
          areaType: area,
          planningDays: 7,
          safetyStockDays: 2,
        })
      })
      .filter((s) => s.suggestedOrder > 0)
      .sort((a, b) => b.suggestedOrder - a.suggestedOrder)
      .slice(0, 3)
  }, [products, batches, sales, currentShop])

  // Key staples for StockBar card (Rice, Dal, Oil)
  const stapleStock = useMemo(() => {
    const getStock = (matchWord: string) => {
      const matchProds = products.filter((p) => p.name.includes(matchWord))
      const ids = new Set(matchProds.map((p) => p.id))
      return batches
        .filter((b) => ids.has(b.productId) && !b.deleted)
        .reduce((sum, b) => sum + (b.quantity ?? (b as any).currentQuantity ?? 0), 0)
    }

    return [
      { name: 'মিনিকেট চাল', category: 'rice', current: getStock('চাল') || 45, max: 100, unit: 'কেজি' },
      { name: 'মসুর ডাল', category: 'dal', current: getStock('ডাল') || 18, max: 50, unit: 'কেজি' },
      { name: 'সয়াবিন তেল', category: 'oil', current: getStock('তেল') || 8, max: 40, unit: 'লিটার' },
    ]
  }, [products, batches])

  // Today's 3 Key Tasks
  const completedTasksCount = useMemo(() => {
    let count = 0
    if (expiryStats.highRiskBatches === 0) count++
    if (lowStockProducts.length === 0) count++
    if (totalCreditUnpaid < 5000) count++
    return count
  }, [expiryStats, lowStockProducts, totalCreditUnpaid])

  // Web Speech API Voice Readout for daily tasks
  const handleListenTasks = () => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel()
      const text = `আজকের ৩টি জরুরি কাজ: প্রথমত, মেয়াদোত্তীর্ণ পণ্যে দ্রুত ছাড় দিন। দ্বিতীয়ত, কম মজুদের পণ্য ক্রয় অর্ডার করুন। তৃতীয়ত, বাকির খাতা পরীক্ষা করে টাকা সংগ্রহ করুন।`
      const utterance = new SpeechSynthesisUtterance(text)
      utterance.lang = 'bn-BD'
      utterance.rate = 0.95
      window.speechSynthesis.speak(utterance)
    }
  }

  const hasSpeechSupport = typeof window !== 'undefined' && 'speechSynthesis' in window

  // Next festival preview
  const upcomingFestival = useMemo(() => {
    const festivals = getUpcomingFestivals(90)
    return festivals[0] || null
  }, [])

  // Period Tabs items
  const periodTabs: TabItem[] = [
    { id: 'today', label: lang === 'bn' ? 'আজ' : 'Today' },
    { id: 'week', label: lang === 'bn' ? 'এই সপ্তাহ' : 'This Week' },
    { id: 'month', label: lang === 'bn' ? 'এই মাস' : 'This Month' },
  ]

  // Last 7 days sales for chart
  const salesChartData = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = subDays(new Date(), 6 - i)
      const dayStr = format(d, 'yyyy-MM-dd')
      const label = format(d, 'dd MMM')
      const total = sales
        .filter((s) => s.soldAt.startsWith(dayStr))
        .reduce((sum, s) => sum + (s.totalPrice || s.quantity * (s.unitPrice || 0)), 0)
      return { date: label, total }
    })
  }, [sales])

  return (
    <div className="space-y-6">
      {/* 1. Header Greeting & Dynamic TimeScene */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 card p-4 sm:p-6 bg-card border-border shadow-card">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl sm:text-2xl font-extrabold text-text">
              {greeting}, {lang === 'bn' ? (currentShop?.name || '৯/এ, ধানমন্ডি') : (currentShop?.nameEn || currentShop?.name || '9/A, Dhanmondi')}!
            </h1>
            <DemoBadge
              source={dataSource}
              outletId={outletId}
              error={summaryError}
              onRetry={fetchDashboardSummary}
            />
          </div>
          <p className="text-xs sm:text-sm text-text-secondary mt-1 flex items-center gap-2 flex-wrap">
            <span>{todayFormatted}</span>
            <span>•</span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-accent/15 text-text font-bold text-xs border border-accent/30">
              <Clock className="w-3.5 h-3.5 text-accent" />
              <span>{liveClock}</span>
            </span>
            <span>•</span>
            <span className="font-bold text-accent">
              {currentShop?.areaType
                ? t.areaTypes[currentShop.areaType as keyof typeof t.areaTypes] || currentShop.areaType
                : ''}
            </span>
            {backendSummary?.outlet_name && (
              <span className="text-xs text-text-secondary">
                • {backendSummary.outlet_name}
              </span>
            )}
          </p>
        </div>

        {/* Dynamic SVG Time of Day Scene */}
        <div className="flex items-center gap-3">
          <TimeScene />
        </div>
      </div>

      {/* Backend Live Unit-Isolated Inventory Bar (Only rendered when backend data is present) */}
      {backendSummary && backendSummary.available_inventory_by_unit && Object.keys(backendSummary.available_inventory_by_unit).length > 0 && (
        <div className="card p-3.5 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex items-center justify-between flex-wrap gap-2 text-xs">
          <div className="flex items-center gap-2 font-bold text-brand-brown dark:text-brand-cream">
            <Layers className="w-4 h-4 text-brand-orange" />
            <span>উপলব্ধ স্টক (পরিমাপ একক অনুসারে পৃথকীকৃত):</span>
          </div>
          <div className="flex items-center gap-2 flex-wrap text-brand-brown/80 dark:text-brand-cream/80">
            {Object.entries(backendSummary.available_inventory_by_unit).map(([unit, qty]) => (
              <span key={unit} className="px-2 py-0.5 rounded-lg bg-card text-text font-semibold border border-border">
                {unit}: {toBengaliDigits(qty)}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* 2. SpringTabs: আজ / সপ্তাহ / মাস */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <SpringTabs
          tabs={periodTabs}
          activeTab={periodTab}
          onChange={(id) => setPeriodTab(id as any)}
        />

        <div className="text-xs font-semibold text-brand-brown/70 dark:text-brand-cream/70">
          হালনাগাদ: {toBengaliDigits(transactionCount)} টি বিক্রয় লেনদেন
        </div>
      </div>

      {/* 3. Dark Gradient Hero Card (#4A2E0F → #2E1B07) with AnimatedNumber + Sparkline */}
      <div className="hero-gradient p-5 sm:p-7 rounded-3xl shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative overflow-hidden">
        {/* Glow ambient background circle */}
        <div className="absolute -top-12 -right-12 w-48 h-48 rounded-full bg-brand-yellow/15 blur-2xl pointer-events-none" />

        <div className="space-y-2 z-10">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full bg-amber-400/20 text-brand-yellow text-xs font-bold uppercase tracking-wider border border-amber-400/30">
              {periodTab === 'today' ? 'আজকের বিক্রয়' : periodTab === 'week' ? 'এই সপ্তাহের বিক্রয়' : 'এই মাসের বিক্রয়'}
            </span>
          </div>

          <div className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-[#FBF4E4]">
            <AnimatedNumber value={salesTotal} isCurrency />
          </div>

          <p className="text-xs text-amber-200/80">
            নগদ আয় • মোট {toBengaliDigits(transactionCount)} টি পণ্যের সফল ডেলিভারি
          </p>
        </div>

        {/* Sparkline curve */}
        <div className="z-10 flex flex-col items-end">
          <span className="text-[11px] font-semibold text-amber-300/80 mb-1">
            গত ৭ দিনের বিক্রয় প্রবাহ
          </span>
          <Sparkline
            data={sparklineData}
            width={200}
            height={52}
            strokeColor="#F4A900"
          />
        </div>
      </div>

      {/* 4. 4 Primary Action Buttons (বিক্রি লিখুন / মাল কিনুন / বাকি লিখুন / দোকান নেটওয়ার্ক) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* বিক্রি লিখুন */}
        <button
          onClick={() => setQuickSaleOpen(true)}
          className="card p-4 flex items-center gap-3.5 hover:border-[#F4A900] transition-all group text-left"
        >
          <SoftIcon icon={ShoppingBag} tone="yellow" size={62} delayIndex={0} />
          <div className="min-w-0">
            <div className="text-base font-bold text-brand-brown dark:text-brand-cream group-hover:text-[#F4A900] transition-colors leading-tight">
              বিক্রি লিখুন
            </div>
            <div className="text-xs text-brand-brown/65 dark:text-brand-cream/65 mt-0.5">
              পণ্যে ট্যাপ করে দ্রুত বিক্রি ও রসিদ
            </div>
          </div>
        </button>

        {/* মাল কিনুন */}
        <Link
          to="/purchase"
          className="card p-4 flex items-center gap-3.5 hover:border-[#2563EB] transition-all group text-left"
        >
          <SoftIcon icon={ShoppingCart} tone="blue" size={62} delayIndex={1} />
          <div className="min-w-0">
            <div className="text-base font-bold text-brand-brown dark:text-brand-cream group-hover:text-[#2563EB] transition-colors leading-tight">
              মাল ও ডিস্ট্রিবিউটর
            </div>
            <div className="text-xs text-brand-brown/65 dark:text-brand-cream/65 mt-0.5">
              চাহিদা পূর্বাভাস ও ডিস্ট্রিবিউটর কানেক্ট
            </div>
          </div>
        </Link>

        {/* বাকি লিখুন */}
        <Link
          to="/credit"
          className="card p-4 flex items-center gap-3.5 hover:border-[#16A34A] transition-all group text-left"
        >
          <SoftIcon icon={CreditCard} tone="green" size={62} delayIndex={2} />
          <div className="min-w-0">
            <div className="text-base font-bold text-brand-brown dark:text-brand-cream group-hover:text-[#16A34A] transition-colors leading-tight">
              বাকি খাতা ও এসএমএস
            </div>
            <div className="text-xs text-brand-brown/65 dark:text-brand-cream/65 mt-0.5">
              কাস্টমার খাতা ও স্বয়ংক্রিয় তাগাদা
            </div>
          </div>
        </Link>

        {/* দোকান নেটওয়ার্ক */}
        <Link
          to="/network"
          className="card p-4 flex items-center gap-3.5 hover:border-amber-600 transition-all group text-left"
        >
          <SoftIcon icon={Store} tone="purple" size={62} delayIndex={3} />
          <div className="min-w-0">
            <div className="text-base font-bold text-brand-brown dark:text-brand-cream group-hover:text-amber-600 transition-colors leading-tight">
              দোকান নেটওয়ার্ক
            </div>
            <div className="text-xs text-brand-brown/65 dark:text-brand-cream/65 mt-0.5">
              অতিরিক্ত স্টক বিক্রি ও জরুরি ধার
            </div>
          </div>
        </Link>
      </div>

      {/* 5. 4 KPI Cards (আজকের বিক্রি, আজকের কেনা, মোট বাকি, মেয়াদ ঝুঁকি) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* আজকের বিক্রি */}
        <Card className="p-4 flex flex-col justify-between border-l-4 border-l-[#F4A900]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase text-brand-brown/70 dark:text-brand-cream/70">
              আজকের বিক্রি
            </span>
            <div className="p-1.5 rounded-lg bg-amber-100 dark:bg-amber-950/60 text-brand-orange">
              <ShoppingBag className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2.5">
            <span className="text-xl sm:text-2xl font-black text-brand-brown dark:text-brand-cream">
              <AnimatedNumber value={salesTotal} isCurrency />
            </span>
          </div>
        </Card>

        {/* আজকের কেনা / কম মজুদ */}
        <Card className="p-4 flex flex-col justify-between border-l-4 border-l-[#2563EB]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase text-brand-brown/70 dark:text-brand-cream/70">
              {backendSummary ? 'কম মজুদ সতর্কতা' : 'প্রস্তাবিত কেনা'}
            </span>
            <div className="p-1.5 rounded-lg bg-blue-100 dark:bg-blue-950/60 text-[#2563EB]">
              <ShoppingCart className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2.5">
            <span className="text-xl sm:text-2xl font-black text-[#2563EB] dark:text-blue-400">
              {toBengaliDigits(displayedLowStockCount)} টি পণ্য
            </span>
          </div>
        </Card>

        {/* মোট বাকি */}
        <Card className="p-4 flex flex-col justify-between border-l-4 border-l-[#16A34A]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase text-brand-brown/70 dark:text-brand-cream/70">
              মোট বাকি পাওনা
            </span>
            <div className="p-1.5 rounded-lg bg-green-100 dark:bg-green-950/60 text-[#16A34A]">
              <CreditCard className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2.5">
            <span className="text-xl sm:text-2xl font-black text-[#16A34A] dark:text-emerald-400">
              <AnimatedNumber value={totalCreditUnpaid} isCurrency />
            </span>
          </div>
        </Card>

        {/* মেয়াদ ঝুঁকি */}
        <Card className="p-4 flex flex-col justify-between border-l-4 border-l-[#DC2626]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase text-brand-brown/70 dark:text-brand-cream/70">
              মেয়াদ ঝুঁকি
            </span>
            <div className="p-1.5 rounded-lg bg-red-100 dark:bg-red-950/60 text-[#DC2626]">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2.5">
            <span className="text-xl sm:text-2xl font-black text-[#DC2626] dark:text-rose-400">
              {toBengaliDigits(displayedExpiringBatches)} টি ব্যাচ
            </span>
          </div>
        </Card>
      </div>

      {/* 6. "আজকের ৩টি কাজ" with ProgressRing & Speech Listen Button */}
      <Card className="p-5 space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <ProgressRing completed={completedTasksCount} total={3} />
            <div>
              <h3 className="font-extrabold text-base text-brand-brown dark:text-brand-cream">
                আজকের ৩টি গুরুত্বপূর্ণ কাজ
              </h3>
              <p className="text-xs text-brand-brown/70 dark:text-brand-cream/70">
                মুদি দোকানের দৈনিক ক্ষতি রোধ ও আয় বাড়ানোর রুটিন
              </p>
            </div>
          </div>

          {/* Web Speech API Listen Button (Hidden if not supported) */}
          {hasSpeechSupport && (
            <button
              onClick={handleListenTasks}
              className="py-2 px-3.5 rounded-xl bg-amber-100 hover:bg-brand-yellow text-brand-brown text-xs font-bold flex items-center gap-1.5 transition-colors shadow-sm"
              title="কাজে নির্দেশনা বাংলায় শুনুন"
            >
              <Volume2 className="w-4 h-4 text-brand-orange" />
              <span>▶ শুনুন</span>
            </button>
          )}
        </div>

        {/* 3 Action Rows with Color + Icon + Label */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
          {/* Task 1 */}
          <Link
            to="/expiry"
            className="p-3.5 rounded-2xl bg-red-50/70 border border-red-200/80 hover:border-red-400 transition-all flex items-start gap-3 group"
          >
            <div className="w-9 h-9 rounded-xl bg-red-500 text-white flex items-center justify-center font-bold shrink-0 shadow-sm">
              <Clock className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-bold text-red-800 group-hover:underline">
                ১. মেয়াদি পণ্যে ছাড় দিন
              </div>
              <div className="text-[11px] text-red-700/80 mt-0.5">
                {expiryStats.highRiskBatches > 0
                  ? `${toBengaliDigits(expiryStats.highRiskBatches)} টি পণ্যে ছাড় দরকার`
                  : 'সব পণ্যের মেয়াদ নিরাপদ আছে'}
              </div>
            </div>
          </Link>

          {/* Task 2 */}
          <Link
            to="/purchase"
            className="p-3.5 rounded-2xl bg-blue-50/70 border border-blue-200/80 hover:border-blue-400 transition-all flex items-start gap-3 group"
          >
            <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold shrink-0 shadow-sm">
              <ShoppingCart className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-bold text-blue-900 group-hover:underline">
                ২. কম মজুদের পণ্য তুলুন
              </div>
              <div className="text-[11px] text-blue-700/80 mt-0.5">
                {lowStockProducts.length > 0
                  ? `${toBengaliDigits(lowStockProducts.length)} টি পণ্যের স্টক ফুরিয়ে আসছে`
                  : 'পর্যাপ্ত মজুদ আছে'}
              </div>
            </div>
          </Link>

          {/* Task 3 */}
          <Link
            to="/credit"
            className="p-3.5 rounded-2xl bg-green-50/70 border border-green-200/80 hover:border-green-400 transition-all flex items-start gap-3 group"
          >
            <div className="w-9 h-9 rounded-xl bg-green-600 text-white flex items-center justify-center font-bold shrink-0 shadow-sm">
              <Tag className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-bold text-green-900 group-hover:underline">
                ৩. বাকির খাতা চেক করুন
              </div>
              <div className="text-[11px] text-green-700/80 mt-0.5">
                মোট {formatBengaliCurrency(totalCreditUnpaid)} পাওনা বাকি
              </div>
            </div>
          </Link>
        </div>
      </Card>

      {/* 7. উৎসব কার্ড (Festival Preview) */}
      {upcomingFestival && (
        <Card className="p-4 sm:p-5 border-l-4 border-l-amber-500 bg-amber-50/60 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-400/30 text-amber-800 flex items-center justify-center shrink-0">
              <Calendar className="w-5 h-5 text-brand-orange" />
            </div>
            <div>
              <div className="text-xs font-bold text-brand-orange uppercase">
                আসন্ন উৎসবের বাড়তি চাহিদা
              </div>
              <div className="text-sm sm:text-base font-extrabold text-brand-brown">
                {lang === 'bn' ? (upcomingFestival.nameBn || upcomingFestival.name) : upcomingFestival.name}
                <span className="ml-2 text-xs font-normal text-brand-brown/70">
                  (আর {toBengaliDigits(upcomingFestival.daysUntil)} দিন বাকি)
                </span>
              </div>
            </div>
          </div>

          <Link
            to="/festivals"
            className="py-2 px-4 rounded-xl text-xs font-bold bg-brand-yellow hover:brightness-105 text-brand-brown shadow-sm transition-all"
          >
            উৎসব পরিকল্পনা দেখুন →
          </Link>
        </Card>
      )}

      {/* 8 & 9. Row: সাপ্তাহিক ৭-দিনের বিক্রয় গ্রাফ + চাল/ডাল/তেলের StockBar কার্ড */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Weekly Sales Chart */}
        <Card className="p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-extrabold text-brand-brown flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-brand-orange" />
                <span>সাপ্তাহিক ৭ দিনের বিক্রয় (৳)</span>
              </h4>
              <span className="text-xs text-brand-brown/60">দৈনিক মোট আয়</span>
            </div>

            <div className="h-44 w-full pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={salesChartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="#A0785A" />
                  <YAxis tick={{ fontSize: 10 }} stroke="#A0785A" />
                  <Tooltip
                    formatter={(val: number) => [formatBengaliCurrency(val), 'বিক্রয়']}
                    contentStyle={{
                      backgroundColor: '#FFFDF5',
                      borderColor: '#F0D080',
                      color: '#4A2E0F',
                      borderRadius: '12px',
                      fontSize: '12px',
                      boxShadow: '0 4px 16px rgba(74, 46, 15, 0.15)',
                    }}
                  />
                  <Bar dataKey="total" fill="#F4A900" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </Card>

        {/* চাল/ডাল/তেলের StockBar কার্ড */}
        <Card className="p-5 flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center justify-between mb-1">
              <h4 className="text-sm font-extrabold text-brand-brown flex items-center gap-2">
                <Package className="w-4 h-4 text-brand-orange" />
                <span>প্রধান পণ্যের বর্তমান মজুদ লেভেল</span>
              </h4>
              <Link to="/inventory" className="text-xs font-bold text-brand-orange hover:underline">
                ইনভেন্টরি →
              </Link>
            </div>
            <p className="text-xs text-brand-brown/60 mb-3">
              চাল, ডাল ও তেলের স্টক লেভেল পর্যবেক্ষণ
            </p>

            <div className="space-y-4">
              {stapleStock.map((item, idx) => (
                <div key={idx} className="p-2.5 rounded-xl bg-amber-50/50 border border-amber-200/50">
                  <div className="flex items-center gap-2.5 mb-1.5">
                    <ProductIcon name={item.name} category={item.category} size={28} />
                    <span className="text-xs font-bold text-brand-brown">{item.name}</span>
                  </div>
                  <StockBar
                    current={item.current}
                    max={item.max}
                    threshold={15}
                    unit={item.unit}
                    showNumbers
                  />
                </div>
              ))}
            </div>
          </div>
        </Card>
      </div>

      {/* Quick Cashier Sale Modal / Bottom Drawer */}
      <QuickSaleModal
        isOpen={quickSaleOpen}
        onClose={() => setQuickSaleOpen(false)}
      />
    </div>
  )
}
