// Area-Based Smart Purchase Suggestions & Haalkhata Distributor Connector with Price Comparison
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
  Phone,
  MessageCircle,
  ExternalLink,
  Star,
  TrendingUp,
  Sparkles,
  ShieldCheck,
  Truck,
  Building2,
  DollarSign,
  BarChart2,
  Send,
} from 'lucide-react'
import { useLang } from '@/i18n'
import { useShopContext } from '@/hooks/useShopContext'
import { useProducts, useBatches, useSales } from '@/db/hooks'
import { calcPurchaseSuggestion } from '@/engines/purchase'
import { Card, Button, Badge, Modal, EmptyState, ProductIcon } from '@/components/ui'
import { getProductName } from '@/lib/utils'
import { TruckRoad, Stagger, showSaveToast } from '@/components/motion'
import {
  VERIFIED_DISTRIBUTORS,
  DISTRIBUTOR_PRICE_COMPARISONS,
} from '@/mock/haalkhataFeatures'
import type {
  Product,
  Batch,
  PurchaseSuggestion,
  ProductCategory,
  Distributor,
  DistributorPriceComparison,
} from '@/types'

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

  // Top Tab Switcher: 1. Forecast & Restock, 2. Distributor Connector, 3. Price Comparison
  const [mainTab, setMainTab] = useState<'suggestions' | 'distributors' | 'comparison'>('suggestions')

  // Control settings
  const [planningPeriod, setPlanningPeriod] = useState<number>(7) // 7, 14, 30 days
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [reorderFilterActive, setReorderFilterActive] = useState<boolean>(false)
  const [copied, setCopied] = useState<boolean>(false)

  // Distributor Order Modal State
  const [selectedItemForDistributor, setSelectedItemForDistributor] = useState<PurchaseSuggestion | null>(null)
  const [orderQty, setOrderQty] = useState<number>(10)
  const [selectedDistributorId, setSelectedDistributorId] = useState<string>(VERIFIED_DISTRIBUTORS[0].id)
  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false)

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
    const text = `হালখাতা ERP — Reorder Checklist (${currentShop?.nameEn || currentShop?.name || 'Main Branch'}):\n${lines.join('\n')}`
    navigator.clipboard?.writeText(text)
    setCopied(true)
    showSaveToast(lang === 'bn' ? 'অর্ডার তালিকা কপি হয়েছে ✓' : 'Reorder checklist copied ✓')
    setTimeout(() => setCopied(false), 2000)
  }

  // Open Distributor Connect modal for a specific suggested item
  const handleOpenDistributorModal = (item: PurchaseSuggestion) => {
    setSelectedItemForDistributor(item)
    setOrderQty(Math.max(item.suggestedOrder, 10))
    // Match appropriate distributor
    const matchedDistributor = VERIFIED_DISTRIBUTORS.find((d) =>
      d.categories.includes(item.category)
    )
    if (matchedDistributor) {
      setSelectedDistributorId(matchedDistributor.id)
    } else {
      setSelectedDistributorId(VERIFIED_DISTRIBUTORS[0].id)
    }
    setIsOrderModalOpen(true)
  }

  // Send WhatsApp order to distributor
  const handleSendDistributorWhatsApp = (dist: Distributor) => {
    if (!selectedItemForDistributor) return
    const prodName = getProductName(selectedItemForDistributor, lang)
    const shopName = currentShop?.name || 'হালখাতা স্টোর'
    const message = `আসসালামু আলাইকুম ${dist.contactPerson} ভাই। ${shopName} থেকে আমরা অর্ডার করতে চাই:\n\nপণ্য: ${prodName}\nপরিমাণ: ${orderQty} একক\n\nঅনুগ্রহ করে পাইকারি দর ও ডেলিভারি কনফার্ম করবেন কি? ধন্যবাদ।`
    window.open(`https://wa.me/${dist.whatsapp}?text=${encodeURIComponent(message)}`, '_blank')
    showSaveToast(lang === 'bn' ? 'ডিস্ট্রিবিউটরের সাথে যোগাযোগ খোলা হয়েছে ✓' : 'Connecting to distributor via WhatsApp ✓')
    setIsOrderModalOpen(false)
  }

  const handleConfirmDistributorOrder = () => {
    showSaveToast(
      lang === 'bn'
        ? `ডিস্ট্রিবিউটরের কাছে ${orderQty} এককের অর্ডার সিস্টেমে রেকর্ড হয়েছে ✓`
        : `Order of ${orderQty} units recorded with distributor ✓`
    )
    setIsOrderModalOpen(false)
  }

  const activeDistributor = useMemo(() => {
    return VERIFIED_DISTRIBUTORS.find((d) => d.id === selectedDistributorId) || VERIFIED_DISTRIBUTORS[0]
  }, [selectedDistributorId])

  return (
    <div className="space-y-6">
      {/* Animated Truck on Road banner */}
      <TruckRoad />

      {/* Main Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold text-brand-brown dark:text-brand-cream">
              {lang === 'bn'
                ? '🚚 হালখাতা ক্রয়ের পূর্বাভাস ও ডিস্ট্রিবিউটর কানেক্টর'
                : '🚚 Purchase Forecast & Distributor Connector'}
            </h1>
          </div>
          <p className="text-sm text-brand-brown/70 dark:text-brand-cream/70 mt-1">
            {lang === 'bn'
              ? 'চাহিদার এআই পূর্বাভাস, ভেরিফায়েড ডিস্ট্রিবিউটর সংযোগ এবং পাইকারি বাজার দর তুলনা'
              : 'AI replenishment forecast, verified distributor ordering, and wholesale price comparison'}
          </p>
        </div>

        {/* Interactive Switch Button: Items to Reorder */}
        <button
          type="button"
          onClick={() => {
            setMainTab('suggestions')
            setReorderFilterActive((prev) => !prev)
          }}
          className={`flex items-center gap-2.5 px-4 py-2.5 rounded-2xl font-bold text-xs sm:text-sm transition-all duration-200 shadow-sm border ${
            reorderFilterActive && mainTab === 'suggestions'
              ? 'bg-brand-yellow text-brand-brown border-brand-orange ring-2 ring-brand-orange/40 shadow-md scale-[1.02]'
              : 'bg-brand-yellow/20 hover:bg-brand-yellow/40 text-brand-brown dark:text-brand-cream border-brand-yellow/60'
          }`}
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
            {reorderFilterActive ? (lang === 'bn' ? 'সক্রিয়' : 'ON') : (lang === 'bn' ? 'ক্লিক করুন' : 'VIEW')}
          </span>
        </button>
      </div>

      {/* 3 Main Tabs: 1. Forecast & Replenish, 2. Distributor Connector, 3. Price Comparison */}
      <div className="flex items-center gap-2 border-b border-border pb-2 overflow-x-auto">
        <button
          onClick={() => setMainTab('suggestions')}
          className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 whitespace-nowrap transition-all ${
            mainTab === 'suggestions'
              ? 'bg-brand-yellow text-brand-brown shadow-sm'
              : 'text-text-secondary hover:text-text hover:bg-background-secondary'
          }`}
        >
          <ShoppingCart className="w-4 h-4" />
          <span>{lang === 'bn' ? 'ক্রয়ের পূর্বাভাস ও সুপারিশ' : 'AI Restock Forecast'}</span>
        </button>

        <button
          onClick={() => setMainTab('distributors')}
          className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 whitespace-nowrap transition-all ${
            mainTab === 'distributors'
              ? 'bg-brand-yellow text-brand-brown shadow-sm'
              : 'text-text-secondary hover:text-text hover:bg-background-secondary'
          }`}
        >
          <Building2 className="w-4 h-4 text-brand-orange" />
          <span>{lang === 'bn' ? 'ডিস্ট্রিবিউটর কানেক্টর' : 'Distributor Connector'}</span>
          <span className="px-1.5 py-0.2 rounded-full bg-green-100 text-green-800 text-[10px] font-bold">
            {formatNum(VERIFIED_DISTRIBUTORS.length)} ভেরিফায়েড
          </span>
        </button>

        <button
          onClick={() => setMainTab('comparison')}
          className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 whitespace-nowrap transition-all ${
            mainTab === 'comparison'
              ? 'bg-brand-yellow text-brand-brown shadow-sm'
              : 'text-text-secondary hover:text-text hover:bg-background-secondary'
          }`}
        >
          <BarChart2 className="w-4 h-4 text-blue-600" />
          <span>{lang === 'bn' ? 'পাইকারি বাজার দর ও পর্যালোচনা' : 'Distributor Price Comparison'}</span>
          <span className="px-1.5 py-0.2 rounded-full bg-blue-100 text-blue-800 text-[10px] font-bold">
            রেটিং ও মার্জিন
          </span>
        </button>
      </div>

      {/* ─── TAB 1: AI Purchase Suggestions & Forecast ───────────────────────── */}
      {mainTab === 'suggestions' && (
        <div className="space-y-6">
          {/* Reorder Checklist Panel */}
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
                        <th className="py-2 px-3 text-right">{lang === 'bn' ? 'অ্যাকশন' : 'Action'}</th>
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
                          <td className="py-2.5 px-3 text-right">
                            <button
                              onClick={() => handleOpenDistributorModal(item)}
                              className="px-2.5 py-1 rounded-lg bg-brand-orange text-white text-xs font-bold hover:bg-amber-600 transition-colors inline-flex items-center gap-1 shadow-sm"
                            >
                              <Building2 className="w-3.5 h-3.5" />
                              <span>{lang === 'bn' ? 'ডিস্ট্রিবিউটর কানেক্ট' : 'Connect'}</span>
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          )}

          {/* Controls Bar */}
          <Card className="p-4 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Branch Selector */}
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
                      {/* Left: Product Info */}
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

                        {/* Metrics row */}
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

                      {/* Right: Suggested Order Callout & Direct Distributor Connect */}
                      <div className="flex md:flex-col items-center justify-between md:justify-center border-t md:border-t-0 pt-3 md:pt-0 min-w-[140px] gap-2">
                        <div className="text-center">
                          <span className="text-xs font-bold uppercase text-brand-brown/70 dark:text-brand-cream/70 block">
                            {t.purchase.suggestedOrder}
                          </span>
                          <div
                            className={`px-4 py-2 rounded-2xl text-center font-extrabold text-xl mt-0.5 shadow-sm ${
                              needsOrder
                                ? 'bg-brand-yellow text-brand-brown border-2 border-brand-orange'
                                : 'bg-gray-100 dark:bg-[#201408] text-gray-500'
                            }`}
                          >
                            +{formatNum(item.suggestedOrder)}
                          </div>
                        </div>

                        {needsOrder && (
                          <Button
                            size="sm"
                            onClick={() => handleOpenDistributorModal(item)}
                            className="bg-brand-orange hover:bg-amber-600 text-white font-bold text-xs flex items-center gap-1.5 px-3 py-1.5 rounded-xl shadow-sm whitespace-nowrap"
                          >
                            <Building2 className="w-3.5 h-3.5" />
                            <span>{lang === 'bn' ? 'ডিস্ট্রিবিউটরে অর্ডার' : 'Order Now'}</span>
                          </Button>
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

      {/* ─── TAB 2: Verified Distributor Connector Directory ─────────────────── */}
      {mainTab === 'distributors' && (
        <div className="space-y-6">
          <Card className="p-4 bg-gradient-to-r from-amber-500/10 via-yellow-500/10 to-orange-500/10 border border-amber-300">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-brand-yellow flex items-center justify-center text-brand-brown font-bold">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-base text-brand-brown dark:text-brand-cream">
                  হালখাতা অনুমোদিত পাইকারি ডিস্ট্রিবিউটর নেটওয়ার্ক
                </h3>
                <p className="text-xs text-brand-brown/70 dark:text-brand-cream/70 mt-0.5">
                  সরাসরি মিল ও প্রস্তুতকারক কোম্পানির অনুমোদিত ডিলারদের কাছ থেকে সেরা মূল্যে পণ্য সংগ্রহ করুন।
                </p>
              </div>
            </div>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {VERIFIED_DISTRIBUTORS.map((dist) => (
              <Card key={dist.id} className="p-5 border-l-4 border-l-brand-orange hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-extrabold text-lg text-brand-brown dark:text-brand-cream">
                      {lang === 'bn' ? dist.nameBn : dist.name}
                    </h3>
                    <p className="text-xs font-semibold text-brand-orange mt-0.5">
                      {dist.contactPerson}
                    </p>
                    <p className="text-xs text-brand-brown/60 dark:text-brand-cream/60 flex items-center gap-1 mt-1">
                      <MapPin className="w-3.5 h-3.5" />
                      <span>{dist.territory}</span>
                    </p>
                  </div>

                  <div className="text-right">
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-100 text-amber-900 font-bold text-xs">
                      <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
                      <span>{dist.rating}</span>
                    </span>
                    <span className="block text-[10px] text-green-700 dark:text-green-400 font-semibold mt-1">
                      {dist.reliability}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 mt-4 pt-3 border-t border-border text-xs">
                  <div>
                    <span className="text-brand-brown/60 dark:text-brand-cream/60 block">ডেলিভারি সময়</span>
                    <strong className="text-brand-brown dark:text-brand-cream">
                      {formatNum(dist.deliveryTimeHours)} ঘণ্টার মধ্যে
                    </strong>
                  </div>
                  <div>
                    <span className="text-brand-brown/60 dark:text-brand-cream/60 block">সর্বনিম্ন অর্ডার (MOQ)</span>
                    <strong className="text-brand-brown dark:text-brand-cream">
                      {formatNum(dist.minOrderQuantity)} কার্টুন / বস্তা
                    </strong>
                  </div>
                </div>

                <div className="mt-4 flex items-center gap-2">
                  <a
                    href={`tel:${dist.phone.replace(/[^0-9]/g, '')}`}
                    className="flex-1 py-2 px-3 rounded-xl bg-surface-light dark:bg-surface-dark border border-border text-xs font-bold text-center text-text hover:bg-background-secondary transition-colors flex items-center justify-center gap-1.5"
                  >
                    <Phone className="w-3.5 h-3.5 text-brand-orange" />
                    <span>কল দিন</span>
                  </a>

                  <a
                    href={`https://wa.me/${dist.whatsapp}?text=${encodeURIComponent('আসসালামু আলাইকুম। হালখাতা শপ থেকে পণ্যের সাপ্লাই ও অর্ডার সম্পর্কে জানতে চাই।')}`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex-1 py-2 px-3 rounded-xl bg-green-600 hover:bg-green-700 text-white text-xs font-bold text-center transition-colors flex items-center justify-center gap-1.5 shadow-sm"
                  >
                    <MessageCircle className="w-3.5 h-3.5" />
                    <span>হোয়াটসঅ্যাপে অর্ডার</span>
                  </a>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* ─── TAB 3: Distributor Price Comparison Chart & Market Trends ──────── */}
      {mainTab === 'comparison' && (
        <div className="space-y-6">
          <Card className="p-4 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold">
                <BarChart2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-base text-blue-900 dark:text-blue-100">
                  চলতি বাজার দর বনাম পাইকারি ডিলার মূল্য তুলনা
                </h3>
                <p className="text-xs text-blue-800/80 dark:text-blue-200/80 mt-0.5">
                  কোন ডিস্ট্রিবিউটরের কাছ থেকে কিনলে আপনার সর্বোচ্চ মুনাফা হবে তা স্বয়ংক্রিয়ভাবে যাচাই করুন।
                </p>
              </div>
            </div>
          </Card>

          <div className="space-y-4">
            {DISTRIBUTOR_PRICE_COMPARISONS.map((comp) => {
              // Calculate best deal (highest margin)
              const sortedOffers = [...comp.distributorOffers].sort(
                (a, b) => b.marginPercent - a.marginPercent
              )
              const bestOffer = sortedOffers[0]

              return (
                <Card key={comp.id} className="p-5 border-l-4 border-l-blue-600">
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-border">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-extrabold text-lg text-brand-brown dark:text-brand-cream">
                          {lang === 'bn' ? comp.productNameBn : comp.productName}
                        </h3>
                        <span className="px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200 text-xs font-bold">
                          {t.categories[comp.category as any] || comp.category}
                        </span>
                        <span className="flex items-center gap-1 text-xs text-amber-600 font-bold bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded-full border border-amber-200">
                          <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
                          <span>{comp.rating} ({formatNum(comp.reviewCount)} রিভিউ)</span>
                        </span>
                      </div>

                      <div className="flex items-center gap-4 mt-2 text-xs text-brand-brown/70 dark:text-brand-cream/70">
                        <span>
                          বর্তমান বাজার দর (MRP): <strong className="text-sm text-brand-brown dark:text-brand-cream">৳{formatNum(comp.marketMrp)}</strong>
                        </span>
                        <span>•</span>
                        <span>
                          বাজার চাহিদা সূচক: <strong className="text-green-600 font-bold">{formatNum(comp.demandIndex)}% 🔥 হাই ডিমান্ড</strong>
                        </span>
                      </div>
                    </div>

                    <div className="p-3 bg-green-50 dark:bg-green-950/40 border border-green-300 dark:border-green-800 rounded-xl">
                      <span className="text-[10px] uppercase font-bold text-green-800 dark:text-green-300 block">
                        👑 সর্বোচ্চ মুনাফার ডিল
                      </span>
                      <div className="text-sm font-extrabold text-green-700 dark:text-green-300 mt-0.5">
                        {bestOffer.distributorName} — পাইকারি ৳{formatNum(bestOffer.wholesalePrice)} ({bestOffer.marginPercent}% লাভ)
                      </div>
                    </div>
                  </div>

                  {/* Offers Grid */}
                  <div className="mt-4 overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-border text-brand-brown/60 dark:text-brand-cream/60 uppercase text-[10px]">
                          <th className="py-2 px-3">ডিস্ট্রিবিউটর</th>
                          <th className="py-2 px-3">পাইকারি রেট</th>
                          <th className="py-2 px-3">প্রতি এককে আপনার লাভ</th>
                          <th className="py-2 px-3">লাভের হার (%)</th>
                          <th className="py-2 px-3">সর্বনিম্ন অর্ডার</th>
                          <th className="py-2 px-3">ডেলিভারি</th>
                          <th className="py-2 px-3 text-right">অ্যাকশন</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {comp.distributorOffers.map((offer) => {
                          const profitAmount = comp.marketMrp - offer.wholesalePrice
                          const isBest = offer.distributorId === bestOffer.distributorId

                          return (
                            <tr
                              key={offer.distributorId}
                              className={`transition-colors ${
                                isBest ? 'bg-amber-50/50 dark:bg-amber-950/20 font-semibold' : 'hover:bg-card-hover'
                              }`}
                            >
                              <td className="py-3 px-3">
                                <div className="flex items-center gap-1.5">
                                  <span className="font-bold text-text">{offer.distributorName}</span>
                                  {isBest && (
                                    <span className="px-1.5 py-0.2 rounded bg-amber-200 text-amber-900 text-[9px] font-extrabold">
                                      BEST
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="py-3 px-3 font-mono font-bold text-brand-brown dark:text-brand-cream">
                                ৳{formatNum(offer.wholesalePrice)}
                              </td>
                              <td className="py-3 px-3 text-green-600 font-bold">
                                +৳{formatNum(profitAmount)}
                              </td>
                              <td className="py-3 px-3">
                                <span className="px-2 py-0.5 rounded-lg bg-green-100 dark:bg-green-950/80 text-green-800 dark:text-green-300 font-extrabold text-[11px]">
                                  {offer.marginPercent}%
                                </span>
                              </td>
                              <td className="py-3 px-3 text-brand-brown/70 dark:text-brand-cream/70">
                                {formatNum(offer.moq)} পিস
                              </td>
                              <td className="py-3 px-3 text-brand-brown/70 dark:text-brand-cream/70">
                                {offer.deliveryTime}
                              </td>
                              <td className="py-3 px-3 text-right">
                                <button
                                  onClick={() => {
                                    const dist = VERIFIED_DISTRIBUTORS.find((d) => d.id === offer.distributorId)
                                    if (dist) {
                                      const text = `আসসালামু আলাইকুম। ${comp.productNameBn} পাইকারি ৳${offer.wholesalePrice} দরে ${offer.moq} পিস অর্ডার করতে চাই। ডেলিভারি কনফার্ম করবেন কি?`
                                      window.open(`https://wa.me/${dist.whatsapp}?text=${encodeURIComponent(text)}`, '_blank')
                                    }
                                  }}
                                  className="px-2.5 py-1 rounded-lg bg-brand-yellow hover:bg-brand-orange text-brand-brown font-bold text-xs shadow-sm transition-colors"
                                >
                                  অর্ডার দিন
                                </button>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </Card>
              )
            })}
          </div>
        </div>
      )}

      {/* ─── Distributor Connect & Order Modal ──────────────────────────────── */}
      <Modal
        isOpen={isOrderModalOpen}
        onClose={() => setIsOrderModalOpen(false)}
        title={lang === 'bn' ? '🤝 ডিস্ট্রিবিউটরের সাথে সরাসরি অর্ডার' : '🤝 Direct Distributor Order'}
      >
        {selectedItemForDistributor && (
          <div className="space-y-4">
            <div className="p-3 bg-amber-50 dark:bg-amber-950/40 rounded-xl border border-amber-200 text-xs">
              <span className="text-brand-brown/60 block">প্রয়োজনীয় পণ্য (এআই রিকমেন্ডেশন)</span>
              <div className="text-base font-bold text-brand-brown dark:text-brand-cream mt-0.5">
                {getProductName(selectedItemForDistributor, lang)}
              </div>
              <div className="flex items-center gap-3 mt-1.5 text-xs text-brand-brown/70">
                <span>বর্তমান মজুদ: {formatNum(selectedItemForDistributor.currentStock)}</span>
                <span>•</span>
                <span className="text-brand-orange font-bold">
                  প্রস্তাবিত রিঅর্ডার: {formatNum(selectedItemForDistributor.suggestedOrder)} একক
                </span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-brand-brown dark:text-brand-cream mb-1">
                ডিস্ট্রিবিউটর সিলেক্ট করুন
              </label>
              <select
                value={selectedDistributorId}
                onChange={(e) => setSelectedDistributorId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-[#F0D080] dark:border-[#4D2A00] bg-white dark:bg-[#1a0f07] text-sm focus:ring-2 focus:ring-brand-yellow font-semibold"
              >
                {VERIFIED_DISTRIBUTORS.map((d) => (
                  <option key={d.id} value={d.id}>
                    {lang === 'bn' ? d.nameBn : d.name} ({d.territory})
                  </option>
                ))}
              </select>
            </div>

            {/* Selected Distributor Info Card */}
            <div className="p-3 rounded-xl bg-card border border-border text-xs space-y-2">
              <div className="flex justify-between items-center font-bold">
                <span className="text-brand-brown dark:text-brand-cream">
                  দায়িত্বপ্রাপ্ত: {activeDistributor.contactPerson}
                </span>
                <span className="text-green-600 font-semibold">{activeDistributor.reliability}</span>
              </div>
              <div className="text-brand-brown/70 dark:text-brand-cream/70">
                ডেলিভারি সময়: {activeDistributor.deliveryTimeHours} ঘণ্টার মধ্যে • ফোন: {activeDistributor.phone}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-brand-brown dark:text-brand-cream mb-1">
                অর্ডারের পরিমাণ (একক)
              </label>
              <input
                type="number"
                min="1"
                value={orderQty}
                onChange={(e) => setOrderQty(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-xl border border-[#F0D080] dark:border-[#4D2A00] bg-white dark:bg-[#1a0f07] text-sm focus:ring-2 focus:ring-brand-yellow font-bold"
              />
            </div>

            <div className="flex items-center justify-between gap-2 pt-3 border-t border-border">
              <Button type="button" variant="outline" onClick={() => setIsOrderModalOpen(false)}>
                {t.common.cancel}
              </Button>

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  onClick={() => handleSendDistributorWhatsApp(activeDistributor)}
                  className="bg-green-600 hover:bg-green-700 text-white font-bold flex items-center gap-1.5"
                >
                  <MessageCircle className="w-4 h-4" />
                  <span>হোয়াটসঅ্যাপে পাঠান</span>
                </Button>

                <Button
                  type="button"
                  onClick={handleConfirmDistributorOrder}
                  className="bg-brand-yellow hover:bg-brand-orange text-brand-brown font-bold"
                >
                  অর্ডার রেকর্ড করুন
                </Button>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
