// Global shop selection and sync state context for Haat-Bazaar
import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'
import type { Shop } from '@/types'
import { useShops } from '@/db/hooks'

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
  const dbShops = useShops() as Shop[] | undefined
  const shops = dbShops || []

  const [currentShopId, setCurrentShopId] = useState<string>(() => {
    return localStorage.getItem('hb-selected-shop-id') || 'shop-student-01'
  })

  const [isSyncing, setIsSyncing] = useState(false)
  const [lastSyncAt, setLastSyncAt] = useState<Date | null>(() => {
    const saved = localStorage.getItem('hb-last-sync')
    return saved ? new Date(saved) : null
  })

  // Keep selected shop in sync
  const currentShop = shops.find((s) => s.id === currentShopId) || shops[0] || null

  const setCurrentShop = (shop: Shop) => {
    setCurrentShopId(shop.id)
    localStorage.setItem('hb-selected-shop-id', shop.id)
  }

  const selectShopId = (shopId: string) => {
    setCurrentShopId(shopId)
    localStorage.setItem('hb-selected-shop-id', shopId)
  }

  useEffect(() => {
    if (shops.length > 0 && !shops.some((s) => s.id === currentShopId)) {
      setCurrentShopId(shops[0].id)
    }
  }, [shops, currentShopId])

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
