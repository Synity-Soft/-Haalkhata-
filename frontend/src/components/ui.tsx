import React, { forwardRef, useEffect, useCallback, ButtonHTMLAttributes } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Loader2,
  Database,
  Server,
  WifiOff,
  RefreshCw,
  X,
  LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { usePerfTier } from '@/lib/perf'

// ─── 1. Badge ───────────────────────────────────────────────────────────────
export interface BadgeProps {
  children: React.ReactNode
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'cream'
  className?: string
}

const badgeVariantClasses: Record<NonNullable<BadgeProps['variant']>, string> = {
  default: 'bg-brand-yellow text-brand-brown',
  success: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  warning: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
  danger: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  info: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  cream: 'bg-brand-cream text-brand-brown',
}

export function Badge({ children, variant = 'default', className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold leading-none whitespace-nowrap',
        badgeVariantClasses[variant],
        className
      )}
    >
      {children}
    </span>
  )
}

// ─── 2. Button ──────────────────────────────────────────────────────────────
type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger'
type ButtonSize = 'sm' | 'md' | 'lg'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
  children: React.ReactNode
}

const buttonVariantClasses: Record<ButtonVariant, string> = {
  primary: 'bg-accent text-[#493522] hover:opacity-90 active:scale-[0.98] shadow-sm font-bold',
  secondary: 'bg-brand-orange text-white hover:bg-orange-700 active:scale-[0.98] shadow-sm font-bold',
  outline: 'border border-border text-text bg-background-secondary hover:bg-accent hover:text-[#493522] active:scale-[0.98]',
  ghost: 'bg-transparent text-text hover:bg-background-secondary active:scale-[0.98]',
  danger: 'bg-danger text-white hover:opacity-90 active:scale-[0.98] shadow-sm font-bold',
}

const buttonSizeClasses: Record<ButtonSize, string> = {
  sm: 'h-9 px-3 text-sm rounded-lg',
  md: 'h-11 px-5 text-base rounded-xl min-h-[44px]',
  lg: 'h-13 px-7 text-lg rounded-2xl min-h-[52px]',
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      loading = false,
      disabled,
      children,
      className,
      ...props
    },
    ref
  ) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={cn(
          'inline-flex items-center justify-center gap-2 font-semibold',
          'transition-all duration-150 ease-out',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-yellow focus-visible:ring-offset-2',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          'select-none',
          buttonVariantClasses[variant],
          buttonSizeClasses[size],
          className
        )}
        {...props}
      >
        {loading && <Loader2 className="w-4 h-4 animate-spin shrink-0" />}
        {children}
      </button>
    )
  }
)
Button.displayName = 'Button'

// ─── 3. Card ────────────────────────────────────────────────────────────────
type CardPadding = 'sm' | 'md' | 'lg'

export interface CardProps {
  children: React.ReactNode
  className?: string
  padding?: CardPadding
  onClick?: () => void
}

const cardPaddingClasses: Record<CardPadding, string> = {
  sm: 'p-3',
  md: 'p-4',
  lg: 'p-6',
}

export function Card({ children, className, padding = 'md', onClick }: CardProps) {
  return (
    <div
      onClick={onClick}
      className={cn(
        'rounded-2xl border',
        'bg-card border-border text-text',
        'shadow-card transition-all duration-150',
        cardPaddingClasses[padding],
        onClick && 'cursor-pointer hover:shadow-card-elevated hover:border-accent/50 active:scale-[0.99]',
        className
      )}
    >
      {children}
    </div>
  )
}

// ─── 4. DemoBadge ───────────────────────────────────────────────────────────
export interface DemoBadgeProps {
  source?: 'backend' | 'local' | 'loading' | 'error'
  outletId?: string | null
  error?: string | null
  className?: string
  onRetry?: () => void
}

