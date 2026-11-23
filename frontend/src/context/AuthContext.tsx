// Authentication context and provider for Haalkhata ERP
import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'
import type { AuthUser, Shop } from '@/types'
import { db } from '@/db/schema'
import { api } from '@/lib/api'

export interface StoredUser extends AuthUser {
  password: string
}

export interface RegisterBranchInput {
  name: string
  district: string
  area: string
}

export interface RegisterData {
  username: string
  password: string
  fullName?: string
  shopName?: string
  phone?: string
  address?: string
  district?: string
  area?: string
  branches?: RegisterBranchInput[]
}

export interface UpdateProfileData {
  fullName?: string
  shopName?: string
  phone?: string
  address?: string
  district?: string
  area?: string
  password?: string
}

interface AuthContextValue {
  user: AuthUser | null
  isAuthenticated: boolean
  isLoading: boolean
  login: (username: string, password: string) => Promise<{ success: boolean; error?: string }>
  register: (data: RegisterData) => Promise<{ success: boolean; error?: string }>
  updateProfile: (data: UpdateProfileData) => Promise<{ success: boolean; error?: string }>
  logout: () => void
}

const AUTH_STORAGE_KEY = 'hb_current_user'
const USERS_STORAGE_KEY = 'hb_registered_users'

const INITIAL_DEFAULT_USERS: StoredUser[] = [
  {
    id: 'user-owner',
    username: 'owner',
    password: 'password123',
    fullName: 'Shop Owner',
    shopName: 'হালখাতা জেনারেল স্টোর',
    role: 'Shop Owner',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'user-admin',
    username: 'admin',
    password: 'password123',
    fullName: 'Shop Owner',
    shopName: 'হালখাতা জেনারেল স্টোর',
    role: 'Shop Owner',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'user-admin-alt',
    username: 'admin',
    password: 'admin123',
    fullName: 'Shop Owner',
    shopName: 'হালখাতা জেনারেল স্টোর',
    role: 'Shop Owner',
    createdAt: new Date().toISOString(),
  },
]

function getStoredUsers(): StoredUser[] {
  try {
    const raw = localStorage.getItem(USERS_STORAGE_KEY)
    if (!raw) {
      localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(INITIAL_DEFAULT_USERS))
      return INITIAL_DEFAULT_USERS
    }
    return JSON.parse(raw) as StoredUser[]
  } catch (err) {
    console.error('Failed to parse stored users:', err)
    return INITIAL_DEFAULT_USERS
  }
}

