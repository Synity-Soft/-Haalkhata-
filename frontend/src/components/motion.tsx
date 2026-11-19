import React, { useEffect, useState, useRef, useMemo } from 'react'
import { motion, useMotionValue, useTransform } from 'framer-motion'
import { useLocation } from 'react-router-dom'
import { toast, Toaster } from 'sonner'
import { Check, Bell, Hourglass, RefreshCw } from 'lucide-react'
import { toBengaliDigits, formatBengaliCurrency } from '@/lib/bn'
import { usePerfTier } from '@/lib/perf'
import { useShopContext } from '@/hooks/useShopContext'
import { useBatches } from '@/db/hooks'
import { getUpcomingFestivals } from '@/engines/festival'
import { cn } from '@/lib/utils'

// ─── 1. PageTransition ──────────────────────────────────────────────────────
export interface PageTransitionProps {
  children: React.ReactNode
}

export function PageTransition({ children }: PageTransitionProps) {
  const location = useLocation()
  const { canAnimate, tier } = usePerfTier()

  if (!canAnimate || tier === 'low') {
    return <div className="w-full">{children}</div>
  }

  return (
    <motion.div
      key={location.pathname}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.25,
        ease: [0.22, 1, 0.36, 1],
      }}
      className="w-full"
    >
      {children}
    </motion.div>
  )
}

// ─── 2. AnimatedNumber ──────────────────────────────────────────────────────
export interface AnimatedNumberProps {
  value: number
  isCurrency?: boolean
  className?: string
  prefix?: string
  suffix?: string
}

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3)
}

export function AnimatedNumber({
  value,
  isCurrency = false,
  className = '',
  prefix = '',
  suffix = '',
}: AnimatedNumberProps) {
  const { canAnimate, tier } = usePerfTier()
  const isAnimated = canAnimate && tier !== 'low'

  const [displayValue, setDisplayValue] = useState<number>(() => value)
  const prevValueRef = useRef<number>(value)
  const animFrameRef = useRef<number | null>(null)

  useEffect(() => {
    if (!isAnimated) {
      setDisplayValue(value)
      prevValueRef.current = value
      return
    }

    const startValue = prevValueRef.current
    const endValue = value
    const change = endValue - startValue
    const duration = 900
    const startTime = performance.now()

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime
      const progress = Math.min(elapsed / duration, 1)
      const eased = easeOutCubic(progress)
      const current = Math.round(startValue + change * eased)

      setDisplayValue(current)

      if (progress < 1) {
        animFrameRef.current = requestAnimationFrame(animate)
      } else {
        prevValueRef.current = endValue
      }
    }

    animFrameRef.current = requestAnimationFrame(animate)

    return () => {
      if (animFrameRef.current !== null) {
        cancelAnimationFrame(animFrameRef.current)
      }
    }
  }, [value, isAnimated])

  const formatted = isCurrency
    ? formatBengaliCurrency(displayValue)
    : toBengaliDigits(displayValue)

  return (
    <span className={`tabular-nums select-none ${className}`}>
      {prefix}
      {formatted}
      {suffix}
    </span>
  )
}

// ─── 3. ProgressRing ────────────────────────────────────────────────────────
export interface ProgressRingProps {
  completed: number
  total?: number
  size?: number
  strokeWidth?: number
  className?: string
}

