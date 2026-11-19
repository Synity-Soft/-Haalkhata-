// Expiry and wastage risk management — batch-wise risk tracking and removal
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
} from 'lucide-react'
import { useLang } from '@/i18n'
import { useShopContext } from '@/hooks/useShopContext'
import { useProducts, useBatches, useSales } from '@/db/hooks'
import { deleteBatch } from '@/db/mutations'
import { calculateBatchRisk, calcExpiryStats, sortBatchesByRisk } from '@/engines/expiry'
import { Card, Badge, Button, DemoBadge, EmptyState, ProductIcon } from '@/components/ui'
import { getRiskBadgeColor, getProductName } from '@/lib/utils'
import { toBengaliDigits } from '@/lib/bn'
import { HourglassBadge, Stagger } from '@/components/motion'
import { api, getAuditedOutletId, type ExpiryBatchesResponse, type ExpiryBatchItem } from '@/lib/api'
import type { BatchWithRisk, Product, ExpiryRisk } from '@/types'

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

  // Backend Integration State (Stage 4.9)
  const outletId = getAuditedOutletId(shopId)
  const [backendExpiry, setBackendExpiry] = useState<ExpiryBatchesResponse | null>(null)
  const [expiryLoading, setExpiryLoading] = useState(false)
  const [expiryError, setExpiryError] = useState<string | null>(null)

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

  // Calculate batch risks
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

  // Filtered list
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

  const riskFilters: Array<{ id: string; label: string; count: number }> = [
    { id: 'all', label: lang === 'bn' ? 'সব ব্যাচ' : 'All Batches', count: batchesWithRisk.length },
    {
      id: 'expired',
      label: t.expiry.expired,
      count: batchesWithRisk.filter((b) => b.risk === 'expired').length,
    },
    {
      id: 'high',
      label: t.expiry.highRisk,
      count: batchesWithRisk.filter((b) => b.risk === 'high').length,
    },
    {
      id: 'medium',
      label: t.expiry.mediumRisk,
      count: batchesWithRisk.filter((b) => b.risk === 'medium').length,
    },
    {
      id: 'low',
      label: t.expiry.lowRisk,
      count: batchesWithRisk.filter((b) => b.risk === 'low').length,
    },
  ]

  // Filter Tabs (Backend vs Local)
  const backendRiskFilters = useMemo(() => {
    if (!backendExpiry) return []
    return [
      {
        id: 'all',
        label: lang === 'bn' ? 'সব ব্যাচ' : 'All Batches',
        count: backendExpiry.summary.upcoming_batches_count + backendExpiry.summary.expired_batches_count,
      },
      {
        id: 'upcoming',
        label: lang === 'bn' ? 'আসন্ন ছাড়যোগ্য (৩০ দিন)' : 'Upcoming (≤30 Days)',
        count: backendExpiry.summary.upcoming_batches_count,
      },
      {
        id: 'expired',
        label: lang === 'bn' ? 'মেয়াদোত্তীর্ণ কোয়ারেন্টাইন' : 'Quarantined Expired',
        count: backendExpiry.summary.expired_batches_count,
      },
    ]
  }, [backendExpiry, lang])

  const displayedBackendBatches = useMemo(() => {
    if (!backendExpiry) return []
    if (selectedRiskFilter === 'upcoming') return backendExpiry.upcoming_batches
    if (selectedRiskFilter === 'expired') return backendExpiry.expired_batches
    return [...backendExpiry.upcoming_batches, ...backendExpiry.expired_batches]
  }, [backendExpiry, selectedRiskFilter])

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl sm:text-2xl font-bold text-brand-brown dark:text-brand-cream">
              {t.expiry.expiryManagement}
            </h1>
            <DemoBadge
              source={dataSource}
              outletId={outletId}
              error={expiryError}
              onRetry={fetchExpiryBatches}
            />
          </div>
          <p className="text-sm text-brand-brown/70 dark:text-brand-cream/70 mt-1">
            {backendExpiry
              ? (lang === 'bn'
                  ? `ব্যাকএন্ড কোয়ারেন্টাইন অডিট: ${toBengaliDigits(backendExpiry.summary.upcoming_batches_count)} টি আসন্ন ও ${toBengaliDigits(backendExpiry.summary.expired_batches_count)} টি মেয়াদোত্তীর্ণ ব্যাচ (${outletId})`
                  : `Backend Quarantine Audit: ${backendExpiry.summary.upcoming_batches_count} upcoming & ${backendExpiry.summary.expired_batches_count} expired batches (${outletId})`)
              : (lang === 'bn'
                  ? 'মেয়াদোত্তীর্ণ ও ঝুঁকিপূর্ণ ব্যাচ পর্যবেক্ষণ করে ক্ষতি রোধ করুন'
                  : 'Track expiring batches and prevent potential inventory wastage')}
          </p>
        </div>
      </div>

      {/* Safety Banner (Mandatory Rule) */}
      <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700/60 flex items-center gap-3">
        <AlertOctagon className="w-5 h-5 text-amber-700 dark:text-amber-400 flex-shrink-0" />
        <p className="text-xs sm:text-sm text-amber-900 dark:text-amber-200">
          <strong>{lang === 'bn' ? 'নিরাপত্তা বিধি:' : 'Safety Rule:'}</strong>{' '}
          {lang === 'bn'
            ? 'মেয়াদোত্তীর্ণ পণ্য কখনোই ছাড় দিয়ে বিক্রি করা যাবে না। সেগুলো অবিলম্বে বিক্রয় থেকে সরান ও কোয়ারেন্টাইন করুন।'
            : 'Expired products must NEVER be discounted or sold. Remove them from shelves immediately.'}
        </p>
      </div>

      {/* Summary Metrics Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        {/* Total Expired */}
        <Card className="p-4 border-l-4 border-l-red-500">
          <div className="flex items-center justify-between text-red-600">
            <span className="text-xs font-semibold uppercase">{t.expiry.totalExpired}</span>
            <AlertOctagon className="w-5 h-5" />
          </div>
          <p className="text-2xl font-bold text-red-600 mt-2">
            {backendExpiry
              ? formatNum(backendExpiry.summary.expired_batches_count)
              : formatNum(stats.totalExpired)}
          </p>
          <span className="text-xs text-red-700 dark:text-red-400 font-medium mt-1 block">
            {t.expiry.removeFromSale}
          </span>
        </Card>

        {/* Expiring ≤ 7 or 30 Days */}
        <Card className="p-4 border-l-4 border-l-orange-500">
          <div className="flex items-center justify-between text-orange-600">
            <span className="text-xs font-semibold uppercase">
              {backendExpiry ? 'আসন্ন মেয়াদ (৩০ দিন)' : t.expiry.totalExpiringSoon}
            </span>
            <Clock className="w-5 h-5" />
          </div>
          <p className="text-2xl font-bold text-orange-600 mt-2">
            {backendExpiry
              ? formatNum(backendExpiry.summary.upcoming_batches_count)
              : formatNum(stats.totalExpiringSoon)}
          </p>
          <span className="text-xs text-brand-brown/70 dark:text-brand-cream/70 mt-1 block">
            {backendExpiry ? 'ছাড়যোগ্য ব্যাচ' : lang === 'bn' ? '৭ দিনের মধ্যে' : 'Within 7 days'}
          </span>
        </Card>

        {/* Upcoming Cost Exposure / High Risk */}
        <Card className="p-4 border-l-4 border-l-amber-500">
          <div className="flex items-center justify-between text-amber-600">
            <span className="text-xs font-semibold uppercase">
              {backendExpiry ? 'ছাড়যোগ্য মূল্য ঝুঁকি' : t.expiry.highRiskBatches}
            </span>
            <AlertTriangle className="w-5 h-5" />
          </div>
          <p className="text-2xl font-bold text-amber-600 mt-2">
            {backendExpiry
              ? `৳${formatNum(backendExpiry.summary.upcoming_cost_exposure_bdt)}`
              : formatNum(stats.highRiskBatches)}
          </p>
          <span className="text-xs text-brand-brown/70 dark:text-brand-cream/70 mt-1 block">
            {backendExpiry ? 'ছাড় দিয়ে রিকভারি সুযোগ' : lang === 'bn' ? 'জরুরি পদক্ষেপ প্রয়োজন' : 'Needs fast action'}
          </span>
        </Card>

        {/* Estimated Loss / Expired Sunk Cost */}
        <Card className="p-4 border-l-4 border-l-red-600">
          <div className="flex items-center justify-between text-red-600">
            <span className="text-xs font-semibold uppercase">
              {backendExpiry ? 'মেয়াদোত্তীর্ণ ক্ষতি' : t.expiry.estimatedLoss}
            </span>
            <TrendingDown className="w-5 h-5" />
          </div>
          <p className="text-2xl font-bold text-red-600 mt-2">
            {backendExpiry
              ? `৳${formatNum(backendExpiry.summary.expired_cost_exposure_bdt)}`
              : formatCurrency(stats.estimatedLoss)}
          </p>
          <span className="text-xs text-brand-brown/70 dark:text-brand-cream/70 mt-1 block">
            {lang === 'bn' ? 'সম্ভাব্য নষ্ট পণ্যের ক্ষতি' : 'Total potential loss'}
          </span>
        </Card>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {(backendExpiry ? backendRiskFilters : riskFilters).map((rf) => (
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

      {/* Batch Cards / Table */}
      {expiryLoading ? (
        <Card className="p-8 text-center text-brand-brown/70 dark:text-brand-cream/70">
          <div className="animate-spin w-8 h-8 border-4 border-brand-orange border-t-transparent rounded-full mx-auto mb-3" />
          <p className="font-semibold text-sm">
            {lang === 'bn' ? 'ব্যাকএন্ড মেয়াদ ঝুঁকি ডাটা লোড হচ্ছে...' : 'Loading expiry data from backend...'}
          </p>
        </Card>
      ) : backendExpiry ? (
        displayedBackendBatches.length === 0 ? (
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
            {displayedBackendBatches.map((item) => {
              const isExpired = item.status === 'expired' || item.days_remaining < 0

              return (
                <Card
                  key={item.batch_id}
                  className={`p-4 sm:p-5 transition-all ${
                    isExpired
                      ? 'border-l-4 border-l-red-600 bg-red-50/20 dark:bg-red-950/10'
                      : 'border-l-4 border-l-orange-500'
                  }`}
                >
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3">
                        <ProductIcon name={item.product_name} category={item.category as any} size={36} />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-bold text-base sm:text-lg text-brand-brown dark:text-brand-cream">
                              {lang === 'bn' ? (item.product_name_bn || item.product_name) : item.product_name}
                            </h3>
                            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-brand-cream dark:bg-[#38200f] text-brand-brown dark:text-brand-cream">
                              {item.batch_id} • {item.product_id}
                            </span>
                            <span className="px-2 py-0.5 rounded-full bg-brand-cream dark:bg-[#38200f] text-xs text-brand-brown dark:text-brand-cream">
                              {item.category}
                            </span>
                            {isExpired ? (
                              <Badge variant="danger" className="flex items-center gap-1">
                                <AlertOctagon className="w-3.5 h-3.5" />
                                <span>মেয়াদোত্তীর্ণ (কোয়ারেন্টাইন)</span>
                              </Badge>
                            ) : (
                              <Badge variant="warning" className="flex items-center gap-1">
                                <Clock className="w-3.5 h-3.5" />
                                <span>আসন্ন মেয়াদ ({toBengaliDigits(item.days_remaining)} দিন বাকি)</span>
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3 text-xs">
                        <div>
                          <span className="text-brand-brown/60 dark:text-brand-cream/60 block">মজুদ পরিমাণ</span>
                          <strong className="text-sm text-brand-brown dark:text-brand-cream">
                            {formatNum(item.remaining_quantity)} {item.unit}
                          </strong>
                        </div>
                        <div>
                          <span className="text-brand-brown/60 dark:text-brand-cream/60 block">মেয়াদ উত্তীর্ণ তারিখ</span>
                          <strong className={`text-sm ${isExpired ? 'text-red-600 font-bold' : 'text-orange-600'}`}>
                            {item.expiry_date} ({isExpired ? `${toBengaliDigits(Math.abs(item.days_remaining))} দিন আগে` : `${toBengaliDigits(item.days_remaining)} দিন বাকি`})
                          </strong>
                        </div>
                        <div>
                          <span className="text-brand-brown/60 dark:text-brand-cream/60 block">একক কেনা মূল্য</span>
                          <strong className="text-sm text-brand-brown dark:text-brand-cream">
                            ৳{formatNum(item.unit_cost_bdt)}
                          </strong>
                        </div>
                        <div>
                          <span className="text-brand-brown/60 dark:text-brand-cream/60 block">আর্থিক লোকসান ঝুঁকি</span>
                          <strong className="text-sm text-red-600">
                            ৳{formatNum(item.total_cost_exposure_bdt)}
                          </strong>
                        </div>
                      </div>
                    </div>

                    <div className="shrink-0 flex items-center md:flex-col gap-2 justify-end">
                      {isExpired ? (
                        <div className="px-3.5 py-2 rounded-xl bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-300 font-bold text-xs flex items-center gap-1.5 border border-red-300/40 shadow-sm">
                          <ShieldAlert className="w-4 h-4 text-red-600 dark:text-red-400" />
                          <span>বিক্রি নিষিদ্ধ (কোয়ারেন্টাইন)</span>
                        </div>
                      ) : (
                        <Link
                          to="/discounts"
                          className="px-4 py-2 rounded-xl bg-brand-yellow hover:bg-brand-orange text-brand-brown font-bold text-xs flex items-center gap-1.5 shadow-sm transition-colors"
                        >
                          <Tag className="w-3.5 h-3.5" />
                          <span>ছাড় দিন</span>
                        </Link>
                      )}
                    </div>
                  </div>
                </Card>
              )
            })}
          </Stagger>
        )
      ) : filteredBatches.length === 0 ? (
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
                  {/* Left: Product & Risk */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3">
                      <ProductIcon name={item.productName || ''} category={item.productCategory} size={36} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-bold text-base sm:text-lg text-brand-brown dark:text-brand-cream">
                            {getProductName(item, lang)}
                          </h3>
                          <span className="px-2 py-0.5 rounded-full bg-brand-cream dark:bg-[#38200f] text-xs text-brand-brown dark:text-brand-cream">
                            {t.categories[item.productCategory] || item.productCategory}
                          </span>
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
                          {item.daysRemaining <= 5 && (
                            <HourglassBadge daysRemaining={item.daysRemaining} />
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Expiry date details */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3 text-xs">
                      <div>
                        <span className="text-brand-brown/60 dark:text-brand-cream/60 block">
                          {t.inventory.quantity}
                        </span>
                        <strong className="text-sm text-brand-brown dark:text-brand-cream">
                          {formatNum(item.remainingQty)}
                        </strong>
                      </div>

                      <div>
                        <span className="text-brand-brown/60 dark:text-brand-cream/60 block">
                          {t.expiry.daysRemaining}
                        </span>
                        <strong
                          className={`text-sm ${
                            isExpired
                              ? 'text-red-600 font-bold'
                              : item.daysRemaining <= 3
                              ? 'text-orange-600'
                              : 'text-brand-brown dark:text-brand-cream'
                          }`}
                        >
                          {isExpired
                            ? `${formatNum(Math.abs(item.daysRemaining))} ${
                                lang === 'bn' ? 'দিন আগে শেষ' : 'days ago'
                              }`
                            : `${formatNum(item.daysRemaining)} ${lang === 'bn' ? 'দিন' : 'days'}`}
                        </strong>
                      </div>

                      <div>
                        <span className="text-brand-brown/60 dark:text-brand-cream/60 block">
                          {t.expiry.expectedUnsold}
                        </span>
                        <strong className="text-sm text-amber-600">
                          {formatNum(Math.round(item.expectedUnsold))}
                        </strong>
                      </div>

                      <div>
                        <span className="text-brand-brown/60 dark:text-brand-cream/60 block">
                          {t.expiry.potentialLoss}
                        </span>
                        <strong className="text-sm text-red-600">
                          {formatCurrency(item.potentialLoss)}
                        </strong>
                      </div>
                    </div>
                  </div>

                  {/* Right: Actions */}
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
                    ) : item.risk === 'high' || item.risk === 'medium' ? (
                      <Link
                        to="/discounts"
                        className="px-4 py-2 rounded-xl bg-brand-yellow hover:bg-brand-orange text-brand-brown font-bold text-xs flex items-center gap-1.5 transition-colors shadow-sm"
                      >
                        <Tag className="w-4 h-4" />
                        <span>{lang === 'bn' ? 'ছাড় দেখুন' : 'View Discount'}</span>
                      </Link>
                    ) : (
                      <span className="text-xs text-green-700 dark:text-green-400 font-medium">
                        {lang === 'bn' ? 'স্বাভাবিক অবস্থায়' : 'Normal state'}
                      </span>
                    )}
                  </div>
                </div>
              </Card>
            )
          })}
        </Stagger>
      )}
    </div>
  )
}

