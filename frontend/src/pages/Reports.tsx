// Business reports and insights with Recharts charts
import { useMemo, useState, useEffect, useCallback } from 'react'
import {
  BarChart2,
  TrendingUp,
  PieChart as PieIcon,
  AlertTriangle,
  Clock,
  DollarSign,
  TrendingDown,
  Info,
} from 'lucide-react'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts'
import { format, subDays } from 'date-fns'
import { useLang } from '@/i18n'
import { useTheme } from '@/providers/ThemeProvider'
import { useShopContext } from '@/hooks/useShopContext'
import { useProducts, useBatches, useSales } from '@/db/hooks'
import { calculateBatchRisk, calcExpiryStats } from '@/engines/expiry'
import { Card, DemoBadge } from '@/components/ui'
import { toBengaliDigits } from '@/lib/bn'
import { AnimatedNumber, Sparkline } from '@/components/motion'
import { api, getAuditedOutletId, type SalesTrendResponse } from '@/lib/api'
import type { Product, Batch, Sale, ProductCategory } from '@/types'

const CATEGORY_COLORS: Record<string, string> = {
  grain: '#F2A900',
  oil: '#CC6F00',
  dairy: '#3B82F6',
  vegetables: '#10B981',
  spices: '#EF4444',
  beverages: '#8B5CF6',
  snacks: '#F59E0B',
  cleaning: '#06B6D4',
  other: '#6B7280',
}

const RISK_COLORS: Record<string, string> = {
  expired: '#DC2626',
  high: '#EA580C',
  medium: '#D97706',
  low: '#EAB308',
  safe: '#16A34A',
}