export function ProgressRing({
  completed,
  total = 3,
  size = 68,
  strokeWidth = 6,
  className = '',
}: ProgressRingProps) {
  const { canAnimate, tier } = usePerfTier()
  const isAnimated = canAnimate && tier !== 'low'

  const safeTotal = Math.max(total, 1)
  const ratio = Math.min(Math.max(completed / safeTotal, 0), 1)
  const isAllDone = completed >= safeTotal

  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const strokeDashoffset = circumference - ratio * circumference

  const ringColor = isAllDone ? '#16A34A' : '#F4A900'

  return (
    <div
      className={`relative inline-flex items-center justify-center shrink-0 select-none ${className}`}
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="rotate-[-90deg]">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#FDE68A"
          strokeWidth={strokeWidth}
          opacity={0.4}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={ringColor}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          style={{
            transition: isAnimated ? 'stroke-dashoffset 0.8s cubic-bezier(0.2, 0.8, 0.2, 1)' : 'none',
            willChange: isAnimated ? 'stroke-dashoffset' : 'auto',
          }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center text-center">
        {isAllDone ? (
          <div className="w-7 h-7 rounded-full bg-green-500 text-white flex items-center justify-center shadow-sm animate-in zoom-in-75 duration-300">
            <Check className="w-4 h-4 stroke-[3]" />
          </div>
        ) : (
          <div className="flex flex-col items-center leading-none">
            <span className="text-xs font-extrabold text-brand-brown">
              {toBengaliDigits(completed)}/{toBengaliDigits(total)}
            </span>
            <span className="text-[9px] font-semibold text-brand-orange mt-0.5">
              সম্পন্ন
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── 4. StockBar ────────────────────────────────────────────────────────────
export interface StockBarProps {
  current: number
  max: number
  threshold?: number
  label?: string
  unit?: string
  className?: string
  showNumbers?: boolean
}

export function StockBar({
  current,
  max,
  threshold = 10,
  label,
  unit = 'একক',
  className = '',
  showNumbers = true,
}: StockBarProps) {
  const { canAnimate, tier } = usePerfTier()
  const isAnimated = canAnimate && tier !== 'low'

  const safeMax = Math.max(max, 1)
  const ratio = Math.min(Math.max(current / safeMax, 0), 1)
  const isLowStock = current <= threshold

  const fillColor = isLowStock ? '#DC2626' : '#16A34A'
  const bgColor = isLowStock ? 'bg-red-100' : 'bg-green-100'

  return (
    <div className={cn('w-full space-y-1.5', className)}>
      {(label || showNumbers) && (
        <div className="flex items-center justify-between text-xs font-bold text-brand-brown">
          {label && <span>{label}</span>}
          {showNumbers && (
            <span className={cn('tabular-nums', isLowStock ? 'text-red-600' : 'text-green-700')}>
              {toBengaliDigits(current)} / {toBengaliDigits(max)} {unit}
            </span>
          )}
        </div>
      )}
      <div className={cn('h-3.5 w-full rounded-full overflow-hidden p-0.5 border border-black/5', bgColor)}>
        <div
          className="h-full rounded-full transition-transform duration-700 ease-out"
          style={{
            backgroundColor: fillColor,
            transform: `scaleX(${ratio})`,
            transformOrigin: 'left',
            willChange: isAnimated ? 'transform' : 'auto',
          }}
        />
      </div>
    </div>
  )
}

// ─── 5. Stagger ─────────────────────────────────────────────────────────────
export interface StaggerContainerProps {
  children: React.ReactNode
  className?: string
  gapMs?: number
}

export interface StaggerItemProps {
  children: React.ReactNode
  index?: number
  className?: string
}

export function StaggerContainer({ children, className = '' }: StaggerContainerProps) {
  return (
    <div className={cn('stagger-container', className)}>
      {children}
    </div>
  )
}

export const Stagger = StaggerContainer

export function StaggerItem({ children, index = 0, className = '' }: StaggerItemProps) {
  const { canAnimate, tier } = usePerfTier()
  const isAnimated = canAnimate && tier !== 'low'
  const delayMs = isAnimated ? index * 70 : 0

  return (
    <div
      className={cn('stagger-item', className)}
      style={{
        animation: isAnimated ? `staggerUp 0.55s cubic-bezier(0.2, 0.8, 0.2, 1) both` : 'none',
        animationDelay: `${delayMs}ms`,
        willChange: isAnimated ? 'transform, opacity' : 'auto',
      }}
    >
      {children}
      <style>{`
        @keyframes staggerUp {
          0% { opacity: 0; transform: translateY(14px); }
          100% { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}

// ─── 6. SaveToast ───────────────────────────────────────────────────────────
export function triggerHaptic() {
  try {
    if (typeof window !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate(30)
    }
  } catch {
    // Vibration not supported
  }
}

export function notifySave(
  message: string = 'সেভ হয়েছে ✓',
  options?: {
    onUndo?: () => void
    duration?: number
  }
) {
  triggerHaptic()
  toast.success(message, {
    duration: options?.duration || 5000,
    action: options?.onUndo
      ? {
          label: 'ফিরিয়ে নিন',
          onClick: options.onUndo,
        }
      : undefined,
  })
}

export const showSaveToast = notifySave

export function SaveToaster() {
  return (
    <Toaster
      position="top-center"
      richColors
      toastOptions={{
        style: {
          backgroundColor: '#FFFDF5',
          border: '1.5px solid #F0D080',
          color: '#4A2E0F',
          borderRadius: '1rem',
          fontSize: '0.9375rem',
          fontWeight: 600,
          boxShadow: '0 8px 24px -4px rgba(74, 46, 15, 0.15)',
        },
      }}
    />
  )
}

// ─── 7. Sparkline ───────────────────────────────────────────────────────────
export interface SparklineProps {
  data: number[]
  width?: number
  height?: number
  strokeColor?: string
  color?: string
  fillGradientId?: string
  className?: string
}

function generateSmoothPath(points: [number, number][]): string {
  if (points.length < 2) return ''
  let d = `M ${points[0][0]},${points[0][1]}`
  for (let i = 0; i < points.length - 1; i++) {
    const curr = points[i]
    const next = points[i + 1]
    const mx = (curr[0] + next[0]) / 2
    d += ` C ${mx},${curr[1]} ${mx},${next[1]} ${next[0]},${next[1]}`
  }
  return d
}

export function Sparkline({
  data,
  width = 160,
  height = 48,
  strokeColor,
  color,
  fillGradientId = 'sparkline-grad',
  className = '',
}: SparklineProps) {
  const activeColor = color || strokeColor || '#F4A900'
  const { canAnimate, tier } = usePerfTier()
  const isAnimated = canAnimate && tier !== 'low'

  const { pathD, areaD, totalLength } = useMemo(() => {
    if (!data || data.length === 0) {
      return { pathD: '', areaD: '', totalLength: 200 }
    }
    const padding = 4
    const drawWidth = width - padding * 2
    const drawHeight = height - padding * 2
    const min = Math.min(...data)
    const max = Math.max(...data)
    const range = max - min || 1

    const points: [number, number][] = data.map((val, idx) => {
      const x = padding + (idx / Math.max(data.length - 1, 1)) * drawWidth
      const y = padding + drawHeight - ((val - min) / range) * drawHeight
      return [x, y]
    })

    const linePath = generateSmoothPath(points)
    const areaPath = `${linePath} L ${points[points.length - 1][0]},${height} L ${points[0][0]},${height} Z`

    return {
      pathD: linePath,
      areaD: areaPath,
      totalLength: Math.round(width * 1.5),
    }
  }, [data, width, height])

  if (!pathD) return null

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={`overflow-visible select-none shrink-0 ${className}`}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={fillGradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={activeColor} stopOpacity="0.25" />
          <stop offset="100%" stopColor={activeColor} stopOpacity="0.0" />
        </linearGradient>
      </defs>
      <path d={areaD} fill={`url(#${fillGradientId})`} />
      <path
        d={pathD}
        fill="none"
        stroke={activeColor}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{
          strokeDasharray: totalLength,
          strokeDashoffset: isAnimated ? totalLength : 0,
          animation: isAnimated ? `drawSparkline 1.1s cubic-bezier(0.2, 0.8, 0.2, 1) forwards` : 'none',
          willChange: isAnimated ? 'stroke-dashoffset' : 'auto',
        }}
      />
      <style>{`
        @keyframes drawSparkline {
          to { stroke-dashoffset: 0; }
        }
      `}</style>
    </svg>
  )
}

// ─── 8. SpringTabs ──────────────────────────────────────────────────────────
export interface TabItem {
  id: string
  label: string
  icon?: React.ReactNode
}

export interface SpringTabsProps {
  tabs: TabItem[]
  activeTab: string
  onChange: (id: string) => void
  className?: string
}

export function SpringTabs({ tabs, activeTab, onChange, className = '' }: SpringTabsProps) {
  const { canAnimate, tier } = usePerfTier()
  const isAnimated = canAnimate && tier !== 'low'
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([])

  const handleKeyDown = (e: React.KeyboardEvent, index: number) => {
    let nextIndex = index
    if (e.key === 'ArrowRight') nextIndex = (index + 1) % tabs.length
    else if (e.key === 'ArrowLeft') nextIndex = (index - 1 + tabs.length) % tabs.length
    else if (e.key === 'Home') nextIndex = 0
    else if (e.key === 'End') nextIndex = tabs.length - 1
    else return

    e.preventDefault()
    const nextTab = tabs[nextIndex]
    if (nextTab) {
      onChange(nextTab.id)
      tabRefs.current[nextIndex]?.focus()
    }
  }

  return (
    <div
      role="tablist"
      aria-orientation="horizontal"
      className={cn(
        'relative inline-flex items-center p-1 rounded-2xl bg-amber-100/60 border border-amber-200/80 backdrop-blur-sm',
        className
      )}
    >
      {tabs.map((tab, idx) => {
        const isActive = tab.id === activeTab
        return (
          <button
            key={tab.id}
            ref={(el) => (tabRefs.current[idx] = el)}
            role="tab"
            aria-selected={isActive}
            tabIndex={isActive ? 0 : -1}
            onClick={() => onChange(tab.id)}
            onKeyDown={(e) => handleKeyDown(e, idx)}
            className={cn(
              'relative z-10 px-4 py-2 text-xs sm:text-sm font-bold rounded-xl transition-colors duration-150',
              'min-h-[44px] min-w-[48px] flex items-center justify-center gap-1.5 select-none focus:outline-none',
              isActive
                ? 'text-[#4A2E0F]'
                : 'text-[#4A2E0F]/65 hover:text-[#4A2E0F]'
            )}
          >
            {isActive && isAnimated && (
              <motion.div
                layoutId="spring-pill-indicator"
                className="absolute inset-0 bg-brand-yellow rounded-xl shadow-sm -z-10"
                transition={{
                  type: 'spring',
                  stiffness: 380,
                  damping: 24,
                  mass: 0.8,
                }}
              />
            )}
            {isActive && !isAnimated && (
              <div className="absolute inset-0 bg-brand-yellow rounded-xl shadow-sm -z-10" />
            )}
            {tab.icon && <span className="shrink-0">{tab.icon}</span>}
            <span>{tab.label}</span>
          </button>
        )
      })}
    </div>
  )
}

// ─── 9. ShelfBackground ─────────────────────────────────────────────────────
const STUDENT_ITEMS = ['icon-noodles-pack', 'icon-egg-tray', 'icon-bread', 'icon-tea-box', 'icon-biscuit', 'icon-noodles-pack', 'icon-egg-tray', 'icon-sugar-salt', 'icon-soap', 'icon-tea-box']
const GARMENT_ITEMS = ['icon-rice-bag', 'icon-dal-jar', 'icon-oil-bottle', 'icon-soap', 'icon-sugar-salt', 'icon-rice-bag', 'icon-oil-bottle', 'icon-dal-jar', 'icon-tea-box', 'icon-soap']
const UPSCALE_ITEMS = ['icon-tea-box', 'icon-milk-carton', 'icon-spice-jar', 'icon-biscuit', 'icon-oil-bottle', 'icon-egg-tray', 'icon-milk-carton', 'icon-spice-jar', 'icon-tea-box', 'icon-bread']
const MIXED_ITEMS = ['icon-rice-bag', 'icon-oil-bottle', 'icon-dal-jar', 'icon-tea-box', 'icon-biscuit', 'icon-milk-carton', 'icon-sugar-salt', 'icon-noodles-pack', 'icon-egg-tray', 'icon-soap']

export function ShelfBackground() {
  const { currentShop } = useShopContext()
  const { tier, canAnimate } = usePerfTier()
  const batches = useBatches(currentShop?.id || '') || []

  const hasExpiryAlert = useMemo(() => {
    const now = Date.now()
    return batches.some((b) => {
      if (b.deleted || (b.quantity ?? (b as any).currentQuantity ?? 0) <= 0) return false
      const diffDays = Math.ceil((new Date(b.expiryDate).getTime() - now) / (1000 * 60 * 60 * 24))
      return diffDays <= 5
    })
  }, [batches])

  const areaType = currentShop?.areaType || 'mixed'
  const items = useMemo(() => {
    switch (areaType) {
      case 'student': return STUDENT_ITEMS
      case 'garment': return GARMENT_ITEMS
      case 'affluent': return UPSCALE_ITEMS
      default: return MIXED_ITEMS
    }
  }, [areaType])

  const isAnimated = canAnimate && tier !== 'low'

  const allRows = [
    { id: 1, duration: '65s', reverse: false, top: '4%' },
    { id: 2, duration: '85s', reverse: true,  top: '20%' },
    { id: 3, duration: '75s', reverse: false, top: '36%' },
    { id: 4, duration: '90s', reverse: true,  top: '52%' },
    { id: 5, duration: '70s', reverse: false, top: '68%' },
    { id: 6, duration: '80s', reverse: true,  top: '84%' },
  ]

  const rows = tier === 'low' ? [allRows[1], allRows[4]] : allRows

  return (
    <div
      className="fixed inset-0 pointer-events-none select-none overflow-hidden z-0 perf-contain"
      aria-hidden="true"
      style={{ opacity: 0.15 }}
    >
      {rows.map((row) => {
        const loopedItems = [...items, ...items, ...items]
        return (
          <div key={row.id} className="absolute left-0 right-0 w-full" style={{ top: row.top }}>
            <div
              className="flex items-end gap-12 w-max"
              style={{
                animation: isAnimated
                  ? `${row.reverse ? 'shelfScrollReverse' : 'shelfScroll'} ${row.duration} linear infinite`
                  : 'none',
                willChange: isAnimated ? 'transform' : 'auto',
              }}
            >
              {loopedItems.map((symbolId, idx) => {
                const isGlowing = hasExpiryAlert && (idx % 6 === 2)
                return (
                  <div key={`${row.id}-${idx}`} className="flex flex-col items-center justify-end" style={{ width: '56px', height: '56px' }}>
                    <svg
                      width="52"
                      height="52"
                      viewBox="0 0 64 64"
                      className="shrink-0 drop-shadow-sm transition-transform"
                      style={{ filter: isGlowing ? 'drop-shadow(0 0 8px rgba(220, 38, 38, 0.8))' : 'none' }}
                    >
                      <use href={`/sprites/grocery.svg#${symbolId}`} />
                    </svg>
                  </div>
                )
              })}
            </div>
            <div
              className="w-full mt-1.5"
              style={{
                height: '7px',
                background: 'linear-gradient(90deg, #8C5B23 0%, #B98A3E 50%, #8C5B23 100%)',
                boxShadow: '0 2px 4px rgba(74, 46, 15, 0.25)',
                borderRadius: '2px',
              }}
            />
          </div>
        )
      })}
      <style>{`
        @keyframes shelfScroll { 0% { transform: translateX(0); } 100% { transform: translateX(-33.333%); } }
        @keyframes shelfScrollReverse { 0% { transform: translateX(-33.333%); } 100% { transform: translateX(0); } }
      `}</style>
    </div>
  )
}

// ─── 10. TimeScene ──────────────────────────────────────────────────────────
type TimePeriod = 'morning' | 'noon' | 'evening' | 'night'

function getTimePeriod(): TimePeriod {
  const hour = new Date().getHours()
  if (hour >= 5 && hour < 12) return 'morning'
  if (hour >= 12 && hour < 17) return 'noon'
  if (hour >= 17 && hour < 20) return 'evening'
  return 'night'
}

export function TimeScene() {
  const period = getTimePeriod()
  const { canAnimate, tier } = usePerfTier()
  const isAnimated = canAnimate && tier !== 'low'

  const isEidNear = useMemo(() => {
    try {
      const upcoming = getUpcomingFestivals(30)
      return upcoming.some(
        (f) =>
          (f.name.toLowerCase().includes('eid') || (f.nameBn && f.nameBn.includes('ঈদ'))) &&
          f.daysUntil >= 0 &&
          f.daysUntil <= 18
      )
    } catch {
      return false
    }
  }, [])

  return (
    <div
      className="relative w-36 h-20 rounded-2xl overflow-hidden shadow-inner flex items-center justify-center select-none shrink-0 border border-amber-200/60"
      style={{
        background:
          period === 'morning'
            ? 'linear-gradient(180deg, #FDE68A 0%, #FFFBEB 100%)'
            : period === 'noon'
            ? 'linear-gradient(180deg, #BAE6FD 0%, #F0FDF4 100%)'
            : period === 'evening'
            ? 'linear-gradient(180deg, #FB923C 0%, #FEF3C7 100%)'
            : 'linear-gradient(180deg, #37210D 0%, #5E3917 100%)',
      }}
      aria-label={`Time scene: ${period}`}
    >
      <svg viewBox="0 0 144 80" className="w-full h-full">
        {period === 'morning' && (
          <g>
            <circle cx="72" cy="50" r="22" fill="#F59E0B" className={isAnimated ? 'animate-pulse' : ''} style={{ animationDuration: '4s' }} />
            <circle cx="72" cy="50" r="16" fill="#FBBF24" />
            <circle cx="72" cy="50" r="10" fill="#FEF08A" />
            <path d="M-10 80 Q30 52 70 64 T154 80 Z" fill="#D97706" opacity="0.4" />
            <path d="M-10 80 Q40 60 90 62 T154 80 Z" fill="#B45309" opacity="0.6" />
          </g>
        )}
        {period === 'noon' && (
          <g>
            <circle cx="110" cy="24" r="14" fill="#FBBF24" filter="drop-shadow(0 0 6px #F59E0B)" />
            <circle cx="110" cy="24" r="8" fill="#FFFBEB" />
            <path d="M-10 80 Q35 55 80 65 T154 80 Z" fill="#22C55E" opacity="0.5" />
            <path d="M-10 80 Q50 62 100 60 T154 80 Z" fill="#15803D" opacity="0.7" />
          </g>
        )}
        {period === 'evening' && (
          <g>
            <circle cx="50" cy="56" r="20" fill="#EA580C" opacity="0.9" />
            <circle cx="50" cy="56" r="13" fill="#F97316" />
            <path d="M-10 80 Q40 50 85 64 T154 80 Z" fill="#7C2D12" opacity="0.6" />
            <path d="M-10 80 Q60 58 110 58 T154 80 Z" fill="#431407" opacity="0.8" />
          </g>
        )}
        {(period === 'night' || isEidNear) && (
          <g>
            <path d="M100 20 A12 12 0 1 0 114 38 A14 14 0 1 1 100 20 Z" fill="#FEF08A" filter="drop-shadow(0 0 4px #FDE047)" className={isAnimated ? 'animate-pulse' : ''} style={{ animationDuration: '3s' }} />
            <g className={isAnimated ? 'animate-pulse' : ''} style={{ animationDuration: isEidNear ? '1.5s' : '4s' }}>
              <circle cx="30" cy="22" r="1.5" fill="#FEF9C3" />
              <circle cx="55" cy="16" r="2" fill="#FEF08A" />
              <circle cx="42" cy="36" r="1.2" fill="#FEF9C3" />
              <circle cx="80" cy="26" r="1.8" fill="#FDE047" />
              <circle cx="125" cy="18" r="1.4" fill="#FEF9C3" />
              <circle cx="70" cy="40" r="1.5" fill="#FEF08A" />
            </g>
            <path d="M-10 80 Q40 60 85 66 T154 80 Z" fill="#1C1005" opacity="0.7" />
            <path d="M-10 80 Q60 64 120 62 T154 80 Z" fill="#120A03" opacity="0.9" />
            {isEidNear && (
              <text x="48" y="52" fontSize="9" fontFamily="sans-serif" fontWeight="bold" fill="#FEF08A" textAnchor="middle">
                🌙 ঈদ মোবারক
              </text>
            )}
          </g>
        )}
      </svg>
    </div>
  )
}

// ─── 11. CrateAnimation ─────────────────────────────────────────────────────
export function CrateAnimation() {
  const [isPaused, setIsPaused] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleVisibility = () => setIsPaused(document.hidden)
    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [])

  return (
    <div
      ref={containerRef}
      className="crate-anim-container w-full max-w-[280px] mx-auto py-2 select-none"
      style={{ animationPlayState: isPaused ? 'paused' : 'running' }}
      aria-label="Smart Grocery Crate Inventory Animation"
    >
      <style>{`
        @keyframes crateSlideIn { 0% { transform: translateY(16px); opacity: 0; } 12%, 80% { transform: translateY(0); opacity: 1; } 95%, 100% { transform: translateY(-8px); opacity: 0; } }
        @keyframes prodDrop1 { 0%, 15% { transform: translateY(-30px); opacity: 0; } 25%, 80% { transform: translateY(0); opacity: 1; } 95%, 100% { transform: translateY(0); opacity: 0; } }
        @keyframes prodDrop2 { 0%, 28% { transform: translateY(-30px); opacity: 0; } 38%, 80% { transform: translateY(0); opacity: 1; } 95%, 100% { transform: translateY(0); opacity: 0; } }
        @keyframes prodDrop3 { 0%, 42% { transform: translateY(-30px); opacity: 0; } 52%, 80% { transform: translateY(0); opacity: 1; } 95%, 100% { transform: translateY(0); opacity: 0; } }
        @keyframes prodDrop4 { 0%, 55% { transform: translateY(-30px); opacity: 0; } 65%, 80% { transform: translateY(0); opacity: 1; } 95%, 100% { transform: translateY(0); opacity: 0; } }
        @keyframes stockBarFill { 0%, 25% { transform: scaleX(0); } 65%, 80% { transform: scaleX(1); } 95%, 100% { transform: scaleX(0); } }
        @keyframes checkmarkFade { 0%, 65% { transform: scale(0.5); opacity: 0; } 72%, 82% { transform: scale(1); opacity: 1; } 95%, 100% { transform: scale(0.8); opacity: 0; } }
        .anim-crate { animation: crateSlideIn 6s ease-in-out infinite; }
        .anim-p1 { animation: prodDrop1 6s cubic-bezier(0.34, 1.56, 0.64, 1) infinite; }
        .anim-p2 { animation: prodDrop2 6s cubic-bezier(0.34, 1.56, 0.64, 1) infinite; }
        .anim-p3 { animation: prodDrop3 6s cubic-bezier(0.34, 1.56, 0.64, 1) infinite; }
        .anim-p4 { animation: prodDrop4 6s cubic-bezier(0.34, 1.56, 0.64, 1) infinite; }
        .anim-bar { transform-origin: left; animation: stockBarFill 6s ease-out infinite; }
        .anim-check { transform-origin: center; animation: checkmarkFade 6s ease-out infinite; }
        @media (prefers-reduced-motion: reduce) {
          .anim-crate, .anim-p1, .anim-p2, .anim-p3, .anim-p4, .anim-bar, .anim-check {
            animation: none !important; transform: none !important; opacity: 1 !important;
          }
        }
      `}</style>
      <div className="relative h-28 w-full flex items-center justify-center">
        <svg viewBox="0 0 240 110" className="w-full h-full overflow-visible drop-shadow-sm" fill="none">
          <g className="anim-crate">
            <rect x="35" y="55" width="170" height="48" rx="8" fill="#B98A3E" stroke="#875E22" strokeWidth="2.5" />
            <rect x="42" y="64" width="156" height="8" rx="3" fill="#D5AA36" opacity="0.9" />
            <rect x="42" y="78" width="156" height="8" rx="3" fill="#D5AA36" opacity="0.9" />
            <rect x="100" y="59" width="40" height="7" rx="3.5" fill="#583A14" />
          </g>
          <g className="anim-p1">
            <rect x="52" y="30" width="26" height="38" rx="4" fill="#F8FAFC" stroke="#94A3B8" strokeWidth="2" />
            <polygon points="52,30 65,20 78,30" fill="#38BDF8" />
            <rect x="58" y="42" width="14" height="12" rx="2" fill="#BAE6FD" />
          </g>
          <g className="anim-p2">
            <ellipse cx="98" cy="48" rx="14" ry="20" fill="#A855F7" stroke="#7E22CE" strokeWidth="2" />
            <path d="M96 28 C96 22 102 20 102 18" stroke="#22C55E" strokeWidth="3" strokeLinecap="round" />
            <ellipse cx="95" cy="45" rx="3" ry="5" fill="#C084FC" />
          </g>
          <g className="anim-p3 hidden sm:inline">
            <rect x="126" y="32" width="28" height="36" rx="4" fill="#FBBF24" stroke="#D97706" strokeWidth="2" />
            <rect x="131" y="40" width="18" height="6" rx="2" fill="#FEF3C7" />
            <circle cx="140" cy="56" r="4" fill="#D97706" />
          </g>
          <g className="anim-p4">
            <circle cx="170" cy="48" r="16" fill="#22C55E" stroke="#15803D" strokeWidth="2" />
            <path d="M170 32 C171 28 175 27 177 26" stroke="#854D0E" strokeWidth="2.5" strokeLinecap="round" />
            <ellipse cx="166" cy="44" rx="3" ry="4" fill="#86EFAC" />
          </g>
          <g className="anim-check">
            <circle cx="205" cy="30" r="13" fill="#15803D" stroke="#FFFFFF" strokeWidth="2" />
            <path d="M199 30 L203 34 L211 26" stroke="#FFFFFF" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </g>
        </svg>
        <div className="absolute bottom-1 w-44 h-1.5 bg-border rounded-full overflow-hidden">
          <div className="anim-bar h-full w-full bg-accent rounded-full" />
        </div>
      </div>
    </div>
  )
}

// ─── 12. SwipeRow ───────────────────────────────────────────────────────────
export interface SwipeRowProps {
  children: React.ReactNode
  onPay?: () => void
  onRemind?: () => void
  onSwipeRight?: () => void
  onSwipeLeft?: () => void
  rightLabel?: string
  leftLabel?: string
  className?: string
}

export function SwipeRow({
  children,
  onPay,
  onRemind,
  onSwipeRight,
  onSwipeLeft,
  rightLabel = 'পরিশোধ',
  leftLabel = 'মনে করান',
  className = '',
}: SwipeRowProps) {
  const { canAnimate, tier } = usePerfTier()
  const isAnimated = canAnimate && tier !== 'low'

  const handlePay = onSwipeRight || onPay
  const handleRemind = onSwipeLeft || onRemind

  const x = useMotionValue(0)
  const payOpacity = useTransform(x, [0, 80], [0, 1])
  const remindOpacity = useTransform(x, [0, -80], [0, 1])

  const handleDragEnd = (_: any, info: { offset: { x: number } }) => {
    if (info.offset.x > 80) {
      handlePay?.()
    } else if (info.offset.x < -80) {
      handleRemind?.()
    }
  }

  if (!isAnimated) {
    return <div className={cn('relative w-full', className)}>{children}</div>
  }

  return (
    <div className={cn('relative w-full overflow-hidden rounded-2xl select-none', className)}>
      <motion.div
        style={{ opacity: payOpacity }}
        className="absolute inset-y-0 left-0 w-1/2 bg-green-500 text-white flex items-center justify-start pl-6 gap-2 font-bold text-sm"
      >
        <Check className="w-5 h-5 stroke-[3]" />
        <span>{rightLabel}</span>
      </motion.div>
      <motion.div
        style={{ opacity: remindOpacity }}
        className="absolute inset-y-0 right-0 w-1/2 bg-blue-600 text-white flex items-center justify-end pr-6 gap-2 font-bold text-sm"
      >
        <span>{leftLabel}</span>
        <Bell className="w-5 h-5" />
      </motion.div>
      <motion.div
        drag="x"
        dragConstraints={{ left: -100, right: 100 }}
        dragElastic={0.2}
        onDragEnd={handleDragEnd}
        style={{ x }}
        className="relative z-10 bg-white shadow-sm"
      >
        {children}
      </motion.div>
    </div>
  )
}

// ─── 13. MicroAnimations ────────────────────────────────────────────────────
export function TruckRoad({ className = '' }: { className?: string }) {
  const { canAnimate, tier } = usePerfTier()
  const isAnimated = canAnimate && tier !== 'low'

  return (
    <div className={cn('relative w-full h-14 overflow-hidden rounded-2xl bg-amber-50/80 border border-amber-200/60 p-2 flex items-center', className)}>
      <div className="absolute left-0 right-0 bottom-2.5 h-1 bg-[#B98A3E]/40 border-t border-dashed border-[#B98A3E]" />
      <div
        className="absolute bottom-2 flex items-center gap-1"
        style={{
          animation: isAnimated ? 'driveTruck 10s linear infinite' : 'none',
          willChange: isAnimated ? 'transform' : 'auto',
        }}
      >
        <svg width="44" height="28" viewBox="0 0 44 28" fill="none">
          <rect x="2" y="4" width="24" height="18" rx="2" fill="#2563EB" />
          <path d="M26 10 L34 10 L38 15 L38 22 L26 22 Z" fill="#3B82F6" />
          <rect x="29" y="12" width="6" height="5" rx="1" fill="#E0F2FE" />
          <circle cx="10" cy="23" r="3.5" fill="#1E293B" />
          <circle cx="10" cy="23" r="1.5" fill="#CBD5E1" />
          <circle cx="32" cy="23" r="3.5" fill="#1E293B" />
          <circle cx="32" cy="23" r="1.5" fill="#CBD5E1" />
          <text x="14" y="16" fontSize="7" fontWeight="bold" fill="#FFF" textAnchor="middle">মাল</text>
        </svg>
      </div>
      <style>{`
        @keyframes driveTruck {
          0% { transform: translateX(-50px); }
          100% { transform: translateX(calc(100vw + 60px)); }
        }
      `}</style>
    </div>
  )
}

export function CoinDrop({ onComplete }: { onComplete?: () => void }) {
  const { canAnimate, tier } = usePerfTier()
  const isAnimated = canAnimate && tier !== 'low'

  useEffect(() => {
    const timer = setTimeout(() => {
      onComplete?.()
    }, 700)
    return () => clearTimeout(timer)
  }, [onComplete])

  return (
    <div className="fixed inset-0 z-50 pointer-events-none flex items-center justify-center">
      <div
        className="w-14 h-14 rounded-full bg-gradient-to-br from-amber-300 via-amber-400 to-amber-600 border-2 border-amber-500 shadow-xl flex items-center justify-center text-[#4A2E0F] font-black text-2xl"
        style={{
          animation: isAnimated ? 'coinDrop 0.65s cubic-bezier(0.2, 0.8, 0.2, 1) forwards' : 'none',
        }}
      >
        ৳
      </div>
      <style>{`
        @keyframes coinDrop {
          0% { opacity: 0; transform: translateY(-80px) scale(0.6) rotate(-20deg); }
          50% { opacity: 1; transform: translateY(10px) scale(1.1) rotate(10deg); }
          100% { opacity: 0; transform: translateY(50px) scale(0.8); }
        }
      `}</style>
    </div>
  )
}

export function CheckDraw({ size = 28, className = '' }: { size?: number; className?: string }) {
  const { canAnimate, tier } = usePerfTier()
  const isAnimated = canAnimate && tier !== 'low'

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="#16A34A"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <circle cx="12" cy="12" r="10" stroke="#86EFAC" strokeWidth="2" fill="#DCFCE7" />
      <path
        d="M8 12 L11 15 L16 9"
        style={{
          strokeDasharray: 20,
          strokeDashoffset: isAnimated ? 20 : 0,
          animation: isAnimated ? 'drawCheck 0.45s ease-out forwards 0.1s' : 'none',
        }}
      />
      <style>{`
        @keyframes drawCheck { to { stroke-dashoffset: 0; } }
      `}</style>
    </svg>
  )
}

export function HourglassBadge({
  daysRemaining,
  className = '',
}: {
  daysRemaining: number
  className?: string
}) {
  const { canAnimate, tier } = usePerfTier()
  const isAnimated = canAnimate && tier !== 'low'
  const isUrgent = daysRemaining <= 2

  return (
    <div
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-bold transition-all',
        isUrgent
          ? 'bg-red-100 text-red-700 border border-red-300'
          : 'bg-amber-100 text-amber-800 border border-amber-300',
        className
      )}
      style={{
        animation: isUrgent && isAnimated ? 'shakeTwice 0.6s ease-in-out 2' : 'none',
      }}
    >
      <Hourglass className={cn('w-3.5 h-3.5', isUrgent ? 'text-red-600' : 'text-amber-700')} />
      <span>
        {daysRemaining <= 0 ? 'মেয়াদ শেষ' : `${daysRemaining} দিন বাকি`}
      </span>
      <style>{`
        @keyframes shakeTwice {
          0%, 100% { transform: translateX(0); }
          20%, 60% { transform: translateX(-3px); }
          40%, 80% { transform: translateX(3px); }
        }
      `}</style>
    </div>
  )
}

export function SyncIcon({ isSyncing, className = '' }: { isSyncing: boolean; className?: string }) {
  const { canAnimate, tier } = usePerfTier()
  const isAnimated = canAnimate && tier !== 'low'

  return (
    <RefreshCw
      className={cn(
        'w-4 h-4',
        isSyncing && isAnimated && 'animate-spin text-brand-orange',
        isSyncing && !isAnimated && 'text-brand-orange',
        className
      )}
    />
  )
}

export function ThinkingDots({ className = '' }: { className?: string }) {
  const { canAnimate, tier } = usePerfTier()
  const isAnimated = canAnimate && tier !== 'low'

  return (
    <div className={cn('inline-flex items-center gap-1.5 px-3 py-2 rounded-2xl bg-purple-100 text-purple-700', className)}>
      <span className="text-xs font-bold mr-1">AI ভাবছে</span>
      <span className="w-1.5 h-1.5 rounded-full bg-purple-600" style={{ animation: isAnimated ? 'bounceDot 1s infinite 0s' : 'none' }} />
      <span className="w-1.5 h-1.5 rounded-full bg-purple-600" style={{ animation: isAnimated ? 'bounceDot 1s infinite 0.2s' : 'none' }} />
      <span className="w-1.5 h-1.5 rounded-full bg-purple-600" style={{ animation: isAnimated ? 'bounceDot 1s infinite 0.4s' : 'none' }} />
      <style>{`
        @keyframes bounceDot {
          0%, 80%, 100% { transform: scale(0.6); opacity: 0.5; }
          40% { transform: scale(1.2); opacity: 1; }
        }
      `}</style>
    </div>
  )
}