export function DemoBadge({
  source = 'local',
  outletId,
  error,
  className,
  onRetry,
}: DemoBadgeProps) {
  if (source === 'backend') {
    return (
      <div className={cn('inline-flex items-center gap-1.5', className)}>
        <Badge variant="success" className="gap-1 py-1 px-2.5 shadow-sm text-[11px]">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <Server className="w-3 h-3 text-emerald-700 dark:text-emerald-300" />
          <span>লাইভ ব্যাকএন্ড ({outletId})</span>
        </Badge>
      </div>
    )
  }

  if (source === 'loading') {
    return (
      <div className={cn('inline-flex items-center gap-1.5', className)}>
        <Badge variant="info" className="gap-1 py-1 px-2.5 shadow-sm text-[11px]">
          <RefreshCw className="w-3 h-3 animate-spin text-blue-600 dark:text-blue-300" />
          <span>ব্যাকএন্ড সংযুক্ত হচ্ছে...</span>
        </Badge>
      </div>
    )
  }

  if (source === 'error') {
    return (
      <div className={cn('inline-flex items-center gap-1.5', className)} title={error || 'অফলাইন মোড'}>
        <Badge variant="warning" className="gap-1 py-1 px-2.5 shadow-sm text-[11px]">
          <WifiOff className="w-3 h-3 text-amber-700 dark:text-amber-300" />
          <span>অফলাইন মোড (Dexie ফলব্যাক)</span>
        </Badge>
        {onRetry && (
          <button
            onClick={onRetry}
            className="text-[11px] text-brand-brown/70 hover:text-brand-brown dark:text-brand-cream/70 dark:hover:text-brand-cream underline ml-1"
          >
            পুনরায় চেষ্টা
          </button>
        )}
      </div>
    )
  }

  return (
    <div className={cn('inline-flex items-center gap-1.5', className)}>
      <Badge variant="cream" className="gap-1 py-1 px-2.5 shadow-sm text-[11px] text-brand-brown/80 border border-brand-brown/15">
        <Database className="w-3 h-3 text-brand-orange" />
        <span>লোকাল ডেমো স্টোর {outletId ? `(${outletId})` : ''}</span>
      </Badge>
    </div>
  )
}

// ─── 5. EmptyState ──────────────────────────────────────────────────────────
export interface EmptyStateAction {
  label: string
  onClick: () => void
}

export interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description?: string
  action?: EmptyStateAction
  className?: string
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center py-16 px-6',
        className
      )}
    >
      <div className="w-20 h-20 rounded-full bg-brand-cream dark:bg-brand-brown/30 flex items-center justify-center mb-5 shadow-inner">
        <Icon className="w-9 h-9 text-brand-orange dark:text-brand-yellow" strokeWidth={1.5} />
      </div>
      <h3 className="text-xl font-bold text-brand-brown dark:text-brand-cream mb-2">
        {title}
      </h3>
      {description && (
        <p className="text-sm text-brand-brown/60 dark:text-brand-cream/60 max-w-xs leading-relaxed mb-6">
          {description}
        </p>
      )}
      {action && (
        <Button variant="primary" size="md" onClick={action.onClick}>
          {action.label}
        </Button>
      )}
    </div>
  )
}

// ─── 6. Modal ───────────────────────────────────────────────────────────────
type ModalSize = 'sm' | 'md' | 'lg'

export interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title?: string
  children: React.ReactNode
  size?: ModalSize
}

const modalSizeClasses: Record<ModalSize, string> = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-2xl',
}

const prefersReducedMotion =
  typeof window !== 'undefined'
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
    : false

const modalOverlayVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
}

const modalContentVariants = {
  hidden: prefersReducedMotion
    ? { opacity: 0 }
    : { opacity: 0, y: 24, scale: 0.97 },
  visible: prefersReducedMotion
    ? { opacity: 1 }
    : { opacity: 1, y: 0, scale: 1 },
  exit: prefersReducedMotion
    ? { opacity: 0 }
    : { opacity: 0, y: 12, scale: 0.98 },
}