export default function Reports() {
  const { t, lang, formatNum, formatCurrency } = useLang()
  const { currentShop } = useShopContext()
  const { isDark } = useTheme()

  const shopId = currentShop?.id || 'shop-student-01'
  const rawProducts = useProducts(shopId) as Product[] | undefined
  const rawBatches = useBatches(shopId) as Batch[] | undefined
  const rawSales = useSales(shopId, 30)

  const products = rawProducts || []
  const batches = rawBatches || []
  const sales = rawSales || []

  // Backend Integration State (Stage 4.9)
  const outletId = getAuditedOutletId(shopId)
  const [backendTrend, setBackendTrend] = useState<SalesTrendResponse | null>(null)
  const [trendLoading, setTrendLoading] = useState(false)
  const [trendError, setTrendError] = useState<string | null>(null)

  const fetchSalesTrend = useCallback(async () => {
    if (!outletId) {
      setBackendTrend(null)
      setTrendLoading(false)
      setTrendError(null)
      return
    }
    setTrendLoading(true)
    setTrendError(null)
    try {
      const res = await api.salesTrend(outletId, { days: 30 })
      setBackendTrend(res)
    } catch (err: any) {
      console.warn('Reports sales trend fetch failed, using local fallback:', err)
      setTrendError(err.message || 'Backend unreachable')
      setBackendTrend(null)
    } finally {
      setTrendLoading(false)
    }
  }, [outletId])

  useEffect(() => {
    fetchSalesTrend()
  }, [fetchSalesTrend])

  const dataSource: 'backend' | 'local' | 'loading' | 'error' = trendLoading
    ? 'loading'
    : trendError
    ? 'error'
    : backendTrend
    ? 'backend'
    : 'local'

  // 1. Sales Trend Data (last 30 days)
  const salesTrendData = useMemo(() => {
    const days = Array.from({ length: 30 }, (_, i) => {
      const d = subDays(new Date(), 29 - i)
      const dayStr = format(d, 'yyyy-MM-dd')
      const label = format(d, 'dd MMM')
      const total = sales
        .filter((s) => s.soldAt.startsWith(dayStr) && !s.deleted)
        .reduce((sum, s) => sum + s.quantity * s.pricePerUnit, 0)
      return { date: label, total }
    })
    return days
  }, [sales])

  // Provenance-isolated displayed trend data (Never silently mix backend and mock data)
  const displayedTrendData = useMemo(() => {
    if (backendTrend && backendTrend.trend && backendTrend.trend.length > 0) {
      return backendTrend.trend.map((pt) => {
        const d = new Date(pt.date + 'T00:00:00')
        const label = format(d, 'dd MMM')
        return {
          date: label,
          total: pt.revenue_bdt,
          transactions: pt.transaction_count,
        }
      })
    }
    return salesTrendData
  }, [backendTrend, salesTrendData])

  const displayedTotalRevenue = backendTrend
    ? backendTrend.total_revenue_bdt
    : salesTrendData.reduce((acc, s) => acc + s.total, 0)

  // 2. Inventory Distribution by Category
  const categoryData = useMemo(() => {
    const map = new Map<string, number>()
    for (const p of products) {
      const pBatches = batches.filter((b) => b.productId === p.id && !b.deleted)
      const totalStock = pBatches.reduce((acc, b) => acc + b.quantity, 0)
      const current = map.get(p.category) || 0
      map.set(p.category, current + totalStock)
    }

    return Array.from(map.entries()).map(([cat, value]) => ({
      name: t.categories[cat as ProductCategory] || cat,
      category: cat,
      value,
    }))
  }, [products, batches, t])

  // 3. Low Stock Items (top 5 with lowest stock)
  const lowStockData = useMemo(() => {
    return products
      .map((p) => {
        const pBatches = batches.filter((b) => b.productId === p.id && !b.deleted)
        const totalStock = pBatches.reduce((acc, b) => acc + b.quantity, 0)
        return { name: p.name, stock: totalStock }
      })
      .filter((p) => p.stock <= 15)
      .sort((a, b) => a.stock - b.stock)
      .slice(0, 6)
  }, [products, batches])

  // 4. Expiry Risk Breakdown
  const batchesWithRisk = useMemo(() => {
    const prodMap = new Map(products.map((p) => [p.id, p]))
    return batches
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
  }, [products, batches, sales])

  const expiryStats = useMemo(() => calcExpiryStats(batchesWithRisk), [batchesWithRisk])

  const riskDistributionData = useMemo(() => {
    const counts: Record<string, number> = { expired: 0, high: 0, medium: 0, low: 0, safe: 0 }
    for (const b of batchesWithRisk) {
      counts[b.risk] = (counts[b.risk] || 0) + 1
    }

    return [
      { name: t.expiry.expired, key: 'expired', count: counts.expired },
      { name: t.expiry.highRisk, key: 'high', count: counts.high },
      { name: t.expiry.mediumRisk, key: 'medium', count: counts.medium },
      { name: t.expiry.lowRisk, key: 'low', count: counts.low },
      { name: t.expiry.safe, key: 'safe', count: counts.safe },
    ]
  }, [batchesWithRisk, t])

  // Axis stroke & Tooltip styles depending on dark mode
  const axisColor = isDark ? '#A0785A' : '#7D5A38'
  const tooltipContentStyle = {
    backgroundColor: isDark ? '#261408' : '#FFFDF5',
    borderColor: isDark ? '#6B3E14' : '#F0D080',
    color: isDark ? '#FFFDF5' : '#4D2A00',
    borderRadius: '12px',
    fontSize: '12px',
    boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
  }
  const tooltipItemStyle = {
    color: isDark ? '#FFFDF5' : '#4D2A00',
  }
  const tooltipLabelStyle = {
    color: isDark ? '#FFFDF5' : '#4D2A00',
    fontWeight: 'bold',
  }

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl sm:text-2xl font-bold text-brand-brown dark:text-brand-cream">
              {t.reports.salesTrend || (lang === 'bn' ? 'রিপোর্ট ও বিশ্লেষণ' : 'Reports & Insights')}
            </h1>
            <DemoBadge
              source={dataSource}
              outletId={outletId}
              error={trendError}
              onRetry={fetchSalesTrend}
            />
          </div>
          <p className="text-sm text-brand-brown/70 dark:text-brand-cream/70 mt-1">
            {backendTrend
              ? (lang === 'bn'
                  ? `ব্যাকএন্ড ৩০-দিনের নির্ভুল বিক্রয় প্রবণতা (${outletId}): মোট ৳${formatNum(backendTrend.total_revenue_bdt)}`
                  : `Backend 30-Day Sales Trend (${outletId}): Total ৳${formatNum(backendTrend.total_revenue_bdt)}`)
              : (lang === 'bn'
                  ? 'বিক্রয়ের প্রবণতা, ইনভেন্টরি বিন্যাস ও ক্ষতি কমানোর বিশ্লেষণ'
                  : 'Sales trends, stock distribution, and wastage reduction analytics')}
          </p>
        </div>
      </div>

      {/* Wastage Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-4 border-l-4 border-l-red-500">
          <span className="text-xs font-bold uppercase text-brand-brown/70 dark:text-brand-cream/70">
            {t.dashboard.potentialWastage}
          </span>
          <div className="text-2xl font-bold text-red-600 mt-1">
            <AnimatedNumber value={expiryStats.estimatedLoss} isCurrency />
          </div>
          <span className="text-xs text-brand-brown/60 dark:text-brand-cream/60 mt-0.5 block">
            {lang === 'bn' ? 'যদি কোনো ছাড় ছাড়া মেয়াদ শেষ হয়' : 'Estimated if unsold at full price'}
          </span>
        </Card>

        <Card className="p-4 border-l-4 border-l-amber-500">
          <span className="text-xs font-bold uppercase text-brand-brown/70 dark:text-brand-cream/70">
            {t.expiry.highRiskBatches}
          </span>
          <div className="text-2xl font-bold text-amber-600 mt-1">
            <AnimatedNumber value={expiryStats.highRiskBatches} /> {lang === 'bn' ? 'টি ব্যাচ' : 'batches'}
          </div>
          <span className="text-xs text-brand-brown/60 dark:text-brand-cream/60 mt-0.5 block">
            {lang === 'bn' ? 'আগামী ৩ দিনের মধ্যে মেয়াদ শেষ' : 'Expiring within 3 days'}
          </span>
        </Card>

        <Card className="p-4 border-l-4 border-l-green-500 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase text-brand-brown/70 dark:text-brand-cream/70">
                {lang === 'bn' ? 'মোট বিক্রয় (গত ৩০ দিন)' : 'Total Sales (30 Days)'}
              </span>
              <Sparkline data={displayedTrendData.map((d) => d.total)} color="#16A34A" width={70} height={22} />
            </div>
            <div className="text-2xl font-bold text-green-600 mt-1">
              <AnimatedNumber value={displayedTotalRevenue} isCurrency />
            </div>
          </div>
          <span className="text-xs text-brand-brown/60 dark:text-brand-cream/60 mt-0.5 block">
            {backendTrend
              ? `গড় দৈনিক: ৳${formatNum(backendTrend.average_daily_revenue_bdt)} • লেনদেন: ${toBengaliDigits(backendTrend.total_transactions)} টি`
              : (lang === 'bn' ? 'নগদ আয়' : 'Gross revenue')}
          </span>
        </Card>
      </div>

      {/* Chart 1: Sales Trend */}
      <Card className="p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-bold text-base text-brand-brown dark:text-brand-cream flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-brand-orange" />
              <span>{t.reports.salesTrend} (৳)</span>
            </h3>
            <p className="text-xs text-brand-brown/60 dark:text-brand-cream/60">
              {backendTrend
                ? `ধারাবাহিক ৩০ দিনের ক্যালেন্ডার রাজস্ব প্রবাহ (${backendTrend.days} দিন, শূন্য-পূরণকৃত)`
                : (lang === 'bn' ? 'গত ৩০ দিনের দৈনিক বিক্রয়ের পরিমাণ' : 'Daily sales totals over the last 30 days')}
            </p>
          </div>
        </div>

        <div className="h-64 w-full pt-4">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={displayedTrendData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke={axisColor} />
              <YAxis tick={{ fontSize: 11 }} stroke={axisColor} />
              <Tooltip
                formatter={(val: number) => [formatCurrency(val), lang === 'bn' ? 'বিক্রয়' : 'Sales']}
                contentStyle={tooltipContentStyle}
                itemStyle={tooltipItemStyle}
                labelStyle={tooltipLabelStyle}
              />
              <Line
                type="monotone"
                dataKey="total"
                stroke="#F2A900"
                strokeWidth={3}
                dot={{ r: 3, fill: '#CC6F00' }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* Row 2: Category Pie + Low Stock Bar */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Inventory Category Distribution */}
        <Card className="p-5 space-y-3 flex flex-col justify-between">
          <div>
            <h3 className="font-bold text-base text-brand-brown dark:text-brand-cream flex items-center gap-2">
              <PieIcon className="w-5 h-5 text-brand-orange" />
              <span>{t.reports.inventoryDistribution}</span>
            </h3>
            <p className="text-xs text-brand-brown/60 dark:text-brand-cream/60">
              {lang === 'bn' ? 'বিভাগভিত্তিক মোট পণ্যের মজুদ সংখ্যা' : 'Stock quantity by product category'}
            </p>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={categoryData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={3}
                  dataKey="value"
                  label={(entry) => entry.name}
                >
                  {categoryData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={CATEGORY_COLORS[entry.category] || '#F2A900'}
                    />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(val: number) => [
                    `${formatNum(val)} ${lang === 'bn' ? 'একক' : 'units'}`,
                    lang === 'bn' ? 'মজুদ' : 'Stock',
                  ]}
                  contentStyle={tooltipContentStyle}
                  itemStyle={tooltipItemStyle}
                  labelStyle={tooltipLabelStyle}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Low Stock Analysis */}
        <Card className="p-5 space-y-3 flex flex-col justify-between">
          <div>
            <h3 className="font-bold text-base text-brand-brown dark:text-brand-cream flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-600" />
              <span>{t.reports.lowStockAnalysis}</span>
            </h3>
            <p className="text-xs text-brand-brown/60 dark:text-brand-cream/60">
              {lang === 'bn' ? 'যেসব পণ্যের মজুদ সবচেয়ে দ্রুত ফুরিয়ে আসছে' : 'Products with lowest current inventory'}
            </p>
          </div>

          <div className="h-64 w-full">
            {lowStockData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-sm text-green-700">
                {lang === 'bn' ? 'সকল পণ্যের পর্যাপ্ত মজুদ আছে' : 'All products have healthy stock levels'}
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={lowStockData}
                  layout="vertical"
                  margin={{ top: 5, right: 20, left: 40, bottom: 5 }}
                >
                  <XAxis type="number" stroke={axisColor} tick={{ fontSize: 11 }} />
                  <YAxis
                    dataKey="name"
                    type="category"
                    stroke={axisColor}
                    tick={{ fontSize: 11 }}
                    width={90}
                  />
                  <Tooltip
                    formatter={(val: number) => [`${formatNum(val)} units`, 'Stock']}
                    contentStyle={tooltipContentStyle}
                    itemStyle={tooltipItemStyle}
                    labelStyle={tooltipLabelStyle}
                  />
                  <Bar dataKey="stock" fill="#EA580C" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>
      </div>

      {/* Row 3: Expiry Risk Distribution */}
      <Card className="p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-bold text-base text-brand-brown dark:text-brand-cream flex items-center gap-2">
              <Clock className="w-5 h-5 text-brand-orange" />
              <span>{t.reports.expiryRisk}</span>
            </h3>
            <p className="text-xs text-brand-brown/60 dark:text-brand-cream/60">
              {lang === 'bn'
                ? 'ঝুঁকি স্তর অনুযায়ী ব্যাচগুলোর বণ্টন'
                : 'Batch count segmented by risk tier'}
            </p>
          </div>
        </div>

        <div className="h-48 w-full pt-2">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={riskDistributionData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
              <XAxis dataKey="name" stroke={axisColor} tick={{ fontSize: 11 }} />
              <YAxis stroke={axisColor} tick={{ fontSize: 11 }} />
              <Tooltip
                formatter={(val: number) => [formatNum(val), lang === 'bn' ? 'ব্যাচ সংখ্যা' : 'Batches']}
                contentStyle={tooltipContentStyle}
                itemStyle={tooltipItemStyle}
                labelStyle={tooltipLabelStyle}
              />
              <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                {riskDistributionData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={RISK_COLORS[entry.key] || '#F2A900'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </div>
  )
}

