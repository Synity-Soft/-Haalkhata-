// Shop Network (দোকান নেটওয়ার্ক) — Local Retail Collaboration, Overstock Liquidation & Emergency Stock Borrowing
import { useState, useMemo } from 'react'
import {
  Store,
  Share2,
  AlertCircle,
  Package,
  ArrowRightLeft,
  Plus,
  Phone,
  MessageCircle,
  CheckCircle,
  Clock,
  TrendingDown,
  MapPin,
  ShieldCheck,
  Send,
  Zap,
  Filter,
} from 'lucide-react'
import { useLang } from '@/i18n'
import { useShopContext } from '@/hooks/useShopContext'
import { useProducts, useBatches } from '@/db/hooks'
import { Card, Button, Badge, Modal, EmptyState } from '@/components/ui'
import { Stagger, showSaveToast } from '@/components/motion'
import { INITIAL_PEER_EXCHANGES } from '@/mock/haalkhataFeatures'
import type { PeerShopExchange } from '@/types'

export default function ShopNetwork() {
  const { t, lang, formatNum, formatCurrency } = useLang()
  const { currentShop } = useShopContext()

  const shopId = currentShop?.id || 'shop-student-01'
  const rawProducts = useProducts(shopId)
  const products = rawProducts || []

  // Exchanges state (starts with realistic mock community requests)
  const [exchanges, setExchanges] = useState<PeerShopExchange[]>(INITIAL_PEER_EXCHANGES)
  const [activeTab, setActiveTab] = useState<'all' | 'overstock' | 'emergency'>('all')

  // Modals state
  const [isOverstockModalOpen, setIsOverstockModalOpen] = useState(false)
  const [isEmergencyModalOpen, setIsEmergencyModalOpen] = useState(false)

  // Overstock Form State
  const [overstockProduct, setOverstockProduct] = useState('')
  const [overstockQty, setOverstockQty] = useState<number>(10)
  const [overstockUnit, setOverstockUnit] = useState('পিস')
  const [overstockOfferedPrice, setOverstockOfferedPrice] = useState<number>(150)
  const [overstockRegularPrice, setOverstockRegularPrice] = useState<number>(180)
  const [overstockNote, setOverstockNote] = useState('')

  // Emergency Form State
  const [emergencyProduct, setEmergencyProduct] = useState('')
  const [emergencyQty, setEmergencyQty] = useState<number>(5)
  const [emergencyUnit, setEmergencyUnit] = useState('পিস')
  const [emergencyMaxPrice, setEmergencyMaxPrice] = useState<number>(140)
  const [emergencyUrgency, setEmergencyUrgency] = useState<'standard' | 'medium' | 'high'>('high')
  const [emergencyNote, setEmergencyNote] = useState('')

  // Filtered exchanges
  const filteredExchanges = useMemo(() => {
    return exchanges.filter((item) => {
      if (activeTab === 'overstock' && item.type !== 'overstock') return false
      if (activeTab === 'emergency' && item.type !== 'emergency') return false
      return true
    })
  }, [exchanges, activeTab])

  // Count stats
  const overstockCount = exchanges.filter((e) => e.type === 'overstock' && e.status === 'open').length
  const emergencyCount = exchanges.filter((e) => e.type === 'emergency' && e.status === 'open').length

  // Broadcast Overstock handler
  const handlePublishOverstock = (e: React.FormEvent) => {
    e.preventDefault()
    if (!overstockProduct.trim() || overstockQty <= 0) return

    const newExchange: PeerShopExchange = {
      id: `exch-${Date.now()}`,
      type: 'overstock',
      shopId,
      shopName: `${currentShop?.name || 'হালখাতা স্টোর'} (আপনার দোকান)`,
      distanceMeters: 0,
      productName: overstockProduct.trim(),
      quantity: Number(overstockQty),
      unit: overstockUnit,
      offeredPrice: Number(overstockOfferedPrice),
      regularPrice: Number(overstockRegularPrice),
      urgency: 'medium',
      status: 'open',
      note: overstockNote.trim() || 'আমাদের দোকানে বাড়তি স্টক রয়েছে, সুলভ পাইকারি দরে নিতে পারেন।',
      createdAt: new Date().toISOString(),
    }

    setExchanges((prev) => [newExchange, ...prev])
    setIsOverstockModalOpen(false)
    setOverstockProduct('')
    setOverstockNote('')
    showSaveToast(
      lang === 'bn'
        ? 'আপনার অতিরিক্ত স্টক আশেপাশের সব দোকানে ব্রডকাস্ট হয়েছে ✓'
        : 'Overstock broadcasted to local shop network ✓'
    )
  }

  // Broadcast Emergency Borrow Request handler
  const handlePublishEmergency = (e: React.FormEvent) => {
    e.preventDefault()
    if (!emergencyProduct.trim() || emergencyQty <= 0) return

    const newExchange: PeerShopExchange = {
      id: `exch-${Date.now()}`,
      type: 'emergency',
      shopId,
      shopName: `${currentShop?.name || 'হালখাতা স্টোর'} (আপনার দোকান)`,
      distanceMeters: 0,
      productName: emergencyProduct.trim(),
      quantity: Number(emergencyQty),
      unit: emergencyUnit,
      offeredPrice: Number(emergencyMaxPrice),
      regularPrice: Number(emergencyMaxPrice),
      urgency: emergencyUrgency,
      status: 'open',
      note: emergencyNote.trim() || 'কাস্টমারের জন্য জরুরি পণ্য ধার প্রয়োজন। দ্রুত সাড়া দিন।',
      createdAt: new Date().toISOString(),
    }

    setExchanges((prev) => [newExchange, ...prev])
    setIsEmergencyModalOpen(false)
    setEmergencyProduct('')
    setEmergencyNote('')
    showSaveToast(
      lang === 'bn'
        ? 'জরুরি স্টক রিকোয়েস্ট আশেপাশের দোকানে পাঠানো হয়েছে ✓'
        : 'Emergency stock request sent to nearby shops ✓'
    )
  }

  // Fulfill or Claim an exchange item
  const handleFulfillExchange = (id: string) => {
    setExchanges((prev) =>
      prev.map((e) => (e.id === id ? { ...e, status: 'completed' as const } : e))
    )
    showSaveToast(
      lang === 'bn'
        ? 'লেনদেন সফলভাবে সম্পন্ন ও স্টক সমন্বয় করা হয়েছে ✓'
        : 'Stock transfer confirmed and balance updated ✓'
    )
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold text-brand-brown dark:text-brand-cream">
              {lang === 'bn' ? '🤝 হালখাতা দোকান নেটওয়ার্ক (লোকাল ক্লাস্টার)' : '🤝 Haalkhata Shop Network'}
            </h1>
          </div>
          <p className="text-sm text-brand-brown/70 dark:text-brand-cream/70 mt-1">
            {lang === 'bn'
              ? 'একই এলাকার দোকানগুলোর মধ্যে অতিরিক্ত স্টক বিক্রি ও জরুরি পণ্য দ্রুত ধার নেওয়ার কোলাবরেশন'
              : 'Inter-shop trade network: liquidating overstock & emergency stock borrowing'}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button
            onClick={() => setIsOverstockModalOpen(true)}
            className="bg-brand-yellow hover:bg-brand-orange text-brand-brown font-bold flex items-center gap-1.5 px-4 py-2.5 rounded-xl shadow-sm text-xs sm:text-sm"
          >
            <TrendingDown className="w-4 h-4" />
            <span>{lang === 'bn' ? 'অতিরিক্ত স্টক বিক্রি' : 'Broadcast Overstock'}</span>
          </Button>

          <Button
            onClick={() => setIsEmergencyModalOpen(true)}
            className="bg-red-500 hover:bg-red-600 text-white font-bold flex items-center gap-1.5 px-4 py-2.5 rounded-xl shadow-sm text-xs sm:text-sm"
          >
            <Zap className="w-4 h-4" />
            <span>{lang === 'bn' ? 'জরুরি স্টক রিকোয়েস্ট' : 'Emergency Borrow'}</span>
          </Button>
        </div>
      </div>

      {/* Local Retail Cluster Overview Card */}
      <Card className="p-4 sm:p-5 bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-yellow-500/10 border border-amber-300 dark:border-amber-700/60">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Store className="w-5 h-5 text-brand-orange" />
              <h2 className="text-base font-bold text-brand-brown dark:text-brand-cream">
                {lang === 'bn' ? 'এলাকা: ধানমন্ডি ও মিরপুর রোড রিটেল সার্কেল' : 'Zone: Dhanmondi Retail Cluster'}
              </h2>
              <span className="px-2 py-0.5 rounded-full bg-green-100 text-green-800 text-[11px] font-bold">
                ● ৪ টি দোকান সক্রিয়
              </span>
            </div>
            <p className="text-xs text-brand-brown/75 dark:text-brand-cream/75 mt-1">
              {lang === 'bn'
                ? 'দোকান A (আপনি), দোকান B (ভাই ভাই স্টোর), দোকান C (মায়ের দোয়া) এবং দোকান D (জনতা শপ) সরাসরি কানেক্টেড।'
                : 'Shops A (You), B (Bhai Bhai), C (Mayer Doa), and D (Jonota) are linked in this zone.'}
            </p>
          </div>

          <div className="flex items-center gap-3 text-xs">
            <div className="p-2.5 rounded-xl bg-white/80 dark:bg-black/30 border border-border text-center">
              <span className="text-brand-brown/60 dark:text-brand-cream/60 block text-[10px]">অতিরিক্ত স্টক অফার</span>
              <strong className="text-sm text-brand-orange font-bold">{formatNum(overstockCount)} টি</strong>
            </div>
            <div className="p-2.5 rounded-xl bg-white/80 dark:bg-black/30 border border-border text-center">
              <span className="text-brand-brown/60 dark:text-brand-cream/60 block text-[10px]">জরুরি ধার রিকোয়েস্ট</span>
              <strong className="text-sm text-red-600 font-bold">{formatNum(emergencyCount)} টি</strong>
            </div>
            <div className="p-2.5 rounded-xl bg-white/80 dark:bg-black/30 border border-border text-center">
              <span className="text-brand-brown/60 dark:text-brand-cream/60 block text-[10px]">গড় ডেলিভারি দূরত্ব</span>
              <strong className="text-sm text-green-600 font-bold">৩৫০ মি</strong>
            </div>
          </div>
        </div>
      </Card>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-border pb-2">
        <button
          onClick={() => setActiveTab('all')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'all'
              ? 'bg-brand-yellow text-brand-brown shadow-sm'
              : 'text-text-secondary hover:text-text hover:bg-background-secondary'
          }`}
        >
          {lang === 'bn' ? 'সকল নোটিফিকেশন' : 'All Feeds'} ({formatNum(exchanges.length)})
        </button>

        <button
          onClick={() => setActiveTab('overstock')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
            activeTab === 'overstock'
              ? 'bg-brand-yellow text-brand-brown shadow-sm'
              : 'text-text-secondary hover:text-text hover:bg-background-secondary'
          }`}
        >
          <TrendingDown className="w-3.5 h-3.5" />
          <span>{lang === 'bn' ? 'অতিরিক্ত স্টক ক্লিয়ারেন্স' : 'Overstock Clearance'}</span>
          <span className="px-1.5 py-0.2 rounded-full bg-black/10 dark:bg-white/10 text-[10px]">
            {formatNum(overstockCount)}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('emergency')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
            activeTab === 'emergency'
              ? 'bg-red-500 text-white shadow-sm'
              : 'text-text-secondary hover:text-text hover:bg-background-secondary'
          }`}
        >
          <Zap className="w-3.5 h-3.5" />
          <span>{lang === 'bn' ? 'জরুরি স্টক ধার' : 'Emergency Borrow'}</span>
          <span className="px-1.5 py-0.2 rounded-full bg-white/20 text-[10px]">
            {formatNum(emergencyCount)}
          </span>
        </button>
      </div>

      {/* Feed List */}
      {filteredExchanges.length === 0 ? (
        <EmptyState
          icon={ArrowRightLeft}
          title={lang === 'bn' ? 'কোনো সক্রিয় লেনদেন নোটিফিকেশন নেই' : 'No active network feeds'}
          description={
            lang === 'bn'
              ? 'আপনার দোকানের অতিরিক্ত স্টক বিক্রি করতে বা জরুরি পণ্য ধার নিতে উপরের বাটনে চাপুন।'
              : 'Broadcast an overstock sale or emergency stock borrow request.'
          }
        />
      ) : (
        <Stagger className="space-y-3">
          {filteredExchanges.map((item) => {
            const isMyPost = item.shopId === shopId
            const isFulfilled = item.status === 'completed'
            const isOverstock = item.type === 'overstock'

            return (
              <Card
                key={item.id}
                className={`p-4 sm:p-5 transition-all ${
                  isFulfilled
                    ? 'opacity-60 bg-gray-50/50 dark:bg-gray-900/30'
                    : isOverstock
                    ? 'border-l-4 border-l-amber-500 hover:border-l-amber-600'
                    : 'border-l-4 border-l-red-500 hover:border-l-red-600 bg-red-50/10'
                }`}
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  {/* Left info */}
                  <div className="flex items-start gap-3">
                    <div
                      className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5 ${
                        isOverstock
                          ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300'
                          : 'bg-red-100 text-red-600 dark:bg-red-950/60 dark:text-red-300'
                      }`}
                    >
                      {isOverstock ? <Package className="w-6 h-6" /> : <Zap className="w-6 h-6" />}
                    </div>

                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${
                            isOverstock
                              ? 'bg-amber-100 text-amber-900 dark:bg-amber-950/80 dark:text-amber-200'
                              : 'bg-red-100 text-red-800 dark:bg-red-950/80 dark:text-red-200'
                          }`}
                        >
                          {isOverstock
                            ? (lang === 'bn' ? 'অতিরিক্ত স্টক বিক্রি (ডিসকাউন্ট)' : 'Overstock For Sale')
                            : (lang === 'bn' ? '⚡ জরুরি পণ্য ধার চাই' : '⚡ Emergency Borrow Request')}
                        </span>

                        <h3 className="font-extrabold text-base text-brand-brown dark:text-brand-cream">
                          {item.productName}
                        </h3>

                        {isFulfilled ? (
                          <Badge variant="success">
                            {lang === 'bn' ? 'সম্পন্ন হয়েছে ✓' : 'Fulfilled ✓'}
                          </Badge>
                        ) : item.urgency === 'high' ? (
                          <Badge variant="danger">
                            {lang === 'bn' ? 'অতি জরুরি' : 'High Urgency'}
                          </Badge>
                        ) : null}
                      </div>

                      {/* Shop Name & Distance */}
                      <div className="flex items-center gap-2 text-xs text-brand-brown/70 dark:text-brand-cream/70 mt-1 flex-wrap">
                        <span className="font-semibold text-brand-orange">{item.shopName}</span>
                        {item.distanceMeters > 0 && (
                          <span className="flex items-center gap-1 text-green-700 dark:text-green-400 font-medium">
                            <MapPin className="w-3 h-3" />
                            <span>{formatNum(item.distanceMeters)} মিটার দূরে</span>
                          </span>
                        )}
                        <span>•</span>
                        <span>
                          {lang === 'bn' ? 'পোস্টের সময়' : 'Posted'}:{' '}
                          {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>

                      {/* Note */}
                      <p className="text-xs text-brand-brown/80 dark:text-brand-cream/80 mt-2 bg-amber-50/60 dark:bg-amber-950/30 p-2 rounded-lg border border-amber-200/50">
                        {item.note}
                      </p>
                    </div>
                  </div>

                  {/* Quantity & Pricing details */}
                  <div className="flex items-center justify-between md:justify-end gap-5 border-t md:border-t-0 pt-3 md:pt-0">
                    <div className="text-left md:text-right">
                      <span className="text-[11px] text-brand-brown/60 dark:text-brand-cream/60 block">
                        {lang === 'bn' ? 'পরিমাণ' : 'Quantity'}
                      </span>
                      <strong className="text-base text-brand-brown dark:text-brand-cream font-bold">
                        {formatNum(item.quantity)} {item.unit}
                      </strong>
                      <div className="text-xs mt-0.5">
                        <span className="text-brand-orange font-bold">৳{formatNum(item.offeredPrice)}</span>
                        {item.regularPrice && (
                          <span className="line-through text-brand-brown/40 ml-1">
                            ৳{formatNum(item.regularPrice)}
                          </span>
                        )}
                        <span className="text-[10px] text-brand-brown/60 ml-1">/ {item.unit}</span>
                      </div>
                    </div>

                    {/* Action */}
                    {!isFulfilled ? (
                      <div className="flex items-center gap-2">
                        {isMyPost ? (
                          <span className="px-3 py-1.5 rounded-lg bg-brand-cream dark:bg-stone-800 text-xs font-semibold text-brand-brown dark:text-brand-cream">
                            {lang === 'bn' ? 'আপনার পোস্ট (সক্রিয়)' : 'Your Broadcast'}
                          </span>
                        ) : isOverstock ? (
                          <Button
                            size="sm"
                            onClick={() => handleFulfillExchange(item.id)}
                            className="bg-brand-yellow hover:bg-brand-orange text-brand-brown font-bold text-xs flex items-center gap-1.5 px-3.5 py-2 shadow-sm whitespace-nowrap"
                          >
                            <CheckCircle className="w-4 h-4" />
                            <span>{lang === 'bn' ? 'আমরা স্টকটি কিনব' : 'Claim Overstock'}</span>
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            onClick={() => handleFulfillExchange(item.id)}
                            className="bg-green-600 hover:bg-green-700 text-white font-bold text-xs flex items-center gap-1.5 px-3.5 py-2 shadow-sm whitespace-nowrap"
                          >
                            <Share2 className="w-4 h-4" />
                            <span>{lang === 'bn' ? 'স্টক ধার দিন' : 'Fulfill Request'}</span>
                          </Button>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs text-green-600 dark:text-green-400 font-bold flex items-center gap-1">
                        <CheckCircle className="w-4 h-4" />
                        <span>{lang === 'bn' ? 'লেনদেন নিষ্পন্ন' : 'Completed'}</span>
                      </span>
                    )}
                  </div>
                </div>
              </Card>
            )
          })}
        </Stagger>
      )}

      {/* Broadcast Overstock Modal */}
      <Modal
        isOpen={isOverstockModalOpen}
        onClose={() => setIsOverstockModalOpen(false)}
        title={lang === 'bn' ? '📢 অতিরিক্ত স্টক বিক্রির নোটিফিকেশন পাঠান' : '📢 Broadcast Overstock For Sale'}
      >
        <form onSubmit={handlePublishOverstock} className="space-y-4">
          <p className="text-xs text-brand-brown/70 dark:text-brand-cream/70">
            {lang === 'bn'
              ? 'আপনার দোকানে যে পণ্যের অতিরিক্ত মজুদ জমে আছে এবং বিক্রি ধীর, তা এলাকার অন্যান্য দোকানের কাছে বিশেষ পাইকারি ছাড়ে অফার করুন।'
              : 'Liquidate slow-moving overstock to neighboring shops at discounted wholesale rates.'}
          </p>

          <div>
            <label className="block text-xs font-bold text-brand-brown dark:text-brand-cream mb-1">
              {lang === 'bn' ? 'পণ্যের নাম' : 'Product Name'} *
            </label>
            <input
              type="text"
              required
              value={overstockProduct}
              onChange={(e) => setOverstockProduct(e.target.value)}
              placeholder="e.g. তীর সয়াবিন তেল ১ লিটার"
              className="w-full px-3 py-2 rounded-xl border border-[#F0D080] dark:border-[#4D2A00] bg-white dark:bg-[#1a0f07] text-sm focus:ring-2 focus:ring-brand-yellow"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-brand-brown dark:text-brand-cream mb-1">
                {lang === 'bn' ? 'বিক্রয়যোগ্য পরিমাণ' : 'Quantity'} *
              </label>
              <input
                type="number"
                required
                min="1"
                value={overstockQty}
                onChange={(e) => setOverstockQty(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-xl border border-[#F0D080] dark:border-[#4D2A00] bg-white dark:bg-[#1a0f07] text-sm focus:ring-2 focus:ring-brand-yellow"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-brand-brown dark:text-brand-cream mb-1">
                {lang === 'bn' ? 'একক (ইউনিট)' : 'Unit'}
              </label>
              <input
                type="text"
                value={overstockUnit}
                onChange={(e) => setOverstockUnit(e.target.value)}
                placeholder="পিস / কেজি / বোতল"
                className="w-full px-3 py-2 rounded-xl border border-[#F0D080] dark:border-[#4D2A00] bg-white dark:bg-[#1a0f07] text-sm focus:ring-2 focus:ring-brand-yellow"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-brand-brown dark:text-brand-cream mb-1">
                {lang === 'bn' ? 'অফার মূল্য (৳)' : 'Offered Price (৳)'} *
              </label>
              <input
                type="number"
                required
                min="1"
                value={overstockOfferedPrice}
                onChange={(e) => setOverstockOfferedPrice(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-xl border border-[#F0D080] dark:border-[#4D2A00] bg-white dark:bg-[#1a0f07] text-sm focus:ring-2 focus:ring-brand-yellow"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-brand-brown dark:text-brand-cream mb-1">
                {lang === 'bn' ? 'বর্তমান খুচরা দর (৳)' : 'Regular MRP (৳)'}
              </label>
              <input
                type="number"
                value={overstockRegularPrice}
                onChange={(e) => setOverstockRegularPrice(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-xl border border-[#F0D080] dark:border-[#4D2A00] bg-white dark:bg-[#1a0f07] text-sm focus:ring-2 focus:ring-brand-yellow"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-brand-brown dark:text-brand-cream mb-1">
              {lang === 'bn' ? 'বার্তা বা বিবরণ' : 'Note to Nearby Shops'}
            </label>
            <textarea
              rows={2}
              value={overstockNote}
              onChange={(e) => setOverstockNote(e.target.value)}
              placeholder="e.g. অতিরিক্ত স্টক দ্রুত বিক্রি করতে চাই, পাইকারি মূল্যের চেয়ে কম।"
              className="w-full p-2.5 rounded-xl border border-[#F0D080] dark:border-[#4D2A00] bg-white dark:bg-[#1a0f07] text-xs focus:ring-2 focus:ring-brand-yellow"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
            <Button type="button" variant="outline" onClick={() => setIsOverstockModalOpen(false)}>
              {t.common.cancel}
            </Button>
            <Button
              type="submit"
              className="bg-brand-yellow hover:bg-brand-orange text-brand-brown font-bold flex items-center gap-1.5"
            >
              <Send className="w-4 h-4" />
              <span>{lang === 'bn' ? 'নেটওয়ার্কে পোস্ট করুন' : 'Broadcast to Network'}</span>
            </Button>
          </div>
        </form>
      </Modal>

      {/* Emergency Stock Borrow Modal */}
      <Modal
        isOpen={isEmergencyModalOpen}
        onClose={() => setIsEmergencyModalOpen(false)}
        title={lang === 'bn' ? '⚡ জরুরি সাময়িক স্টক ধার বা রিকোয়েস্ট' : '⚡ Request Emergency Stock'}
      >
        <form onSubmit={handlePublishEmergency} className="space-y-4">
          <p className="text-xs text-brand-brown/70 dark:text-brand-cream/70">
            {lang === 'bn'
              ? 'আপনার দোকানে হঠাৎ জরুরি কোনো পণ্য শেষ হয়ে গেলে আশেপাশের সহযোগী দোকানগুলোর কাছ থেকে সাময়িক ধার বা কিনতে রিকোয়েস্ট পাঠান।'
              : 'Request emergency stock from nearby partner shops when your inventory runs out.'}
          </p>

          <div>
            <label className="block text-xs font-bold text-brand-brown dark:text-brand-cream mb-1">
              {lang === 'bn' ? 'যে পণ্য প্রয়োজন' : 'Required Product'} *
            </label>
            <input
              type="text"
              required
              value={emergencyProduct}
              onChange={(e) => setEmergencyProduct(e.target.value)}
              placeholder="e.g. ফ্রেশ চিনি ১ কেজি প্যাকেট"
              className="w-full px-3 py-2 rounded-xl border border-[#F0D080] dark:border-[#4D2A00] bg-white dark:bg-[#1a0f07] text-sm focus:ring-2 focus:ring-brand-yellow"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-brand-brown dark:text-brand-cream mb-1">
                {lang === 'bn' ? 'প্রয়োজনীয় পরিমাণ' : 'Quantity Needed'} *
              </label>
              <input
                type="number"
                required
                min="1"
                value={emergencyQty}
                onChange={(e) => setEmergencyQty(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-xl border border-[#F0D080] dark:border-[#4D2A00] bg-white dark:bg-[#1a0f07] text-sm focus:ring-2 focus:ring-brand-yellow"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-brand-brown dark:text-brand-cream mb-1">
                {lang === 'bn' ? 'একক (ইউনিট)' : 'Unit'}
              </label>
              <input
                type="text"
                value={emergencyUnit}
                onChange={(e) => setEmergencyUnit(e.target.value)}
                placeholder="কেজি / প্যাকেট"
                className="w-full px-3 py-2 rounded-xl border border-[#F0D080] dark:border-[#4D2A00] bg-white dark:bg-[#1a0f07] text-sm focus:ring-2 focus:ring-brand-yellow"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-brand-brown dark:text-brand-cream mb-1">
                {lang === 'bn' ? 'সর্বোচ্চ গ্রহণযোগ্য দর (৳)' : 'Max Price per Unit (৳)'}
              </label>
              <input
                type="number"
                value={emergencyMaxPrice}
                onChange={(e) => setEmergencyMaxPrice(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-xl border border-[#F0D080] dark:border-[#4D2A00] bg-white dark:bg-[#1a0f07] text-sm focus:ring-2 focus:ring-brand-yellow"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-brand-brown dark:text-brand-cream mb-1">
                {lang === 'bn' ? 'জরুরিতা লেভেল' : 'Urgency Level'}
              </label>
              <select
                value={emergencyUrgency}
                onChange={(e: any) => setEmergencyUrgency(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-[#F0D080] dark:border-[#4D2A00] bg-white dark:bg-[#1a0f07] text-sm focus:ring-2 focus:ring-brand-yellow"
              >
                <option value="high">🚨 অতি জরুরি (১ ঘণ্টার মধ্যে)</option>
                <option value="medium">⚠️ জরুরি (আজকের মধ্যে)</option>
                <option value="standard">সাধারণ রিকোয়েস্ট</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-brand-brown dark:text-brand-cream mb-1">
              {lang === 'bn' ? 'বার্তা বা বিশেষ নির্দেশনা' : 'Note'}
            </label>
            <textarea
              rows={2}
              value={emergencyNote}
              onChange={(e) => setEmergencyNote(e.target.value)}
              placeholder="e.g. দোকানে কাস্টমার অপেক্ষা করছেন, ১০ প্যাকেট চিনি দ্রুত ধার প্রয়োজন।"
              className="w-full p-2.5 rounded-xl border border-[#F0D080] dark:border-[#4D2A00] bg-white dark:bg-[#1a0f07] text-xs focus:ring-2 focus:ring-brand-yellow"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
            <Button type="button" variant="outline" onClick={() => setIsEmergencyModalOpen(false)}>
              {t.common.cancel}
            </Button>
            <Button
              type="submit"
              className="bg-red-500 hover:bg-red-600 text-white font-bold flex items-center gap-1.5"
            >
              <Zap className="w-4 h-4" />
              <span>{lang === 'bn' ? 'জরুরি রিকোয়েস্ট পাঠান' : 'Send Emergency Request'}</span>
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
