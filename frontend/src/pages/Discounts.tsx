// Smart discount suggestions — helps clear stock before expiry (never for expired products)
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Tag,
  ShieldAlert,
  ArrowRight,
  TrendingUp,
  Percent,
  CheckCircle,
  HelpCircle,
  Clock,
} from 'lucide-react'
import { useLang } from '@/i18n'
import { useShopContext } from '@/hooks/useShopContext'
import { useProducts, useBatches, useSales } from '@/db/hooks'
import { calculateBatchRisk } from '@/engines/expiry'
import { suggestDiscount } from '@/engines/discount'
import { Card, Badge, DemoBadge, EmptyState } from '@/components/ui'
import { getRiskBadgeColor, getProductName } from '@/lib/utils'
import type { DiscountSuggestion, Product, Batch } from '@/types'

export default function Discounts() {
  const { t, lang, formatNum, formatCurrency } = useLang()
  const { currentShop } = useShopContext()

  const shopId = currentShop?.id || 'shop-student-01'
  const rawProducts = useProducts(shopId) as Product[] | undefined
  const rawBatches = useBatches(shopId) as Batch[] | undefined
  const rawSales = useSales(shopId, 30)

  const products = rawProducts || []
  const batches = rawBatches || []
  const sales = rawSales || []

  const [selectedRisk, setSelectedRisk] = useState<'all' | 'high' | 'medium' | 'low'>('all')

  // Calculate discount suggestions
  const discountSuggestions = useMemo<DiscountSuggestion[]>(() => {
    if (!products.length || !batches.length) return []
    const prodMap = new Map(products.map((p) => [p.id, p]))
    const suggestions: DiscountSuggestion[] = []

    for (const b of batches) {
      if (b.deleted) continue
      const product = prodMap.get(b.productId)
      if (!product) continue

      const prodSales = sales.filter((s) => s.productId === b.productId)
      const batchWithRisk = calculateBatchRisk({ batch: b, product, recentSales: prodSales })

      // Strict Expiry Safety: NEVER discount expired items, items expiring today, or zero-stock batches
      if (batchWithRisk.daysRemaining <= 0 || batchWithRisk.risk === 'expired' || batchWithRisk.remainingQty <= 0) {
        continue
      }

      // Expiry safety check: engine automatically returns null for expired or safe
      const totalSaleQty = prodSales.reduce((acc, s) => acc + s.quantity, 0)
      const recentDailySales = prodSales.length > 0 ? totalSaleQty / 30 : 0

      const suggestion = suggestDiscount({
        batchWithRisk,
        product,
        recentDailySales,
      })

      if (suggestion) {
        suggestions.push(suggestion)
      }
    }

    return suggestions
  }, [products, batches, sales])

  // Filtered suggestions
  const filteredSuggestions = useMemo(() => {
    if (selectedRisk === 'all') return discountSuggestions
    return discountSuggestions.filter((s) => s.risk === selectedRisk)
  }, [discountSuggestions, selectedRisk])

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold text-brand-brown dark:text-brand-cream">
              {t.discounts.discountSuggestions}
            </h1>
          </div>
          <p className="text-sm text-brand-brown/70 dark:text-brand-cream/70 mt-1">
            {lang === 'bn'
              ? 'মেয়াদ শেষের আগেই দ্রুত বিক্রির জন্য বুদ্ধিমান ছাড়ের প্রস্তাবনা'
              : 'Rule-based smart discounts to recover costs and prevent expiry wastage'}
          </p>
        </div>
      </div>

      {/* Safety Banner */}
      <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700/60 flex items-center gap-3">
        <ShieldAlert className="w-5 h-5 text-amber-700 dark:text-amber-400 flex-shrink-0" />
        <p className="text-xs sm:text-sm text-amber-900 dark:text-amber-200">
          <strong>{t.discounts.noExpiredDiscount || (lang === 'bn' ? 'নিয়ম:' : 'Rule:')}</strong>{' '}
          {lang === 'bn'
            ? 'মেয়াদোত্তীর্ণ পণ্যে কোনো ছাড় দেওয়া যাবে না। শুধুমাত্র ঝুঁকিপূর্ণ ব্যাচেই ছাড়ের সুপারিশ করা হয়।'
            : 'No discounts are ever suggested for expired items. Only at-risk batches nearing expiry are eligible.'}
        </p>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setSelectedRisk('all')}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
            selectedRisk === 'all'
              ? 'bg-brand-yellow text-brand-brown shadow-sm'
              : 'bg-white dark:bg-[#1a0f07] text-brand-brown/70 border border-[#F0D080]/60'
          }`}
        >
          {lang === 'bn' ? 'সব ছাড়' : 'All Discounts'} ({formatNum(discountSuggestions.length)})
        </button>
        <button
          onClick={() => setSelectedRisk('high')}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
            selectedRisk === 'high'
              ? 'bg-brand-yellow text-brand-brown shadow-sm'
              : 'bg-white dark:bg-[#1a0f07] text-brand-brown/70 border border-[#F0D080]/60'
          }`}
        >
          {t.expiry.highRisk} (
          {formatNum(discountSuggestions.filter((s) => s.risk === 'high').length)})
        </button>
        <button
          onClick={() => setSelectedRisk('medium')}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
            selectedRisk === 'medium'
              ? 'bg-brand-yellow text-brand-brown shadow-sm'
              : 'bg-white dark:bg-[#1a0f07] text-brand-brown/70 border border-[#F0D080]/60'
          }`}
        >
          {t.expiry.mediumRisk} (
          {formatNum(discountSuggestions.filter((s) => s.risk === 'medium').length)})
        </button>
      </div>

      {/* Discount Cards Grid */}
      {filteredSuggestions.length === 0 ? (
        <EmptyState
          icon={CheckCircle}
          title={lang === 'bn' ? 'কোনো ছাড়ের প্রয়োজন নেই' : 'No discount recommendations'}
          description={
            lang === 'bn'
              ? 'আপনার কোনো ব্যাচ এই মুহূর্তে মেয়াদ শেষের চরম ঝুঁকিতে নেই।'
              : 'No batches currently require clearance discounting.'
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredSuggestions.map((item) => {
            return (
              <Card key={item.batchId} className="p-5 flex flex-col justify-between space-y-4">
                {/* Header */}
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="font-bold text-lg text-brand-brown dark:text-brand-cream">
                        {getProductName(item, lang)}
                      </h3>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge className={getRiskBadgeColor(item.risk)}>
                          {item.risk === 'high'
                            ? t.expiry.highRisk
                            : item.risk === 'medium'
                            ? t.expiry.mediumRisk
                            : t.expiry.lowRisk}
                        </Badge>
                      </div>
                    </div>

                    <div className="p-2.5 rounded-2xl bg-brand-yellow text-brand-brown font-extrabold text-base flex items-center gap-0.5 shadow-sm">
                      <span>{formatNum(item.discountPercent)}%</span>
                      <span className="text-xs uppercase">{lang === 'bn' ? 'ছাড়' : 'OFF'}</span>
                    </div>
                  </div>

                  {/* Price Comparison */}
                  <div className="mt-4 p-3 rounded-xl bg-brand-cream/30 dark:bg-[#150c05] flex items-center justify-between">
                    <div>
                      <span className="text-xs text-brand-brown/60 dark:text-brand-cream/60 block">
                        {t.discounts.currentPrice}
                      </span>
                      <span className="text-sm font-semibold line-through text-brand-brown/50 dark:text-brand-cream/50">
                        {formatCurrency(item.currentPrice)}
                      </span>
                    </div>

                    <ArrowRight className="w-4 h-4 text-brand-orange" />

                    <div className="text-right">
                      <span className="text-xs text-brand-orange font-bold block">
                        {t.discounts.suggestedPrice}
                      </span>
                      <span className="text-xl font-extrabold text-brand-brown dark:text-brand-cream">
                        {formatCurrency(item.suggestedPrice)}
                      </span>
                    </div>
                  </div>

                  {/* Sales Velocity Stats */}
                  <div className="grid grid-cols-2 gap-3 mt-4 text-xs">
                    <div className="p-2.5 rounded-xl border border-[#F0D080]/30">
                      <span className="text-brand-brown/60 dark:text-brand-cream/60 block">
                        {t.discounts.currentDailyRate}
                      </span>
                      <span className="text-sm font-bold text-brand-brown dark:text-brand-cream">
                        {formatNum(item.currentDailyRate.toFixed(1))}{' '}
                        {lang === 'bn' ? 'একক/দিন' : 'units/day'}
                      </span>
                    </div>

                    <div className="p-2.5 rounded-xl border border-[#F0D080]/30 bg-amber-50/50 dark:bg-amber-950/20">
                      <span className="text-brand-brown/60 dark:text-brand-cream/60 block">
                        {t.discounts.requiredDailySales}
                      </span>
                      <span className="text-sm font-bold text-amber-700 dark:text-amber-300">
                        {formatNum(Math.ceil(item.requiredDailySales))}{' '}
                        {lang === 'bn' ? 'একক/দিন' : 'units/day'}
                      </span>
                    </div>
                  </div>

                  {/* Explanation text */}
                  <div className="mt-3 text-xs text-brand-brown/80 dark:text-brand-cream/80 bg-white/60 dark:bg-[#201309] p-2.5 rounded-xl border border-[#F0D080]/40">
                    <p className="flex items-center gap-1.5 font-medium">
                      <HelpCircle className="w-3.5 h-3.5 text-brand-orange flex-shrink-0" />
                      <span>{item.explanation}</span>
                    </p>
                  </div>
                </div>

                {/* Footer Action */}
                <div className="pt-3 border-t border-[#F0D080]/40 flex items-center justify-between">
                  <div className="text-xs">
                    <span className="text-brand-brown/60 dark:text-brand-cream/60 block">
                      {t.discounts.financialImpact}
                    </span>
                    <span className="font-bold text-green-700 dark:text-green-400">
                      ~{formatCurrency(Math.abs(item.financialImpact))}{' '}
                      {lang === 'bn' ? 'সাশ্রয়' : 'saved'}
                    </span>
                  </div>

                  <Link
                    to="/inventory"
                    className="px-4 py-2 rounded-xl bg-brand-orange text-white font-semibold text-xs hover:bg-brand-brown transition-colors shadow-sm"
                  >
                    {lang === 'bn' ? 'ইনভেন্টরিতে মূল্য পরিবর্তন' : 'Update in Inventory'}
                  </Link>
                </div>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}

