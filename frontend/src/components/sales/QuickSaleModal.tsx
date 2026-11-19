import { useState, useRef } from 'react'
import { Drawer } from 'vaul'
import { ShoppingBag, Plus, Minus, Check, X, Sparkles } from 'lucide-react'
import { useShopContext } from '@/hooks/useShopContext'
import { useProducts, useBatches } from '@/db/hooks'
import { db } from '@/db/schema'
import { ProductIcon } from '@/components/ui'
import { CoinDrop, notifySave, triggerHaptic } from '@/components/motion'
import { toBengaliDigits, formatBengaliCurrency } from '@/lib/bn'
import { cn } from '@/lib/utils'

interface QuickSaleModalProps {
  isOpen: boolean
  onClose: () => void
}

interface CartItem {
  productId: string
  name: string
  category: string
  price: number
  quantity: number
}

export function QuickSaleModal({ isOpen, onClose }: QuickSaleModalProps) {
  const { currentShop } = useShopContext()
  const products = useProducts(currentShop?.id || '') || []
  const batches = useBatches(currentShop?.id || '') || []

  const [cart, setCart] = useState<Record<string, CartItem>>({})
  const [tappedProductId, setTappedProductId] = useState<string | null>(null)
  const [showCoinDrop, setShowCoinDrop] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Long press timer ref
  const pressTimerRef = useRef<number | null>(null)

  const handleProductTap = (p: any) => {
    triggerHaptic()

    // Tilt animation trigger
    setTappedProductId(p.id)
    setTimeout(() => setTappedProductId(null), 300)

    setCart((prev) => {
      const existing = prev[p.id]
      const qty = existing ? existing.quantity + 1 : 1
      return {
        ...prev,
        [p.id]: {
          productId: p.id,
          name: p.name,
          category: p.category,
          price: p.sellingPrice || 100,
          quantity: qty,
        },
      }
    })
  }

  const handleProductLongPress = (p: any) => {
    triggerHaptic()
    const input = window.prompt(`${p.name} - বিক্রির পরিমাণ লিখুন:`, '1')
    if (input) {
      const num = parseInt(input, 10)
      if (!isNaN(num) && num > 0) {
        setCart((prev) => ({
          ...prev,
          [p.id]: {
            productId: p.id,
            name: p.name,
            category: p.category,
            price: p.sellingPrice || 100,
            quantity: num,
          },
        }))
      }
    }
  }

  const updateQuantity = (productId: string, delta: number) => {
    triggerHaptic()
    setCart((prev) => {
      const existing = prev[productId]
      if (!existing) return prev
      const newQty = existing.quantity + delta
      if (newQty <= 0) {
        const copy = { ...prev }
        delete copy[productId]
        return copy
      }
      return {
        ...prev,
        [productId]: { ...existing, quantity: newQty },
      }
    })
  }

  const cartList = Object.values(cart)
  const totalAmount = cartList.reduce((sum, item) => sum + item.price * item.quantity, 0)
  const totalUnits = cartList.reduce((sum, item) => sum + item.quantity, 0)

  const handleCompleteSale = async () => {
    if (cartList.length === 0) return

    setIsSubmitting(true)
    try {
      const now = new Date().toISOString()

      // Record each item sale in db.sales
      for (const item of cartList) {
        const matchingBatch = batches.find((b) => b.productId === item.productId && (b.quantity || (b as any).currentQuantity || 0) > 0)

        await db.sales.add({
          id: `sale-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          shopId: currentShop?.id || 'shop-student-01',
          productId: item.productId,
          batchId: matchingBatch?.id || 'batch-default',
          quantity: item.quantity,
          pricePerUnit: item.price,
          unitPrice: item.price,
          totalAmount: item.price * item.quantity,
          totalPrice: item.price * item.quantity,
          soldAt: now,
          updatedAt: now,
          deleted: 0,
        } as any)

        // Decrement batch quantity if available
        if (matchingBatch) {
          const curQty = matchingBatch.quantity ?? (matchingBatch as any).currentQuantity ?? 0
          const newQty = Math.max(curQty - item.quantity, 0)
          await db.batches.update(matchingBatch.id, {
            quantity: newQty,
            updatedAt: now,
          })
        }
      }

      // Show Coin Drop animation & sound/vibration
      setShowCoinDrop(true)
      notifySave(`বিক্রি সেভ হয়েছে (${formatBengaliCurrency(totalAmount)}) ✓`)

      // Reset
      setCart({})
      setTimeout(() => {
        setIsSubmitting(false)
        setShowCoinDrop(false)
        onClose()
      }, 700)
    } catch (err: any) {
      console.error('Failed to complete quick sale:', err)
      setIsSubmitting(false)
    }
  }

  if (!isOpen) return null

  const content = (
    <div className="flex flex-col h-full max-h-[85vh] bg-card text-text border-t border-border">
      {/* Header */}
      <div className="p-4 border-b border-border flex items-center justify-between bg-background-secondary">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-xl bg-accent flex items-center justify-center text-[#493522] shadow-sm font-bold">
            <ShoppingBag className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-bold text-text">
              বিক্রি লিখুন (Quick Cashier)
            </h2>
            <p className="text-xs text-text-secondary">
              পণ্যে ট্যাপ করলে পরিমাণ +১ যোগ হবে
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-text-secondary hover:bg-background-secondary"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Main Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Product Grid */}
        <div>
          <div className="text-xs font-bold text-accent uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5" />
            <span>জনপ্রিয় পণ্য তালিকা</span>
          </div>

          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5">
            {products.slice(0, 12).map((p) => {
              const inCart = cart[p.id]
              const isTilted = tappedProductId === p.id

              return (
                <div
                  key={p.id}
                  onClick={() => handleProductTap(p)}
                  className={cn(
                    'p-3 rounded-2xl border flex flex-col items-center text-center justify-between cursor-pointer select-none transition-all',
                    'hover:shadow-card active:scale-95 bg-elevated text-text',
                    inCart
                      ? 'border-accent bg-accent/15 ring-2 ring-accent/50'
                      : 'border-border hover:border-accent'
                  )}
                  style={{
                    transform: isTilted ? 'rotate(5deg) scale(1.04)' : 'none',
                    transition: 'transform 0.15s ease',
                  }}
                >
                  <div className="relative my-1">
                    <ProductIcon name={p.name} category={p.category} size={44} />
                    {inCart && (
                      <span className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-accent text-[#493522] font-extrabold text-xs flex items-center justify-center shadow">
                        +{toBengaliDigits(inCart.quantity)}
                      </span>
                    )}
                  </div>
                  <span className="text-xs font-bold text-text line-clamp-1 mt-1">
                    {p.name}
                  </span>
                  <span className="text-[11px] font-semibold text-accent mt-0.5">
                    {formatBengaliCurrency(p.sellingPrice || 100)}
                  </span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Current Cart Drawer */}
        {cartList.length > 0 && (
          <div className="p-3.5 rounded-2xl bg-amber-50/90 border border-amber-300/80 space-y-2.5">
            <div className="flex items-center justify-between text-xs font-bold text-brand-brown">
              <span>নির্বাচিত পণ্য ({toBengaliDigits(totalUnits)} একক)</span>
              <button
                onClick={() => setCart({})}
                className="text-red-600 hover:underline text-[11px]"
              >
                খালি করুন
              </button>
            </div>

            <div className="divide-y divide-amber-200/60 max-h-36 overflow-y-auto">
              {cartList.map((item) => (
                <div key={item.productId} className="py-2 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-xs font-bold truncate">{item.name}</div>
                    <div className="text-[10px] text-brand-brown/60">
                      {formatBengaliCurrency(item.price)} × {toBengaliDigits(item.quantity)}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        updateQuantity(item.productId, -1)
                      }}
                      className="w-7 h-7 rounded-lg bg-white border border-amber-300 flex items-center justify-center text-brand-brown font-bold hover:bg-amber-100"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <span className="text-xs font-extrabold w-5 text-center">
                      {toBengaliDigits(item.quantity)}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        updateQuantity(item.productId, 1)
                      }}
                      className="w-7 h-7 rounded-lg bg-brand-yellow flex items-center justify-center text-brand-brown font-bold hover:brightness-105"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Footer Confirm */}
      <div className="p-4 border-t border-amber-200/60 bg-white flex items-center justify-between gap-3">
        <div>
          <div className="text-[11px] font-semibold text-brand-brown/60">সর্বমোট বিক্রয়</div>
          <div className="text-xl font-extrabold text-[#15803D]">
            {formatBengaliCurrency(totalAmount)}
          </div>
        </div>

        <button
          onClick={handleCompleteSale}
          disabled={cartList.length === 0 || isSubmitting}
          className="flex-1 py-3.5 px-6 rounded-2xl font-extrabold text-sm sm:text-base text-brand-brown bg-gradient-to-r from-brand-yellow to-brand-orange hover:brightness-105 active:scale-95 shadow-lg shadow-amber-500/25 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Check className="w-5 h-5 stroke-[2.5]" />
          <span>{isSubmitting ? 'সেভ হচ্ছে...' : 'বিক্রি সম্পন্ন করুন'}</span>
        </button>
      </div>

      {showCoinDrop && <CoinDrop />}
    </div>
  )

  // Use Vaul drawer on mobile, and centered modal on desktop
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 1024

  if (isMobile) {
    return (
      <Drawer.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <Drawer.Portal>
          <Drawer.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" />
          <Drawer.Content className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-3xl overflow-hidden outline-none">
            <div className="mx-auto w-12 h-1.5 flex-shrink-0 rounded-full bg-amber-300 my-2.5" />
            {content}
          </Drawer.Content>
        </Drawer.Portal>
      </Drawer.Root>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-xl bg-white rounded-3xl shadow-2xl border border-amber-200/80 overflow-hidden">
        {content}
      </div>
    </div>
  )
}