export function Modal({ isOpen, onClose, title, children, size = 'md' }: ModalProps) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    },
    [onClose]
  )

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown)
      document.body.style.overflow = 'hidden'
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = ''
    }
  }, [isOpen, handleKeyDown])

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <motion.div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            variants={modalOverlayVariants}
            initial="hidden"
            animate="visible"
            exit="hidden"
            transition={{ duration: 0.2 }}
            onClick={onClose}
            aria-hidden="true"
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby={title ? 'modal-title' : undefined}
            variants={modalContentVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className={cn(
              'relative z-10 w-full',
              modalSizeClasses[size],
              'bg-card text-text',
              'rounded-t-2xl sm:rounded-2xl',
              'border border-border',
              'shadow-card-elevated',
              'max-h-[90dvh] flex flex-col'
            )}
          >
            {title && (
              <div className="flex items-center justify-between p-4 border-b border-amber-100 dark:border-slate-700 shrink-0">
                <h2
                  id="modal-title"
                  className="text-lg font-bold text-brand-brown dark:text-brand-cream"
                >
                  {title}
                </h2>
                <button
                  onClick={onClose}
                  aria-label="Close modal"
                  className={cn(
                    'w-9 h-9 flex items-center justify-center rounded-xl',
                    'text-brand-brown/60 dark:text-brand-cream/60',
                    'hover:bg-brand-cream dark:hover:bg-white/10',
                    'transition-colors duration-150'
                  )}
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            )}
            <div className="overflow-y-auto flex-1 p-4">{children}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}

// ─── 7. ProductIcon ─────────────────────────────────────────────────────────
export type ProductCategory =
  | 'rice'
  | 'staples'
  | 'dal'
  | 'lentils'
  | 'oil'
  | 'dairy'
  | 'milk'
  | 'egg'
  | 'eggs'
  | 'noodles'
  | 'tea'
  | 'beverage'
  | 'spices'
  | 'bakery'
  | 'bread'
  | 'hygiene'
  | 'soap'
  | 'snacks'
  | 'biscuit'
  | 'sugar'
  | 'salt'
  | 'other'

export interface ProductIconProps {
  category?: string
  name?: string
  size?: number | string
  className?: string
  title?: string
}

function resolveSymbolId(category?: string, name?: string): string {
  const query = `${category || ''} ${name || ''}`.toLowerCase()

  if (query.includes('চাল') || query.includes('rice') || query.includes('staple')) {
    return 'icon-rice-bag'
  }
  if (query.includes('ডাল') || query.includes('dal') || query.includes('lentil')) {
    return 'icon-dal-jar'
  }
  if (query.includes('তেল') || query.includes('oil') || query.includes('soyabean') || query.includes('সয়াবিন') || query.includes('সয়াবিন')) {
    return 'icon-oil-bottle'
  }
  if (query.includes('দুধ') || query.includes('milk') || query.includes('dairy') || query.includes('ডিপ্লোমা')) {
    return 'icon-milk-carton'
  }
  if (query.includes('ডিম') || query.includes('egg')) {
    return 'icon-egg-tray'
  }
  if (query.includes('নুডলস') || query.includes('noodle') || query.includes('ম্যাগি')) {
    return 'icon-noodles-pack'
  }
  if (query.includes('চা') || query.includes('tea') || query.includes('ইস্পাহানি') || query.includes('তাঁজা')) {
    return 'icon-tea-box'
  }
  if (query.includes('মসলা') || query.includes('spice') || query.includes('হলুদ') || query.includes('মরিচ') || query.includes('রাঁধুনী')) {
    return 'icon-spice-jar'
  }
  if (query.includes('রুটি') || query.includes('bread') || query.includes('বন') || query.includes('bakery')) {
    return 'icon-bread'
  }
  if (query.includes('সাবান') || query.includes('soap') || query.includes('লাক্স') || query.includes('লাইফবয়') || query.includes('hygiene') || query.includes('ডিটারজেন্ট')) {
    return 'icon-soap'
  }
  if (query.includes('বিস্কুট') || query.includes('biscuit') || query.includes('কুকিজ') || query.includes('টায়গার') || query.includes('snack')) {
    return 'icon-biscuit'
  }
  if (query.includes('চিনি') || query.includes('লবণ') || query.includes('sugar') || query.includes('salt')) {
    return 'icon-sugar-salt'
  }

  return 'icon-basket'
}

export function ProductIcon({ category, name, size = 32, className = '', title }: ProductIconProps) {
  const symbolId = resolveSymbolId(category, name)

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      className={`inline-block shrink-0 select-none ${className}`}
      aria-label={title || category || name || 'Product'}
      role="img"
    >
      <use href={`/sprites/grocery.svg#${symbolId}`} />
    </svg>
  )
}