function saveStoredUsers(users: StoredUser[]): void {
  try {
    localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users))
  } catch (err) {
    console.error('Failed to save stored users:', err)
  }
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Initialize session from localStorage
  useEffect(() => {
    try {
      // Ensure initial demo accounts exist
      getStoredUsers()

      const savedUser = localStorage.getItem(AUTH_STORAGE_KEY)
      const existingToken = api.getAuthToken()

      if (savedUser) {
        const parsed = JSON.parse(savedUser) as AuthUser
        setUser(parsed)

        // If local user exists but backend JWT token is missing, attempt auto-refresh from stored credentials
        if (!existingToken) {
          const storedUsers = getStoredUsers()
          const matched = storedUsers.find(
            (u) => u.username.toLowerCase() === parsed.username.toLowerCase()
          )
          if (matched && matched.password) {
            api.authLogin({ username: matched.username, password: matched.password })
              .then((res) => {
                if (res && res.success && res.access_token) {
                  api.setAuthToken(res.access_token)
                  console.info('Acquired backend JWT session on initialization for:', parsed.username)
                  if (res.user?.branches && res.user.branches.length > 0) {
                    const primary = res.user.branches.find((b: any) => b.is_primary) || res.user.branches[0]
                    if (primary) {
                      localStorage.setItem('hb-selected-shop-id', primary.outlet_id)
                    }
                  }
                }
              })
              .catch((err) => {
                console.warn('Could not auto-acquire backend token on init:', err)
              })
          }
        }
      }
    } catch (err) {
      console.error('Failed to restore auth session:', err)
    } finally {
      setIsLoading(false)
    }
  }, [])

  const login = async (username: string, password: string): Promise<{ success: boolean; error?: string }> => {
    const cleanUsername = username.trim().toLowerCase()
    const cleanPassword = password.trim()

    if (!cleanUsername || !cleanPassword) {
      return { success: false, error: 'Please enter both username and password.' }
    }

    // 1. Try centralized backend authentication (enables login across any PC, phone, or browser)
    try {
      const res = await api.authLogin({ username: cleanUsername, password: cleanPassword })
      if (res && res.success && res.user) {
        // Store backend JWT access token for authenticated API requests
        if (res.access_token) {
          api.setAuthToken(res.access_token)
        }

        const authUser: AuthUser = {
          id: res.user.id,
          username: res.user.username,
          fullName: res.user.fullName || res.user.full_name || res.user.username,
          shopName: res.user.shopName || res.user.shop_name || 'হালখাতা স্টোর',
          role: res.user.role || 'Shop Owner',
          phone: res.user.phone || '',
          address: res.user.address || '',
          branches: res.user.branches?.map((b: any) => ({
            id: b.outlet_id,
            name: b.outlet_name,
            district: b.district || '',
            area: b.area || '',
          })),
          createdAt: res.user.createdAt || res.user.created_at,
        }

        // Cache locally for offline capability
        const currentUsers = getStoredUsers()
        if (!currentUsers.some((u) => u.username.toLowerCase() === cleanUsername)) {
          saveStoredUsers([...currentUsers, { ...authUser, password: cleanPassword }])
        }

        // Select the primary authorized branch from the backend
        if (res.user.branches && res.user.branches.length > 0) {
          const primaryBranch = res.user.branches.find((b: any) => b.is_primary) || res.user.branches[0]
          if (primaryBranch) {
            localStorage.setItem('hb-selected-shop-id', primaryBranch.outlet_id)
          }
        }

        setUser(authUser)
        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(authUser))
        return { success: true }
      } else if (res && res.error) {
        // Backend returned explicit failure. Check local demo accounts before failing
        const localUsers = getStoredUsers()
        const localFound = localUsers.find(
          (u) => u.username.toLowerCase() === cleanUsername && u.password === cleanPassword
        )
        if (!localFound) {
          return { success: false, error: res.error || 'Invalid username or password. Please try again.' }
        }
      }
    } catch (apiErr: any) {
      console.warn('Backend login connection unavailable, attempting local offline login:', apiErr)
      // Surface critical server configuration errors (e.g. 500 missing JWT_SECRET_KEY)
      if (apiErr?.status >= 500) {
        return {
          success: false,
          error: `সার্ভার কনফিগারেশন ত্রুটি (HTTP ${apiErr.status}): ${apiErr.detail || 'সার্ভার অভ্যন্তরীণ ত্রুটি। JWT_SECRET_KEY কনফিগার করা আছে কিনা পরীক্ষা করুন।'}`
        }
      }
    }

    // 2. Fallback to offline local storage accounts (clear token so offline accounts are not treated as authenticated backend users)
    api.clearAuthToken()
    const users = getStoredUsers()
    const found = users.find(
      (u) => u.username.toLowerCase() === cleanUsername && u.password === cleanPassword
    )

    if (!found) {
      return { success: false, error: 'Invalid username or password. Please try again.' }
    }

    const authUser: AuthUser = {
      id: found.id,
      username: found.username,
      fullName: found.fullName || found.username,
      shopName: found.shopName || 'হালখাতা স্টোর',
      role: found.role || 'Shop Owner',
      phone: found.phone || '',
      address: found.address || '',
      createdAt: found.createdAt,
    }

    setUser(authUser)
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(authUser))
    return { success: true }
  }

  const register = async (data: RegisterData): Promise<{ success: boolean; error?: string }> => {
    const cleanUsername = data.username.trim().toLowerCase()
    const cleanPassword = data.password.trim()

    if (!cleanUsername || !cleanPassword) {
      return { success: false, error: 'Please enter both username and password.' }
    }

    if (cleanUsername.length < 3) {
      return { success: false, error: 'Username must be at least 3 characters long.' }
    }

    if (cleanPassword.length < 4) {
      return { success: false, error: 'Password must be at least 4 characters long.' }
    }

    // 1. Sync with centralized backend (makes account available across all devices and browsers)
    let backendUserId: string | undefined
    try {
      const res = await api.authRegister({
        username: cleanUsername,
        password: cleanPassword,
        fullName: data.fullName?.trim() || data.username.trim(),
        shopName: data.shopName?.trim() || 'হালখাতা স্টোর',
        phone: data.phone?.trim() || '',
        address: data.address?.trim() || '',
        district: data.district || '',
        area: data.area || '',
        branches: data.branches?.map((b) => ({
          name: b.name || `${b.area || ''}, ${b.district || ''}`.trim() || 'Branch',
          district: b.district,
          area: b.area,
        })),
      })
      if (res && !res.success && res.error) {
        return { success: false, error: res.error }
      }
      if (res && res.success) {
        if (res.access_token) {
          api.setAuthToken(res.access_token)
        }
        if (res.user?.id) {
          backendUserId = res.user.id
        }
      }
    } catch (apiErr: any) {
      console.warn('Backend registration failed, saving locally:', apiErr)
      if (apiErr?.status >= 500) {
        return {
          success: false,
          error: `সার্ভার কনফিগারেশন ত্রুটি (HTTP ${apiErr.status}): ${apiErr.detail || 'সার্ভার অভ্যন্তরীণ ত্রুটি। JWT_SECRET_KEY কনফিগার করা আছে কিনা পরীক্ষা করুন।'}`
        }
      }
    }

    const users = getStoredUsers()
    const exists = users.some((u) => u.username.toLowerCase() === cleanUsername)
    if (exists) {
      return { success: false, error: 'Username already taken. Please choose another username.' }
    }

    const newUser: StoredUser = {
      id: backendUserId || `user-${Date.now()}`,
      username: data.username.trim(),
      password: cleanPassword,
      fullName: data.fullName?.trim() || data.username.trim(),
      shopName: data.shopName?.trim() || 'Smart Grocery',
      role: 'Shop Owner',
      phone: data.phone?.trim() || '',
      address: data.address?.trim() || (data.area && data.district ? `${data.area}, ${data.district}` : ''),
      district: data.district || 'ঢাকা',
      area: data.area || 'ধানমন্ডি',
      createdAt: new Date().toISOString(),
    }

    // Process and add registered store branches to Dexie DB
    if (data.branches && data.branches.length > 0) {
      try {
        const branchRecords: Shop[] = data.branches.map((b, idx) => ({
          id: `shop-${Date.now()}-${idx}`,
          name: b.name || `${b.area}, ${b.district}`,
          nameEn: `${b.area}, ${b.district}`,
          address: `${b.area}, ${b.district}`,
          location: `${b.area}, ${b.district}`,
          phone: data.phone?.trim() || '',
          areaType: 'mixed',
          area: b.area,
          ownerName: newUser.fullName,
          updatedAt: new Date().toISOString(),
          deleted: 0,
        }))

        await db.shops.bulkAdd(branchRecords)

        // Select the first branch as current
        if (branchRecords[0]) {
          localStorage.setItem('hb-selected-shop-id', branchRecords[0].id)
          newUser.branches = branchRecords.map(b => ({
            id: b.id,
            name: b.name,
            district: b.address.split(',')[1]?.trim() || '',
            area: b.area || b.address.split(',')[0]?.trim() || '',
          }))
        }
      } catch (err) {
        console.warn('Could not seed branches to IndexedDB:', err)
      }
    }

    const updatedUsers = [...users, newUser]
    saveStoredUsers(updatedUsers)

    const authUser: AuthUser = {
      id: newUser.id,
      username: newUser.username,
      fullName: newUser.fullName,
      shopName: newUser.shopName,
      role: newUser.role,
      phone: newUser.phone,
      address: newUser.address,
      district: newUser.district,
      area: newUser.area,
      branches: newUser.branches,
      createdAt: newUser.createdAt,
    }

    setUser(authUser)
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(authUser))
    return { success: true }
  }

  const updateProfile = async (data: UpdateProfileData): Promise<{ success: boolean; error?: string }> => {
    if (!user) return { success: false, error: 'No user is logged in' }

    try {
      const users = getStoredUsers()
      const idx = users.findIndex((u) => u.id === user.id || u.username.toLowerCase() === user.username.toLowerCase())

      const updatedAuthUser: AuthUser = {
        ...user,
        fullName: data.fullName !== undefined ? data.fullName.trim() : user.fullName,
        shopName: data.shopName !== undefined ? data.shopName.trim() : user.shopName,
        phone: data.phone !== undefined ? data.phone.trim() : user.phone,
        address: data.address !== undefined ? data.address.trim() : user.address,
      }

      if (idx !== -1) {
        users[idx] = {
          ...users[idx],
          fullName: updatedAuthUser.fullName,
          shopName: updatedAuthUser.shopName,
          phone: updatedAuthUser.phone,
          address: updatedAuthUser.address,
          password: data.password && data.password.trim().length >= 4 ? data.password.trim() : users[idx].password,
        }
        saveStoredUsers(users)
      }

      setUser(updatedAuthUser)
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(updatedAuthUser))
      return { success: true }
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to update profile' }
    }
  }

  const logout = () => {
    setUser(null)
    api.clearAuthToken()
    localStorage.removeItem(AUTH_STORAGE_KEY)
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        login,
        register,
        updateProfile,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
