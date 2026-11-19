// Mobile bottom navigation bar for quick access
import { NavLink } from 'react-router-dom'
import { LayoutDashboard, Package, ShoppingCart, Clock, Bot } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useLang } from '@/i18n'

export function BottomNav() {
  const { t } = useLang()

  const items = [
    { to: '/', icon: LayoutDashboard, label: t.navigation.dashboard },
    { to: '/inventory', icon: Package, label: t.navigation.inventory },
    { to: '/purchase', icon: ShoppingCart, label: t.navigation.purchase },
    { to: '/expiry', icon: Clock, label: t.navigation.expiry },
    { to: '/assistant', icon: Bot, label: t.navigation.assistant },
  ]

  return (
    <nav
      className={cn(
        'lg:hidden fixed bottom-0 left-0 right-0 z-40',
        'bg-card text-text',
        'border-t border-border',
        'flex items-center justify-around px-2 py-1',
        'pb-safe shadow-card-elevated'
      )}
    >
      {items.map((item) => {
        const Icon = item.icon
        return (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) =>
              cn(
                'flex flex-col items-center justify-center min-w-[56px] py-1.5 px-2 rounded-xl transition-all',
                isActive
                  ? 'text-accent font-bold'
                  : 'text-text-secondary hover:text-text font-medium'
              )
            }
          >
            {({ isActive }) => (
              <>
                <div
                  className={cn(
                    'p-1 rounded-lg transition-transform',
                    isActive ? 'bg-background-secondary scale-110' : ''
                  )}
                >
                  <Icon className="w-5 h-5" />
                </div>
                <span className="text-[11px] leading-tight mt-0.5 truncate max-w-[64px]">
                  {item.label}
                </span>
              </>
            )}
          </NavLink>
        )
      })}
    </nav>
  )
}