// ─── 8. SoftIcon ────────────────────────────────────────────────────────────
export type SoftIconTone = 'yellow' | 'blue' | 'green' | 'red' | 'purple'

export interface SoftIconProps {
  icon: LucideIcon
  tone?: SoftIconTone
  size?: number | 'sm' | 'md' | 'lg'
  delayIndex?: number
  className?: string
  iconSize?: number
  badge?: React.ReactNode
}

const TONE_STYLES: Record<
  SoftIconTone,
  {
    gradient: string
    border: string
    iconColor: string
    highlight: string
    shadow: string
  }
> = {
  yellow: {
    gradient: 'from-[#FCD34D] via-[#F59E0B] to-[#D97706]',
    border: 'border-[#F59E0B]',
    iconColor: 'text-[#4A2E0F]',
    highlight: 'rgba(255, 255, 255, 0.7)',
    shadow: 'rgba(217, 119, 6, 0.35)',
  },
  blue: {
    gradient: 'from-[#93C5FD] via-[#3B82F6] to-[#1D4ED8]',
    border: 'border-[#2563EB]',
    iconColor: 'text-white',
    highlight: 'rgba(255, 255, 255, 0.65)',
    shadow: 'rgba(29, 78, 216, 0.35)',
  },
  green: {
    gradient: 'from-[#86EFAC] via-[#22C55E] to-[#15803D]',
    border: 'border-[#16A34A]',
    iconColor: 'text-white',
    highlight: 'rgba(255, 255, 255, 0.65)',
    shadow: 'rgba(21, 128, 61, 0.35)',
  },
  red: {
    gradient: 'from-[#FCA5A5] via-[#EF4444] to-[#B91C1C]',
    border: 'border-[#DC2626]',
    iconColor: 'text-white',
    highlight: 'rgba(255, 255, 255, 0.65)',
    shadow: 'rgba(185, 28, 28, 0.35)',
  },
  purple: {
    gradient: 'from-[#D8B4FE] via-[#A855F7] to-[#7E22CE]',
    border: 'border-[#9333EA]',
    iconColor: 'text-white',
    highlight: 'rgba(255, 255, 255, 0.65)',
    shadow: 'rgba(126, 34, 206, 0.35)',
  },
}

export function SoftIcon({
  icon: Icon,
  tone = 'yellow',
  size = 66,
  delayIndex = 0,
  className = '',
  iconSize,
  badge,
}: SoftIconProps) {
  const numericSize =
    typeof size === 'number'
      ? size
      : size === 'sm'
      ? 38
      : size === 'md'
      ? 52
      : 66

  const { canAnimate, tier } = usePerfTier()
  const style = TONE_STYLES[tone] || TONE_STYLES.yellow

  const actualIconSize = iconSize || Math.round(numericSize * 0.44)
  const isAnimated = canAnimate && tier !== 'low'
  const delaySec = (delayIndex * 0.35) % 1.5

  return (
    <div
      className={cn('relative inline-flex items-center justify-center select-none', className)}
      style={{ width: numericSize, height: numericSize }}
    >
      <div
        className={cn(
          'w-full h-full rounded-2xl flex items-center justify-center',
          'bg-gradient-to-b',
          style.gradient,
          'border',
          style.border,
          'transition-transform duration-150 active:scale-[0.96] cursor-pointer'
        )}
        style={{
          boxShadow: `
            inset 0 1.5px 1.5px 0 ${style.highlight},
            inset 0 -3px 4px 0 rgba(0, 0, 0, 0.18),
            0 8px 16px -4px ${style.shadow}
          `,
          animation: isAnimated ? `softFloat 3.2s ease-in-out infinite ${delaySec}s` : 'none',
          willChange: isAnimated ? 'transform' : 'auto',
        }}
      >
        <Icon
          size={actualIconSize}
          className={cn(style.iconColor, 'drop-shadow-sm')}
          strokeWidth={2.2}
        />
      </div>

      {badge && (
        <div className="absolute -top-1 -right-1 z-10">
          {badge}
        </div>
      )}

      <style>{`
        @keyframes softFloat {
          0%, 100% {
            transform: translateY(0px);
          }
          50% {
            transform: translateY(-5px);
          }
        }
      `}</style>
    </div>
  )
}
