// Global shop selection and sync state context for Haat-Bazar
import { createContext, useContext, useState, useEffect, useMemo, type ReactNode } from 'react'
import type { Shop } from '@/types'
import { useShops } from '@/db/hooks'
import { useAuth } from '@/context/AuthContext'

interface ShopContextValue {
  currentShop: Shop | null
  shops: Shop[]
  setCurrentShop: (shop: Shop) => void
  selectShopId: (shopId: string) => void
  isSyncing: boolean
  setIsSyncing: (syncing: boolean) => void
  lastSyncAt: Date | null
  setLastSyncAt: (date: Date | null) => void
}

const ShopContext = createContext<ShopContextValue | null>(null)

export function ShopProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const dbShops = useShops() as Shop[] | undefined

  // Compute effective shops based on authentication state
  const shops: Shop[] = useMemo(() => {
    if (user?.branches && user.branches.length > 0) {
      return user.branches.map((b) => {
        const branchId = (b.outlet_id || b.id || '').trim()
        const existing = (dbShops || []).find((s) => s.id === branchId)
        if (existing) {
          return {
            ...existing,
            name: b.outlet_name || b.name || existing.name,
          }
        }
        return {
          id: branchId,
          name: b.outlet_name || b.name || branchId,
          nameEn: b.name || b.outlet_name || branchId,
          areaType: 'mixed' as const,
          area: b.area || '',
          location: b.area || b.district || '',
          address: [b.area, b.district].filter(Boolean).join(', ') || 'ঢাকা, বাংলাদেশ',
          ownerName: user.fullName || user.username,
          phone: user.phone || '',
          updatedAt: new Date().toISOString(),
          deleted: false,
        }
      })
    }
    return dbShops || []
  }, [user?.branches, dbShops, user?.fullName, user?.username, user?.phone])

  const [currentShopId, setCurrentShopId] = useState<string>(() => {
    return localStorage.getItem('hb-selected-shop-id') || ''
  })

  const [isSyncing, setIsSyncing] = useState(false)
  const [lastSyncAt, setLastSyncAt] = useState<Date | null>(() => {
    const saved = localStorage.getItem('hb-last-sync')
    return saved ? new Date(saved) : null
  })

  // Reconcile selected shop ID whenever shops or user branches change
  useEffect(() => {
    if (user?.branches && user.branches.length > 0) {
      const authorizedIds = user.branches.map((b) => b.outlet_id || b.id)
      if (!authorizedIds.includes(currentShopId)) {
        const primary = user.branches.find((b) => b.is_primary) || user.branches[0]
        const targetId = primary ? (primary.outlet_id || primary.id) : authorizedIds[0]
        if (targetId && targetId !== currentShopId) {
          setCurrentShopId(targetId)
          localStorage.setItem('hb-selected-shop-id', targetId)
        }
      }
    } else if (shops.length > 0 && !shops.some((s) => s.id === currentShopId)) {
      const defaultId = shops[0].id
      setCurrentShopId(defaultId)
      localStorage.setItem('hb-selected-shop-id', defaultId)
    }
  }, [user?.branches, shops, currentShopId])

  // Current shop reference
  const currentShop = shops.find((s) => s.id === currentShopId) || shops[0] || null

  const selectShopId = (shopId: string) => {
    if (!shopId) return

    // If user is authenticated with branches, strictly enforce authorization
    if (user?.branches && user.branches.length > 0) {
      const authorizedIds = user.branches.map((b) => b.outlet_id || b.id)
      if (!authorizedIds.includes(shopId)) {
        console.warn(`[ShopProvider] Access denied: Outlet '${shopId}' is not in user's authorized branches:`, authorizedIds)
        return
      }
    }

    setCurrentShopId(shopId)
    localStorage.setItem('hb-selected-shop-id', shopId)
  }

  const setCurrentShop = (shop: Shop) => {
    if (shop?.id) {
      selectShopId(shop.id)
    }
  }

  return (
    <ShopContext.Provider
      value={{
        currentShop,
        shops,
        setCurrentShop,
        selectShopId,
        isSyncing,
        setIsSyncing,
        lastSyncAt,
        setLastSyncAt,
      }}
    >
      {children}
    </ShopContext.Provider>
  )
}

export function useShopContext(): ShopContextValue {
  const ctx = useContext(ShopContext)
  if (!ctx) {
    throw new Error('useShopContext must be used within ShopProvider')
  }
  return ctx
}
