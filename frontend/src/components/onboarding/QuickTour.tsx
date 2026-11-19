import { useState, useEffect } from 'react'
import { ShoppingBag, Truck, Clock, ArrowRight, Check, Sparkles } from 'lucide-react'
import { SoftIcon, ProductIcon } from '@/components/ui'
import { cn } from '@/lib/utils'

const TOUR_STORAGE_KEY = 'hb_tour_completed'

export function QuickTour() {
  const [isOpen, setIsOpen] = useState(false)
  const [step, setStep] = useState(0)

  useEffect(() => {
    try {
      const done = localStorage.getItem(TOUR_STORAGE_KEY)
      if (!done) {
        setIsOpen(true)
      }
    } catch {
      // ignore
    }
  }, [])

  const handleFinish = () => {
    try {
      localStorage.setItem(TOUR_STORAGE_KEY, 'true')
    } catch {
      // ignore
    }
    setIsOpen(false)
  }

  if (!isOpen) return null

  const slides = [
    {
      title: '১. সহজ বিক্রি ও ক্যাশ হিসাব',
      subtitle: 'পণ্যের ছবিতে ট্যাপ করেই দৈনিক বিক্রি ও আয় রেকর্ড করুন।',
      iconTone: 'yellow' as const,
      icon: ShoppingBag,
      illustration: (
        <div className="flex items-center justify-center gap-4 py-4">
          <ProductIcon name="চাল" size={56} />
          <div className="text-2xl font-black text-amber-500">→</div>
          <div className="w-16 h-16 rounded-2xl bg-amber-400/30 border-2 border-amber-400 flex items-center justify-center font-black text-3xl text-[#4A2E0F] shadow-sm">
            ৳
          </div>
        </div>
      ),
    },
    {
      title: '২. স্মার্ট পণ্য ক্রয় পরামর্শ',
      subtitle: 'এলাকা ও অতীত বিক্রির ভিত্তিতে কোন পণ্য কতটা তুলতে হবে তা জানুন।',
      iconTone: 'blue' as const,
      icon: Truck,
      illustration: (
        <div className="flex items-center justify-center gap-4 py-4">
          <ProductIcon name="তেল" size={56} />
          <ProductIcon name="ডাল" size={56} />
          <ProductIcon name="চা" size={56} />
        </div>
      ),
    },
    {
      title: '৩. বাকি খাতা ও মেয়াদ সতর্কতা',
      subtitle: 'গ্রাহকের বাকি ট্র্যাক করুন এবং মেয়াদ শেষের আগেই ছাড় দিয়ে বিক্রি করুন।',
      iconTone: 'red' as const,
      icon: Clock,
      illustration: (
        <div className="flex items-center justify-center gap-3 py-4">
          <span className="px-3 py-1.5 rounded-xl bg-green-100 text-green-800 text-xs font-bold border border-green-300">
            বাকি আদায় ✓
          </span>
          <span className="px-3 py-1.5 rounded-xl bg-red-100 text-red-800 text-xs font-bold border border-red-300">
            মেয়াদ অ্যালার্ট ⏳
          </span>
        </div>
      ),
    },
  ]

  const currentSlide = slides[step]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-[#FFFDF5] rounded-3xl shadow-2xl border-2 border-brand-yellow/60 overflow-hidden flex flex-col p-6 space-y-5">
        {/* Step Indicator */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-brand-orange" />
            <span className="text-xs font-bold text-brand-orange uppercase">
              হাট-বাজার পরিচিতি
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            {slides.map((_, idx) => (
              <span
                key={idx}
                className={cn(
                  'h-2 rounded-full transition-all',
                  idx === step ? 'w-6 bg-brand-yellow' : 'w-2 bg-amber-200'
                )}
              />
            ))}
          </div>
        </div>

        {/* Visual Presentation */}
        <div className="flex flex-col items-center text-center space-y-3 py-2">
          <SoftIcon icon={currentSlide.icon} tone={currentSlide.iconTone} size={72} />

          <div className="w-full bg-amber-50/70 rounded-2xl border border-amber-200/60 p-3">
            {currentSlide.illustration}
          </div>

          <h3 className="text-lg font-bold text-brand-brown">
            {currentSlide.title}
          </h3>
          <p className="text-xs sm:text-sm text-brand-brown/70 leading-relaxed px-2">
            {currentSlide.subtitle}
          </p>
        </div>

        {/* Bottom Actions */}
        <div className="flex items-center justify-between gap-3 pt-2 border-t border-amber-100">
          <button
            onClick={handleFinish}
            className="text-xs font-bold text-brand-brown/60 hover:text-brand-brown py-2.5 px-3"
          >
            বাদ দিন
          </button>

          {step < slides.length - 1 ? (
            <button
              onClick={() => setStep((s) => s + 1)}
              className="py-3 px-5 rounded-2xl font-bold text-sm bg-brand-yellow hover:brightness-105 text-brand-brown shadow flex items-center gap-1.5 active:scale-95 transition-all"
            >
              <span>পরবর্তী</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={handleFinish}
              className="py-3 px-6 rounded-2xl font-bold text-sm bg-gradient-to-r from-brand-yellow to-brand-orange hover:brightness-105 text-brand-brown shadow-lg shadow-amber-500/25 flex items-center gap-1.5 active:scale-95 transition-all"
            >
              <Check className="w-4 h-4 stroke-[3]" />
              <span>শুরু করুন</span>
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
