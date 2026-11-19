// Area-Based Smart Purchase Suggestions — offline-first demand estimation
import { useState, useMemo } from 'react'
import {
  ShoppingCart,
  CheckCircle,
  HelpCircle,
  MapPin,
  ClipboardList,
  Check,
  Package,
  Layers,
  Store,
} from 'lucide-react'
import { useLang } from '@/i18n'
import { useShopContext } from '@/hooks/useShopContext'
import { useProducts, useBatches, useSales } from '@/db/hooks'
import { calcPurchaseSuggestion } from '@/engines/purchase'
import { Card, EmptyState, ProductIcon } from '@/components/ui'
import { getProductName } from '@/lib/utils'
import { TruckRoad, Stagger, showSaveToast } from '@/components/motion'
import type { Product, Batch, PurchaseSuggestion, ProductCategory } from '@/types'

export default function Purchase() {
  const { t, lang, formatNum, formatCurrency } = useLang()
  const { currentShop, shops, selectShopId } = useShopContext()

  const shopId = currentShop?.id || 'shop-student-01'
  const rawProducts = useProducts(shopId) as Product[] | undefined
  const rawBatches = useBatches(shopId) as Batch[] | undefined
  const rawSales = useSales(shopId, 60)

  const products = rawProducts || []
  const batches = rawBatches || []
  const sales = rawSales || []

  // Control settings
  const [planningPeriod, setPlanningPeriod] = useState<number>(7) // 7, 14, 30 days
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [reorderFilterActive, setReorderFilterActive] = useState<boolean>(false)
  const [copied, setCopied] = useState<boolean>(false)

  const areaType = currentShop?.areaType || 'student'

  // Calculate suggestions
  const suggestions = useMemo<PurchaseSuggestion[]>(() => {
    if (!products.length) return []

    return products
      .map((p) => {
        const pBatches = batches.filter((b) => b.productId === p.id && !b.deleted)
        const currentStock = pBatches.reduce((acc, b) => acc + b.quantity, 0)
        const pSales = sales.filter((s) => s.productId === p.id && !s.deleted)

        return calcPurchaseSuggestion({
          product: p,
          currentStock,
          recentSales: pSales,
          areaType,
          planningDays: planningPeriod,
          safetyStockDays: 2,
        })
      })
      .sort((a, b) => b.suggestedOrder - a.suggestedOrder)
  }, [products, batches, sales, areaType, planningPeriod])

  // Filtered by category and reorder switch
  const filteredSuggestions = useMemo(() => {
    let list = suggestions
    if (selectedCategory !== 'all') {
      list = list.filter((s) => s.category === selectedCategory)
    }
    if (reorderFilterActive) {
      list = list.filter((s) => s.suggestedOrder > 0)
    }
    return list
  }, [suggestions, selectedCategory, reorderFilterActive])

  const itemsNeedingOrder = useMemo(() => {
    return suggestions.filter((s) => s.suggestedOrder > 0)
  }, [suggestions])

  const categoriesList: ProductCategory[] = [
    'grain',
    'oil',
    'dairy',
    'vegetables',
    'spices',
    'beverages',
    'snacks',
    'cleaning',
    'other',
  ]

  const handleCopyList = () => {
    const lines = itemsNeedingOrder.map(
      (item, i) =>
        `${i + 1}. ${getProductName(item, lang)}: ${item.suggestedOrder} units (Stock: ${item.currentStock})`
    )
    const text = `Hat-Bazar ERP — Reorder List (${currentShop?.nameEn || currentShop?.name || 'Main Branch'}):\n${lines.join('\n')}`
    navigator.clipboard?.writeText(text)
    setCopied(true)
    showSaveToast(lang === 'bn' ? 'অর্ডার তালিকা কপি হয়েছে ✓' : 'Reorder checklist copied ✓')
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="space-y-6">
      {/* Animated Truck on Road banner */}
      <TruckRoad />
      {/* Title & Interactive Switch */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold text-brand-brown dark:text-brand-cream">
              {t.purchase.purchaseSuggestions}
            </h1>
          </div>
          <p className="text-sm text-brand-brown/70 dark:text-brand-cream/70 mt-1">
            {lang === 'bn'
              ? 'বিক্রয় ইতিহাস ও দোকান শাখার চাহিদা বিবেচনা করে নতুন ক্রয়ের সুপারিশ'
              : 'Estimate demand and reorder stock based on sales trends for this branch'}
          </p>
        </div>

        {/* Interactive Switch Button: Items to Reorder */}
        <button
          type="button"
          onClick={() => setReorderFilterActive((prev) => !prev)}
          className={`flex items-center gap-2.5 px-4 py-2.5 rounded-2xl font-bold text-xs sm:text-sm transition-all duration-200 shadow-sm border ${
            reorderFilterActive
              ? 'bg-brand-yellow text-brand-brown border-brand-orange ring-2 ring-brand-orange/40 shadow-md scale-[1.02]'
              : 'bg-brand-yellow/20 hover:bg-brand-yellow/40 text-brand-brown dark:text-brand-cream border-brand-yellow/60'
          }`}
          title={
            reorderFilterActive
              ? lang === 'bn' ? 'সকল পণ্য দেখুন' : 'Show all products'
              : lang === 'bn' ? 'রিঅর্ডার তালিকা ফিল্টার করুন' : 'Click to view reorder list only'
          }
        >
          <ShoppingCart className="w-5 h-5 text-brand-orange" />
          <span>
            {formatNum(itemsNeedingOrder.length)}{' '}
            {lang === 'bn' ? 'টি পণ্য অর্ডার প্রয়োজন' : 'items to reorder'}
          </span>
          <span
            className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider transition-colors ${
              reorderFilterActive
                ? 'bg-brand-brown text-white'
                : 'bg-brand-yellow/60 text-brand-brown'
            }`}
          >
            {reorderFilterActive
              ? lang === 'bn' ? 'সক্রিয়' : 'ON'
              : lang === 'bn' ? 'ক্লিক করুন' : 'VIEW'}
          </span>
        </button>
      </div>

      {/* Dedicated Reorder List Panel (Shown when Switch is clicked/active) */}
      {reorderFilterActive && (
        <Card className="p-4 sm:p-5 bg-gradient-to-br from-amber-50 to-amber-100/40 dark:from-[#241306] dark:to-[#1a0e05] border-2 border-brand-orange/60 shadow-md">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-amber-200 dark:border-amber-900/60">
            <div className="flex items-center gap-2">
              <ClipboardList className="w-5 h-5 text-brand-orange" />
              <h3 className="font-bold text-base text-brand-brown dark:text-brand-cream">
                {lang === 'bn' ? 'পুনরায় অর্ডার করার পূর্ণাঙ্গ তালিকা' : 'Fast Reorder Checklist'}
              </h3>
              <span className="text-xs px-2 py-0.5 rounded-full bg-brand-yellow font-bold text-brand-brown">
                {itemsNeedingOrder.length} {lang === 'bn' ? 'আইটেম' : 'items'}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleCopyList}
                className="px-3 py-1.5 rounded-xl bg-white dark:bg-black/40 border border-amber-300 dark:border-amber-800 text-xs font-bold text-brand-brown dark:text-brand-cream hover:bg-amber-100 transition-colors flex items-center gap-1.5"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-green-600" /> : <ClipboardList className="w-3.5 h-3.5 text-brand-orange" />}
                <span>{copied ? (lang === 'bn' ? 'কপি হয়েছে!' : 'Copied!') : (lang === 'bn' ? 'তালিকা কপি করুন' : 'Copy Checklist')}</span>
              </button>
              <button
                type="button"
                onClick={() => setReorderFilterActive(false)}
                className="text-xs text-brand-brown/60 dark:text-brand-cream/60 hover:text-brand-brown underline px-2"
              >
                {lang === 'bn' ? 'বন্ধ করুন' : 'Close View'}
              </button>
            </div>
          </div>

          {itemsNeedingOrder.length === 0 ? (
            <p className="py-4 text-sm text-green-700 dark:text-green-400 font-medium text-center">
              {lang === 'bn'
                ? 'বর্তমানে কোনো পণ্যের নতুন অর্ডার প্রয়োজন নেই। সকল মজুদ পর্যাপ্ত!'
                : 'All product stocks are currently healthy. No reorders needed!'}
            </p>
          ) : (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead>
                  <tr className="border-b border-amber-200 dark:border-amber-900/40 text-brand-brown/70 dark:text-brand-cream/70 text-[11px] uppercase">
                    <th className="py-2 px-3">{lang === 'bn' ? 'পণ্য' : 'Product'}</th>
                    <th className="py-2 px-3">{lang === 'bn' ? 'ক্যাটাগরি' : 'Category'}</th>
                    <th className="py-2 px-3">{lang === 'bn' ? 'বর্তমান মজুদ' : 'Current Stock'}</th>
                    <th className="py-2 px-3">{lang === 'bn' ? 'প্রস্তাবিত অর্ডার' : 'Order Qty'}</th>
                    <th className="py-2 px-3 text-right">{lang === 'bn' ? 'দৈনিক বিক্রি' : 'Daily Rate'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-amber-100 dark:divide-amber-950/60">
                  {itemsNeedingOrder.map((item) => (
                    <tr key={item.productId} className="hover:bg-white/50 dark:hover:bg-white/5 transition-colors">
                      <td className="py-2.5 px-3 font-bold text-brand-brown dark:text-brand-cream">
                        {getProductName(item, lang)}
                      </td>
                      <td className="py-2.5 px-3 text-brand-brown/70 dark:text-brand-cream/70">
                        {t.categories[item.category] || item.category}
                      </td>
                      <td className="py-2.5 px-3 font-semibold text-red-600 dark:text-red-400">
                        {formatNum(item.currentStock)}
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="px-2.5 py-1 rounded-lg bg-brand-yellow font-extrabold text-brand-brown">
                          +{formatNum(item.suggestedOrder)}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right text-brand-brown/70 dark:text-brand-cream/70 font-mono">
                        {formatNum(item.avgDailySales.toFixed(1))} /day
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {/* Controls Bar: Branch Selector, Planning Period, Category Filter */}
      <Card className="p-4 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Branch Selector (Requirement 6: Replaces Area Type) */}
          <div>
            <label className="block text-xs font-bold text-brand-brown dark:text-brand-cream mb-1 flex items-center gap-1.5">
              <Store className="w-3.5 h-3.5 text-brand-orange" />
              <span>{lang === 'bn' ? 'দোকানের শাখা' : 'Store Branch'}</span>
            </label>
            <select
              value={currentShop?.id || ''}
              onChange={(e) => selectShopId(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-[#F0D080] dark:border-[#4D2A00] bg-white dark:bg-[#1a0f07] text-sm text-brand-brown dark:text-brand-cream focus:ring-2 focus:ring-brand-yellow font-semibold"
            >
              {shops.map((s) => (
                <option key={s.id} value={s.id}>
                  {lang === 'bn' ? s.name : (s.nameEn || s.name)}
                </option>
              ))}
            </select>
          </div>

          {/* Planning Period Selector */}
          <div>
            <label className="block text-xs font-bold text-brand-brown dark:text-brand-cream mb-1">
              {t.purchase.planningPeriod}
            </label>
            <div className="grid grid-cols-3 gap-1">
              {[7, 14, 30].map((days) => (
                <button
                  key={days}
                  type="button"
                  onClick={() => setPlanningPeriod(days)}
                  className={`py-2 text-xs font-bold rounded-xl transition-colors ${
                    planningPeriod === days
                      ? 'bg-brand-yellow text-brand-brown shadow-sm'
                      : 'bg-white dark:bg-[#1a0f07] border border-[#F0D080]/60 text-brand-brown/70 hover:bg-brand-cream/30'
                  }`}
                >
                  {formatNum(days)} {lang === 'bn' ? 'দিন' : 'd'}
                </button>
              ))}
            </div>
          </div>

          {/* Category Filter */}
          <div>
            <label className="block text-xs font-bold text-brand-brown dark:text-brand-cream mb-1">
              {t.inventory.category}
            </label>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-[#F0D080] dark:border-[#4D2A00] bg-white dark:bg-[#1a0f07] text-sm text-brand-brown dark:text-brand-cream focus:ring-2 focus:ring-brand-yellow"
            >
              <option value="all">{t.inventory.allCategories}</option>
              {categoriesList.map((cat) => (
                <option key={cat} value={cat}>
                  {t.categories[cat]}
                </option>
              ))}
            </select>
          </div>
        </div>
      </Card>

      {/* Suggestion Cards */}
      {filteredSuggestions.length === 0 ? (
        <EmptyState
          icon={CheckCircle}
          title={lang === 'bn' ? 'কোনো পণ্য পাওয়া যায়নি' : 'No products available'}
          description={
            lang === 'bn'
              ? 'ইনভেন্টরিতে নতুন পণ্য যোগ করুন যাতে ক্রয় পরামর্শ তৈরি করা যায়।'
              : 'Add products to inventory to generate smart purchase suggestions.'
          }
        />
      ) : (
        <Stagger className="space-y-3">
          {filteredSuggestions.map((item) => {
            const needsOrder = item.suggestedOrder > 0

            return (
              <Card
                key={item.productId}
                className={`p-4 sm:p-5 transition-all ${
                  needsOrder ? 'border-l-4 border-l-brand-yellow' : 'opacity-85'
                }`}
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  {/* Left: Product Info & Metrics */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3">
                      <ProductIcon name={item.productName || (item as any).name || ''} category={item.category} size={36} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-bold text-base sm:text-lg text-brand-brown dark:text-brand-cream">
                            {getProductName(item, lang)}
                          </h3>
                          <span className="px-2 py-0.5 rounded-full bg-brand-cream dark:bg-[#38200f] text-xs font-medium text-brand-brown dark:text-brand-cream">
                            {t.categories[item.category] || item.category}
                          </span>
                          {needsOrder ? (
                            <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200 text-xs font-bold">
                              {lang === 'bn' ? 'অর্ডার প্রয়োজন' : 'Reorder Needed'}
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-200 text-xs font-bold">
                              {lang === 'bn' ? 'পর্যাপ্ত মজুদ' : 'Stock Sufficient'}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Mathematical details row */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3 text-xs">
                      <div>
                        <span className="text-brand-brown/60 dark:text-brand-cream/60 block">
                          {t.purchase.avgDailySales}
                        </span>
                        <strong className="text-sm text-brand-brown dark:text-brand-cream">
                          {formatNum(item.avgDailySales.toFixed(1))} {lang === 'bn' ? 'একক' : 'u/d'}
                        </strong>
                      </div>

                      <div>
                        <span className="text-brand-brown/60 dark:text-brand-cream/60 block">
                          {t.purchase.currentStock}
                        </span>
                        <strong
                          className={`text-sm ${
                            item.currentStock <= item.safetyStock
                              ? 'text-red-600 font-bold'
                              : 'text-brand-brown dark:text-brand-cream'
                          }`}
                        >
                          {formatNum(item.currentStock)}
                        </strong>
                      </div>

                      <div>
                        <span className="text-brand-brown/60 dark:text-brand-cream/60 block">
                          {t.purchase.expectedDemand}
                        </span>
                        <strong className="text-sm text-brand-brown dark:text-brand-cream">
                          {formatNum(Math.ceil(item.expectedDemand))}
                        </strong>
                      </div>

                      <div>
                        <span className="text-brand-brown/60 dark:text-brand-cream/60 block">
                          {lang === 'bn' ? 'শাখার অবস্থান' : 'Branch Location'}
                        </span>
                        <strong className="text-sm text-brand-orange truncate block">
                          {lang === 'bn' ? currentShop?.name : (currentShop?.nameEn || currentShop?.name)}
                        </strong>
                      </div>
                    </div>

                    {/* Plain explanation */}
                    <div className="mt-3 text-xs text-brand-brown/80 dark:text-brand-cream/80 bg-brand-cream/20 dark:bg-[#1a0f07] p-2.5 rounded-xl border border-[#F0D080]/30">
                      <p className="flex items-center gap-1.5">
                        <HelpCircle className="w-3.5 h-3.5 text-brand-orange flex-shrink-0" />
                        <span>{item.explanation}</span>
                      </p>
                    </div>
                  </div>

                  {/* Right: Suggested Order Callout */}
                  <div className="flex md:flex-col items-center justify-between md:justify-center border-t md:border-t-0 pt-3 md:pt-0 min-w-[120px]">
                    <span className="text-xs font-bold uppercase text-brand-brown/70 dark:text-brand-cream/70">
                      {t.purchase.suggestedOrder}
                    </span>
                    <div
                      className={`px-4 py-2 rounded-2xl text-center font-extrabold text-xl mt-1 shadow-sm ${
                        needsOrder
                          ? 'bg-brand-yellow text-brand-brown border-2 border-brand-orange'
                          : 'bg-gray-100 dark:bg-[#201408] text-gray-500'
                      }`}
                    >
                      {formatNum(item.suggestedOrder)}
                    </div>
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
