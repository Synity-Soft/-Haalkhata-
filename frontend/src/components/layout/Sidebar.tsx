// Collapsible left sidebar for tablet and desktop
import { useState } from 'react'
import { NavLink, Link } from 'react-router-dom'
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
  ChevronLeft,
  ChevronRight,
  ShoppingBag,
  User,
  LogOut,
  Plus,
  MapPin,
  Store,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useLang } from '@/i18n'
import { useAuth } from '@/context/AuthContext'
import { ProfileModal } from '@/components/profile/ProfileModal'

interface SidebarProps {
  isOpen?: boolean
  onToggle?: () => void
}

export function Sidebar({ isOpen = true }: SidebarProps) {
  const { t, lang } = useLang()
  const { user, logout } = useAuth()
  const [collapsed, setCollapsed] = useState(false)
  const [profileModalOpen, setProfileModalOpen] = useState(false)
  const [profileModalTab, setProfileModalTab] = useState<'profile' | 'branches'>('profile')

  const navItems = [
    { to: '/', icon: LayoutDashboard, label: t.navigation.dashboard },
    { to: '/inventory', icon: Package, label: t.navigation.inventory },
    { to: '/purchase', icon: ShoppingCart, label: t.navigation.purchase },
    { to: '/expiry', icon: Clock, label: t.navigation.expiry },
    { to: '/discounts', icon: Tag, label: t.navigation.discounts },
    { to: '/network', icon: Store, label: (t.navigation as any).network || (lang === 'bn' ? 'দোকান নেটওয়ার্ক' : 'Shop Network') },
    { to: '/credit', icon: CreditCard, label: t.navigation.credit },
    { to: '/assistant', icon: Bot, label: t.navigation.assistant },
    { to: '/reports', icon: BarChart2, label: t.navigation.reports },
    { to: '/festivals', icon: Calendar, label: t.navigation.festivals },
    { to: '/settings', icon: Settings, label: t.navigation.settings },
  ]

  return (
    <>
      <aside
        className={cn(
          'hidden lg:flex flex-col flex-shrink-0 transition-all duration-300 ease-in-out',
          'bg-card border-r border-border text-text',
          'h-screen sticky top-0 z-30 select-none shadow-card',
          collapsed ? 'w-20' : 'w-64'
        )}
      >
        {/* Brand Header */}
        {collapsed ? (
          <div className="h-16 flex items-center justify-between px-2.5 w-full border-b border-border">
            <Link
              to="/"
              className="w-10 h-10 rounded-xl bg-accent/20 p-1 flex items-center justify-center shadow-sm hover:scale-105 active:scale-95 transition-all"
              title={lang === 'bn' ? 'হালখাতা হোম' : 'Haalkhata Home'}
            >
              <img src="/logo.png" alt="হালখাতা" className="w-8 h-8 object-contain" />
            </Link>
            <button
              onClick={() => setCollapsed(false)}
              className="w-7 h-7 rounded-lg bg-background-secondary hover:bg-accent border border-border flex items-center justify-center text-text shadow-sm hover:scale-105 active:scale-95 transition-all"
              title={lang === 'bn' ? 'প্রসারিত করুন' : 'Expand Sidebar'}
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="h-16 flex items-center justify-between px-4 border-b border-border">
            <Link
              to="/"
              className="flex items-center gap-2.5 overflow-hidden group hover:opacity-90 transition-opacity"
              title={lang === 'bn' ? 'হোমপেজে যান' : 'Go to Home'}
            >
              <div className="w-11 h-11 rounded-xl bg-amber-50 dark:bg-amber-950/40 p-1 flex items-center justify-center flex-shrink-0 shadow-sm border border-amber-200/50 group-hover:scale-105 transition-transform">
                <img src="/logo.png" alt="হালখাতা" className="w-9 h-9 object-contain" />
              </div>
              <div className="flex flex-col">
                <span className="font-extrabold text-lg text-text leading-tight tracking-tight">
                  {lang === 'bn' ? 'হালখাতা' : 'Haalkhata'}
                </span>
                <span className="text-[11px] text-accent font-semibold">
                  {lang === 'bn' ? 'স্মার্ট মুদিখানা' : 'Smart Grocery'}
                </span>
              </div>
            </Link>

            <button
              onClick={() => setCollapsed(true)}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-text-secondary hover:bg-background-secondary transition-colors"
              title={lang === 'bn' ? 'সংকুচিত করুন' : 'Collapse Sidebar'}
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
          </div>
        )}

        {/* Nav Links */}
        <nav className={cn('flex-1 overflow-y-auto py-4 space-y-1', collapsed ? 'px-2' : 'px-3')}>
          {navItems.map((item) => {
            const Icon = item.icon
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) =>
                  cn(
                    'flex items-center rounded-xl font-medium transition-all duration-150',
                    collapsed
                      ? 'w-11 h-11 mx-auto justify-center p-0'
                      : 'gap-3 px-3 py-3 w-full',
                    isActive
                      ? 'bg-accent text-[#493522] shadow-sm font-bold'
                      : 'text-text hover:bg-background-secondary'
                  )
                }
                title={collapsed ? item.label : undefined}
              >
                <Icon className="w-5 h-5 flex-shrink-0" />
                {!collapsed && <span className="truncate">{item.label}</span>}
              </NavLink>
            )
          })}

          {/* Direct Menu Bar Shortcut to Add Branch */}
          <div className="pt-2">
            <button
              type="button"
              onClick={() => {
                setProfileModalTab('branches')
                setProfileModalOpen(true)
              }}
              title={lang === 'bn' ? 'নতুন শাখা যোগ করুন' : 'Add New Branch'}
              className={cn(
                'flex items-center rounded-xl font-bold transition-all duration-150 border border-border bg-background-secondary text-text hover:bg-accent hover:text-[#493522]',
                collapsed
                  ? 'w-11 h-11 mx-auto justify-center p-0'
                  : 'gap-2.5 px-3 py-2.5 w-full text-xs'
              )}
            >
              <Plus className="w-4 h-4 flex-shrink-0" />
              {!collapsed && (
                <span className="truncate">
                  {lang === 'bn' ? '+ নতুন শাখা যোগ' : '+ Add Branch'}
                </span>
              )}
            </button>
          </div>
        </nav>

        {/* User & Footer Info */}
        <div className="p-3 border-t border-border flex flex-col gap-2">
          {user && (
            <>
              {collapsed ? (
                <div className="flex flex-col items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setProfileModalOpen(true)}
                    title={`${user.fullName || user.username} (@${user.username}) - ${lang === 'bn' ? 'মালিকের প্রোফাইল ও শাখা' : 'Owner Profile & Branches'}`}
                    className="w-11 h-11 mx-auto rounded-xl bg-background-secondary border border-border text-text flex items-center justify-center hover:ring-2 hover:ring-accent transition-all"
                  >
                    <User className="w-5 h-5" />
                  </button>
                  <button
                    onClick={logout}
                    title={t.auth.logout}
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2 p-2 rounded-xl bg-background-secondary border border-border">
                  <button
                    type="button"
                    onClick={() => setProfileModalOpen(true)}
                    className="flex items-center gap-2.5 flex-1 min-w-0 text-left hover:opacity-85 transition-opacity"
                    title={lang === 'bn' ? 'প্রোফাইল ও শাখা পরিচালনা করুন' : 'Manage Profile & Branches'}
                  >
                    <div className="w-8 h-8 rounded-lg bg-accent/25 text-text flex items-center justify-center flex-shrink-0">
                      <User className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-text truncate leading-tight">
                        {user.fullName || user.username}
                      </p>
                      <p className="text-[10px] text-accent truncate font-medium">
                        {user.role || (lang === 'bn' ? 'দোকান মালিক' : 'Store Owner')}
                      </p>
                    </div>
                  </button>

                  <button
                    onClick={logout}
                    title={t.auth.logout}
                    className="w-7 h-7 flex items-center justify-center rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors flex-shrink-0"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </>
          )}

          {!collapsed && (
            <div className="px-1 text-[11px] text-text-secondary flex flex-col gap-0.5">
              <div className="flex items-center justify-between">
                <span>{lang === 'bn' ? 'হালখাতা (Haalkhata)' : 'Haalkhata ERP'}</span>
                <span className="px-1.5 py-0.5 rounded bg-background-secondary border border-border text-[9px] font-bold text-accent">
                  {lang === 'bn' ? 'স্মার্ট গ্রোসারি' : 'Smart Grocery'}
                </span>
              </div>
            </div>
          )}
        </div>
      </aside>

      {/* Profile & Branch Management Modal */}
      <ProfileModal
        isOpen={profileModalOpen}
        onClose={() => setProfileModalOpen(false)}
        initialTab={profileModalTab}
      />
    </>
  )
}
