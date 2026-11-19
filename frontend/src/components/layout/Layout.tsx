// Root layout wrapper: responsive sidebar, top header, page content, mobile bottom nav
import { useState } from 'react'
import { Outlet, NavLink, Link } from 'react-router-dom'
import { Header } from './Header'
import { Sidebar } from './Sidebar'
import { BottomNav } from './BottomNav'
import { ProfileModal } from '@/components/profile/ProfileModal'
import { ShelfBackground, PageTransition, SaveToaster } from '@/components/motion'
import { QuickTour } from '@/components/onboarding/QuickTour'
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  Clock,
  Tag,
  Bot,
  BarChart2,
  Calendar,
  CreditCard,
  Settings,
  X,
  ShoppingBag,
  User,
  LogOut,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useLang } from '@/i18n'
import { useAuth } from '@/context/AuthContext'

export default function Layout() {
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false)
  const [profileModalOpen, setProfileModalOpen] = useState(false)
  const { t, lang } = useLang()
  const { user, logout } = useAuth()

  const navItems = [
    { to: '/', icon: LayoutDashboard, label: t.navigation.dashboard },
    { to: '/inventory', icon: Package, label: t.navigation.inventory },
    { to: '/purchase', icon: ShoppingCart, label: t.navigation.purchase },
    { to: '/expiry', icon: Clock, label: t.navigation.expiry },
    { to: '/discounts', icon: Tag, label: t.navigation.discounts },
    { to: '/assistant', icon: Bot, label: t.navigation.assistant },
    { to: '/reports', icon: BarChart2, label: t.navigation.reports },
    { to: '/festivals', icon: Calendar, label: t.navigation.festivals },
    { to: '/credit', icon: CreditCard, label: t.navigation.credit },
    { to: '/settings', icon: Settings, label: t.navigation.settings },
  ]

  return (
    <div className="min-h-screen flex bg-background text-text font-sans relative overflow-x-hidden">
      {/* 3D Grocery Shelf Ambient Background */}
      <ShelfBackground />

      {/* Desktop / Tablet Sidebar */}
      <Sidebar />

      {/* Mobile Drawer Backdrop */}
      {mobileDrawerOpen && (
        <div
          className="lg:hidden fixed inset-0 z-50 bg-black/60 transition-opacity"
          onClick={() => setMobileDrawerOpen(false)}
        />
      )}

      {/* Mobile Drawer Menu */}
      <div
        className={cn(
          'lg:hidden fixed inset-y-0 left-0 z-50 w-72 bg-card text-text shadow-card-elevated border-r border-border transition-transform duration-200 ease-in-out flex flex-col',
          mobileDrawerOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="h-16 flex items-center justify-between px-4 border-b border-border">
          <Link
            to="/"
            onClick={() => setMobileDrawerOpen(false)}
            className="flex items-center gap-3 hover:opacity-90 transition-opacity"
          >
            <div className="w-10 h-10 rounded-xl bg-accent flex items-center justify-center text-[#493522] font-bold shadow-sm">
              <ShoppingBag className="w-6 h-6" />
            </div>
            <span className="font-bold text-lg text-brand-brown dark:text-brand-cream">
              {lang === 'bn' ? 'হাট-বাজার' : 'Haat-Bazaar'}
            </span>
          </Link>
          <button
            onClick={() => setMobileDrawerOpen(false)}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-brand-brown dark:text-brand-cream hover:bg-brand-cream/60"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                onClick={() => setMobileDrawerOpen(false)}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 px-3 py-3 rounded-xl font-medium transition-all duration-150',
                    isActive
                      ? 'bg-brand-yellow text-brand-brown font-semibold shadow-sm'
                      : 'text-[#5C3B1E] dark:text-[#E8D0A9] hover:bg-brand-cream/50'
                  )
                }
              >
                <Icon className="w-5 h-5 flex-shrink-0" />
                <span>{item.label}</span>
              </NavLink>
            )
          })}
        </nav>

        {/* Mobile User Card & Logout */}
        {user && (
          <div className="p-4 border-t border-[#F0D080]/60 dark:border-[#4D2A00] flex items-center justify-between gap-3 bg-amber-50/50 dark:bg-black/20">
            <button
              type="button"
              onClick={() => {
                setMobileDrawerOpen(false)
                setProfileModalOpen(true)
              }}
              className="flex items-center gap-2.5 min-w-0 text-left hover:opacity-85 transition-opacity"
            >
              <div className="w-9 h-9 rounded-xl bg-brand-yellow/30 text-brand-brown dark:text-brand-cream flex items-center justify-center flex-shrink-0">
                <User className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-brand-brown dark:text-brand-cream truncate">
                  {user.fullName || user.username}
                </p>
                <p className="text-[10px] text-brand-orange font-medium">
                  {user.role || `@${user.username}`}
                </p>
              </div>
            </button>
            <button
              onClick={() => {
                setMobileDrawerOpen(false)
                logout()
              }}
              title={t.auth.logout}
              className="p-2 rounded-xl text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <Header onMenuClick={() => setMobileDrawerOpen(true)} />

        <main className="flex-1 p-3 sm:p-5 md:p-6 lg:p-8 max-w-7xl w-full mx-auto pb-28 lg:pb-8">
          <PageTransition>
            <Outlet />
          </PageTransition>
        </main>

        <BottomNav />
      </div>

      {/* Global Notifications Toaster & First-Time Visual Tour */}
      <SaveToaster />
      <QuickTour />

      {/* Profile Modal for Mobile Drawer */}
      <ProfileModal
        isOpen={profileModalOpen}
        onClose={() => setProfileModalOpen(false)}
      />
    </div>
  )
}

