import { useState, useRef, useEffect, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  ShoppingBasket,
  Sun,
  Moon,
  Monitor,
  Wifi,
  WifiOff,
  RefreshCw,
  Bell,
  Menu,
  ChevronDown,
  User,
  LogOut,
  MapPin,
  Plus,
  Clock,
  Package,
  CheckCircle2,
  AlertTriangle,
  CreditCard,
  ArrowRight,
  X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useLang } from '@/i18n'
import { useTheme } from '@/providers/ThemeProvider'
import { useShopContext } from '@/hooks/useShopContext'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'
import { useAuth } from '@/context/AuthContext'
import { useBatches, useProducts, useCredits } from '@/db/hooks'
import { ProfileModal } from '@/components/profile/ProfileModal'

interface HeaderProps {
  onMenuClick?: () => void
  isSidebarOpen?: boolean
}

type ThemeOption = 'light' | 'dark' | 'system'

export function Header({ onMenuClick }: HeaderProps) {
  const navigate = useNavigate()
  const { t, lang, setLang } = useLang()
  const { theme, setTheme, isDark } = useTheme()
  const { currentShop, shops, setCurrentShop, isSyncing, lastSyncAt } = useShopContext()
  const { user, logout } = useAuth()
  const isOnline = useOnlineStatus()

  const [shopDropdownOpen, setShopDropdownOpen] = useState(false)
  const [themeDropdownOpen, setThemeDropdownOpen] = useState(false)
  const [notifDropdownOpen, setNotifDropdownOpen] = useState(false)
  const [readNotifIds, setReadNotifIds] = useState<string[]>([])
  const [profileModalOpen, setProfileModalOpen] = useState(false)
  const [profileModalTab, setProfileModalTab] = useState<'profile' | 'branches'>('profile')

  const shopRef = useRef<HTMLDivElement>(null)
  const themeRef = useRef<HTMLDivElement>(null)
  const notifRef = useRef<HTMLDivElement>(null)

  // Fetch batches, products, and credits for active shop to generate real-time notifications
  const batches = useBatches(currentShop?.id || '') || []
  const products = useProducts(currentShop?.id || '') || []
  const credits = useCredits(currentShop?.id || '') || []

  // Close dropdowns on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (shopRef.current && !shopRef.current.contains(e.target as Node)) {
        setShopDropdownOpen(false)
      }
      if (themeRef.current && !themeRef.current.contains(e.target as Node)) {
        setThemeDropdownOpen(false)
      }
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  // Calculate live notifications
  const notifications = useMemo(() => {
    const list: Array<{
      id: string
      type: 'expiry' | 'stock' | 'credit' | 'system'
      title: string
      desc: string
      time: string
      link: string
      urgent?: boolean
    }> = []

    const now = Date.now()

    // 1. Expiring batches (within 15 days, or already expired)
    for (const b of batches) {
      if (b.deleted || b.currentQuantity <= 0) continue
      const diffDays = Math.ceil((new Date(b.expiryDate).getTime() - now) / (1000 * 60 * 60 * 24))
      if (diffDays <= 15) {
        const prod = products.find((p) => p.id === b.productId)
        const prodName = lang === 'bn' ? (prod?.name || 'পণ্য') : (prod?.nameEn || prod?.name || 'Product')
        list.push({
          id: `exp-${b.id}`,
          type: 'expiry',
          urgent: diffDays <= 3,
          title: diffDays <= 0
            ? (lang === 'bn' ? `${prodName} মেয়াদোত্তীর্ণ হয়েছে!` : `${prodName} has expired!`)
            : (lang === 'bn' ? `${prodName} - মেয়াদ ${diffDays} দিনে শেষ হবে` : `${prodName} expires in ${diffDays} days`),
          desc: lang === 'bn' ? `${b.currentQuantity} একক মজুদ দ্রুত নিষ্পত্তি করুন` : `Discount or return ${b.currentQuantity} remaining units`,
          time: diffDays <= 3 ? (lang === 'bn' ? 'জরুরি' : 'Urgent') : (lang === 'bn' ? 'আসন্ন' : 'Upcoming'),
          link: '/expiry',
        })
      }
    }

    // 2. Low stock products (current stock <= 15)
    for (const p of products) {
      if (p.deleted) continue
      const prodBatches = batches.filter((b) => b.productId === p.id && !b.deleted)
      const currentStock = prodBatches.reduce((sum, b) => sum + b.currentQuantity, 0)
      if (currentStock <= 15) {
        const prodName = lang === 'bn' ? p.name : (p.nameEn || p.name)
        list.push({
          id: `stock-${p.id}`,
          type: 'stock',
          urgent: currentStock <= 5,
          title: lang === 'bn' ? `${prodName} মজুদ কমে গেছে` : `Low stock for ${prodName}`,
          desc: lang === 'bn' ? `বর্তমানে মাত্র ${currentStock} একক বাকি আছে` : `Only ${currentStock} units left in stock`,
          time: lang === 'bn' ? 'পুনর্বিক্রয়' : 'Reorder',
          link: '/purchase',
        })
      }
    }

    // 3. Unpaid customer credits
    const unpaidCredits = credits.filter((c) => !c.deleted && !c.isPaid)
    if (unpaidCredits.length > 0) {
      const totalDue = unpaidCredits.reduce((sum, c) => sum + (c.dueAmount || 0), 0)
      list.push({
        id: 'credit-unpaid-summary',
        type: 'credit',
        urgent: false,
        title: lang === 'bn' ? `${unpaidCredits.length} জন কাস্টমারের বাকি আদায় বাকি` : `${unpaidCredits.length} pending customer dues`,
        desc: lang === 'bn' ? `মোট বাকি ৳${totalDue} — সময়মতো তাগাদা দিন` : `Total pending ৳${totalDue} to collect`,
        time: lang === 'bn' ? 'বাকির খাতা' : 'Credit',
        link: '/credit',
      })
    }

    // 4. System status
    if (list.length === 0) {
      list.push({
        id: 'sys-all-good',
        type: 'system',
        title: lang === 'bn' ? 'সবকিছু স্বাভাবিক আছে ✓' : 'All systems operating smoothly ✓',
        desc: lang === 'bn' ? 'মজুদ, মেয়াদ ও বাকির কোনো জরুরি ঝুঁকি নেই' : 'No urgent stock, expiry, or credit risks right now',
        time: lang === 'bn' ? 'স্ট্যাটাস' : 'Status',
        link: '/',
      })
    }

    return list.slice(0, 10)
  }, [batches, products, credits, lang])

  const unreadCount = notifications.filter((n) => !readNotifIds.includes(n.id) && n.type !== 'system').length

  const markAllAsRead = () => {
    setReadNotifIds(notifications.map((n) => n.id))
  }

  const themeOptions: { value: ThemeOption; icon: React.ReactNode; label: string }[] = [
    { value: 'light', icon: <Sun className="w-4 h-4" />, label: lang === 'bn' ? 'আলো' : 'Light' },
    { value: 'dark', icon: <Moon className="w-4 h-4" />, label: lang === 'bn' ? 'অন্ধকার' : 'Dark' },
    { value: 'system', icon: <Monitor className="w-4 h-4" />, label: lang === 'bn' ? 'সিস্টেম' : 'System' },
  ]

  function formatLastSync() {
    if (!lastSyncAt) return null
    const diff = Math.floor((Date.now() - lastSyncAt.getTime()) / 60000)
    if (diff < 1) return lang === 'bn' ? 'এইমাত্র' : 'Just now'
    return lang === 'bn'
      ? `শেষ সিঙ্ক: ${diff} মিনিট আগে`
      : `Last sync: ${diff}m ago`
  }

  const syncLabel = isSyncing
    ? lang === 'bn'
      ? 'সিঙ্ক হচ্ছে...'
      : 'Syncing...'
    : formatLastSync()

  return (
    <>
      <header
        className={cn(
          'sticky top-0 z-40 w-full h-14',
          'bg-card text-text',
          'border-b border-border',
          'shadow-card'
        )}
      >
        <div className="h-full flex items-center gap-2 px-3 md:px-4">
          {/* Mobile: hamburger */}
          <button
            onClick={onMenuClick}
            aria-label="Open menu"
            className={cn(
              'lg:hidden w-10 h-10 flex items-center justify-center rounded-xl',
              'text-brand-brown',
              'hover:bg-brand-cream/60 transition-colors'
            )}
          >
            <Menu className="w-5 h-5" />
          </button>

          {/* Logo with Link to Home (Mobile & Tablet, since Sidebar has desktop logo) */}
          <Link
            to="/"
            className="flex items-center gap-1.5 shrink-0 hover:opacity-90 active:scale-95 transition-all group lg:hidden"
            title={lang === 'bn' ? 'হোমপেজে যান' : 'Go to Home'}
          >
            <ShoppingBasket className="w-7 h-7 text-brand-orange group-hover:scale-105 transition-transform" strokeWidth={1.75} />
            <span className="text-lg font-bold text-brand-brown hidden xs:block leading-none">
              {lang === 'bn' ? 'হাট-বাজার' : 'Haat-Bazaar'}
            </span>
          </Link>

          {/* Shop Location & Branch selector — desktop/tablet */}
          <div ref={shopRef} className="relative hidden sm:block ml-2 lg:ml-3">
            <button
              onClick={() => setShopDropdownOpen((p) => !p)}
              className={cn(
                'flex items-center gap-2 px-3 py-1.5 rounded-xl',
                'border border-border',
                'bg-background-secondary',
                'text-sm text-text',
                'hover:border-accent transition-colors',
                'max-w-[240px]'
              )}
              title={lang === 'bn' ? 'দোকানের বর্তমান শাখা ও অন্যান্য শাখা' : 'Current Shop Location & Branches'}
            >
              <MapPin className="w-4 h-4 text-accent shrink-0" />
              <span className="truncate font-semibold text-xs sm:text-sm">
                {lang === 'bn'
                  ? (currentShop?.name || '৯/এ, ধানমন্ডি')
                  : (currentShop?.nameEn || currentShop?.name || '9/A, Dhanmondi')}
              </span>
              <ChevronDown
                className={cn(
                  'w-3.5 h-3.5 text-text-secondary transition-transform shrink-0',
                  shopDropdownOpen && 'rotate-180'
                )}
              />
            </button>

            {shopDropdownOpen && (
              <div
                className={cn(
                  'absolute top-full left-0 mt-1 w-64 rounded-2xl overflow-hidden',
                  'bg-elevated text-text',
                  'border border-border',
                  'shadow-card-elevated z-50 animate-in fade-in duration-150'
                )}
              >
                <div className="px-3.5 py-2 text-xs font-bold text-accent uppercase tracking-wider border-b border-border bg-background-secondary flex items-center justify-between">
                  <span>{lang === 'bn' ? 'দোকানের শাখাসমূহ' : 'Store Branches'}</span>
                  <span className="text-[10px] text-brand-brown/50 dark:text-brand-cream/50">
                    {shops.length} {lang === 'bn' ? 'টি শাখা' : 'branches'}
                  </span>
                </div>

                <div className="max-h-60 overflow-y-auto">
                  {shops.map((shop) => (
                    <button
                      key={shop.id}
                      onClick={() => {
                        setCurrentShop(shop)
                        setShopDropdownOpen(false)
                      }}
                      className={cn(
                        'w-full flex items-start gap-3 px-3.5 py-2.5 text-sm text-left transition-colors',
                        shop.id === currentShop?.id
                          ? 'text-brand-orange font-bold bg-brand-cream/60 dark:bg-white/10'
                          : 'text-brand-brown dark:text-brand-cream hover:bg-brand-cream/40 dark:hover:bg-white/5'
                      )}
                    >
                      <MapPin className="w-4 h-4 shrink-0 text-brand-orange mt-0.5" />
                      <div className="min-w-0">
                        <div className="font-semibold truncate">
                          {lang === 'bn' ? shop.name : (shop.nameEn || shop.name)}
                        </div>
                        <div className="text-[11px] opacity-60 truncate">
                          {shop.address || shop.location || (lang === 'bn' ? 'ঢাকা, বাংলাদেশ' : 'Dhaka, Bangladesh')}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>

                {/* Add new branch shortcut */}
                <div className="p-2 border-t border-border bg-background-secondary">
                  <button
                    onClick={() => {
                      setShopDropdownOpen(false)
                      setProfileModalTab('branches')
                      setProfileModalOpen(true)
                    }}
                    className="w-full py-1.5 px-3 rounded-xl text-xs font-bold text-accent bg-card border border-border hover:bg-accent hover:text-[#493522] transition-all flex items-center justify-center gap-1.5"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>{lang === 'bn' ? '+ নতুন শাখা যোগ করুন' : '+ Add New Branch'}</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Sync status — desktop only */}
          {syncLabel && (
            <div className="hidden lg:flex items-center gap-1.5 text-xs text-text-secondary mr-2">
              <RefreshCw
                className={cn('w-3.5 h-3.5', isSyncing && 'animate-spin text-accent')}
              />
              <span>{syncLabel}</span>
            </div>
          )}

          {/* Online/offline indicator */}
          <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-background-secondary border border-border text-xs font-medium shrink-0">
            {isOnline ? (
              <>
                <Wifi className="w-3.5 h-3.5 text-success" />
                <span className="text-success hidden sm:inline font-semibold">
                  {lang === 'bn' ? 'অনলাইন' : 'Online'}
                </span>
              </>
            ) : (
              <>
                <WifiOff className="w-3.5 h-3.5 text-danger" />
                <span className="text-danger hidden sm:inline font-semibold">
                  {lang === 'bn' ? 'অফলাইন' : 'Offline'}
                </span>
              </>
            )}
          </div>

          {/* Language selector */}
          <div className="flex rounded-xl overflow-hidden border border-border bg-background-secondary shrink-0">
            {(['bn', 'en'] as const).map((l) => (
              <button
                key={l}
                onClick={() => setLang(l)}
                className={cn(
                  'px-2.5 py-1 text-xs font-bold transition-colors',
                  lang === l
                    ? 'bg-accent text-[#493522]'
                    : 'text-text-secondary hover:bg-card'
                )}
              >
                {l === 'bn' ? 'BN' : 'EN'}
              </button>
            ))}
          </div>

          {/* Theme switcher */}
          <div ref={themeRef} className="relative shrink-0">
            <button
              onClick={() => setThemeDropdownOpen((p) => !p)}
              aria-label="Change theme"
              className={cn(
                'w-9 h-9 flex items-center justify-center rounded-xl',
                'text-text',
                'border border-border bg-background-secondary',
                'hover:border-accent transition-colors'
              )}
            >
              {isDark ? <Moon className="w-4 h-4 text-accent" /> : <Sun className="w-4 h-4 text-accent" />}
            </button>

            {themeDropdownOpen && (
              <div
                className={cn(
                  'absolute top-full right-0 mt-1 w-36 rounded-xl overflow-hidden',
                  'bg-elevated text-text',
                  'border border-border',
                  'shadow-card-elevated z-50 animate-in fade-in duration-150'
                )}
              >
                {themeOptions.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => {
                      setTheme(opt.value)
                      setThemeDropdownOpen(false)
                    }}
                    className={cn(
                      'w-full flex items-center gap-2.5 px-3 py-2 text-sm',
                      'hover:bg-brand-cream dark:hover:bg-white/10 transition-colors',
                      theme === opt.value
                        ? 'text-brand-orange font-semibold'
                        : 'text-brand-brown dark:text-brand-cream'
                    )}
                  >
                    {opt.icon}
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Notification bell & Dropdown */}
          <div ref={notifRef} className="relative shrink-0">
            <button
              onClick={() => setNotifDropdownOpen((p) => !p)}
              aria-label={lang === 'bn' ? 'নোটিফিকেশন' : 'Notifications'}
              className={cn(
                'relative w-9 h-9 flex items-center justify-center rounded-xl',
                'text-text',
                'border border-border bg-background-secondary',
                'hover:border-accent transition-colors'
              )}
            >
              <Bell className="w-4 h-4" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-accent text-[#493522] text-[9px] font-bold flex items-center justify-center leading-none shadow-sm animate-pulse">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>

            {/* Notification Dropdown Panel */}
            {notifDropdownOpen && (
              <div
                className={cn(
                  'fixed inset-x-3 top-16 sm:absolute sm:inset-auto sm:top-full sm:right-0 sm:mt-1.5 sm:w-96 rounded-2xl overflow-hidden',
                  'bg-elevated text-text',
                  'border border-border',
                  'shadow-card-elevated z-50 animate-in fade-in slide-in-from-top-2 duration-150'
                )}
              >
                {/* Notification Header */}
                <div className="p-3.5 border-b border-border bg-background-secondary flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Bell className="w-4 h-4 text-accent" />
                    <span className="text-xs font-bold text-text">
                      {lang === 'bn' ? 'সতর্কবার্তা ও নোটিফিকেশন' : 'Alerts & Notifications'}
                    </span>
                    {unreadCount > 0 && (
                      <span className="px-1.5 py-0.5 rounded-full text-[10px] font-extrabold bg-accent text-[#493522]">
                        {unreadCount}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {unreadCount > 0 && (
                      <button
                        onClick={markAllAsRead}
                        className="text-[11px] font-bold text-brand-orange hover:underline focus:outline-none"
                      >
                        {lang === 'bn' ? 'সব পঠিত' : 'Mark all read'}
                      </button>
                    )}
                    <button
                      onClick={() => setNotifDropdownOpen(false)}
                      className="w-6 h-6 rounded-lg flex items-center justify-center text-brand-brown/60 dark:text-brand-cream/60 hover:bg-amber-100 dark:hover:bg-white/10"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Notification Items List */}
                <div className="max-h-80 overflow-y-auto divide-y divide-amber-100/60 dark:divide-amber-900/20">
                  {notifications.map((item) => (
                    <div
                      key={item.id}
                      onClick={() => {
                        setNotifDropdownOpen(false)
                        navigate(item.link)
                      }}
                      className={cn(
                        'p-3 hover:bg-amber-50/60 dark:hover:bg-white/5 cursor-pointer transition-colors flex items-start gap-3',
                        !readNotifIds.includes(item.id) && item.type !== 'system' && 'bg-amber-50/40 dark:bg-white/[0.04]'
                      )}
                    >
                      <div
                        className={cn(
                          'w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 text-xs',
                          item.type === 'expiry'
                            ? item.urgent
                              ? 'bg-red-100 text-red-600 dark:bg-red-950/60 dark:text-red-400'
                              : 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400'
                            : item.type === 'stock'
                            ? item.urgent
                              ? 'bg-red-100 text-red-600 dark:bg-red-950/60 dark:text-red-400'
                              : 'bg-orange-100 text-orange-600 dark:bg-orange-950/60 dark:text-orange-400'
                            : item.type === 'credit'
                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400'
                            : 'bg-green-100 text-green-600 dark:bg-green-950/60 dark:text-green-400'
                        )}
                      >
                        {item.type === 'expiry' ? (
                          <Clock className="w-3.5 h-3.5" />
                        ) : item.type === 'stock' ? (
                          <Package className="w-3.5 h-3.5" />
                        ) : item.type === 'credit' ? (
                          <CreditCard className="w-3.5 h-3.5" />
                        ) : (
                          <CheckCircle2 className="w-3.5 h-3.5" />
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-bold text-brand-brown dark:text-brand-cream line-clamp-1">
                          {item.title}
                        </div>
                        <div className="text-[11px] text-brand-brown/70 dark:text-brand-cream/70 line-clamp-1 mt-0.5">
                          {item.desc}
                        </div>
                      </div>

                      <div className="shrink-0 flex items-center gap-1 text-[10px] font-semibold text-brand-orange mt-0.5">
                        <span>{item.time}</span>
                        <ArrowRight className="w-3 h-3" />
                      </div>
                    </div>
                  ))}
                </div>

                {/* Footer action */}
                <div className="p-2 border-t border-amber-100 dark:border-amber-900/40 bg-amber-50/40 dark:bg-black/20 text-center">
                  <Link
                    to="/reports"
                    onClick={() => setNotifDropdownOpen(false)}
                    className="text-xs font-bold text-brand-brown/70 dark:text-brand-cream/70 hover:text-brand-orange transition-colors inline-block py-1"
                  >
                    {lang === 'bn' ? 'সকল রিপোর্ট ও পরিসংখ্যান দেখুন →' : 'View Full Reports & Analytics →'}
                  </Link>
                </div>
              </div>
            )}
          </div>

          {/* User profile & Logout */}
          {user && (
            <div className="flex items-center gap-1.5 pl-1.5 border-l border-border shrink-0">
              <button
                type="button"
                onClick={() => {
                  setProfileModalTab('profile')
                  setProfileModalOpen(true)
                }}
                className="flex items-center gap-1.5 text-left hover:opacity-85 transition-opacity"
                title={lang === 'bn' ? 'মালিকের প্রোফাইল ও শাখা' : 'Owner Profile & Branches'}
              >
                <div className="hidden lg:flex flex-col text-right">
                  <span className="text-xs font-bold text-text leading-tight">
                    {user.fullName || user.username}
                  </span>
                  <span className="text-[10px] text-accent font-medium">
                    @{user.username}
                  </span>
                </div>
                <div
                  className="w-9 h-9 rounded-xl bg-background-secondary border border-border flex items-center justify-center text-text shadow-sm"
                >
                  <User className="w-4 h-4" />
                </div>
              </button>

              <button
                onClick={logout}
                title={t.auth.logout}
                aria-label={t.auth.logout}
                className={cn(
                  'w-9 h-9 flex items-center justify-center rounded-xl',
                  'text-red-600 dark:text-red-400',
                  'border border-red-200 dark:border-red-900/50 bg-red-50/60 dark:bg-red-950/30',
                  'hover:bg-red-100 dark:hover:bg-red-900/50 transition-colors'
                )}
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Owner Profile & Branch Management Modal */}
      <ProfileModal
        isOpen={profileModalOpen}
        onClose={() => setProfileModalOpen(false)}
        initialTab={profileModalTab}
      />
    </>
  )
}

export default Header
