import { describe, it, expect, beforeEach } from 'vitest'
import type { AuthUser, AuthBranch } from '@/types'

describe('Branch Authorization & Reconciliation Rules', () => {
  // Mock localStorage for test environment
  let storage: Record<string, string> = {}

  beforeEach(() => {
    storage = {}
  })

  const mockGetItem = (key: string) => storage[key] || null
  const mockSetItem = (key: string, val: string) => {
    storage[key] = val
  }

  // Pure branch reconciliation logic mirror from useShopContext & AuthContext
  function reconcileSelectedBranch(
    user: AuthUser | null,
    currentShopId: string,
    setItem: (k: string, v: string) => void
  ): string {
    if (user?.branches && user.branches.length > 0) {
      const authorizedIds = user.branches.map((b) => b.outlet_id || b.id)
      if (!authorizedIds.includes(currentShopId)) {
        const primary = user.branches.find((b) => b.is_primary) || user.branches[0]
        const targetId = primary ? (primary.outlet_id || primary.id) : authorizedIds[0]
        setItem('hb-selected-shop-id', targetId)
        return targetId
      }
      return currentShopId
    }
    return currentShopId || 'shop-student-01'
  }

  // Pure branch switching validator mirror from useShopContext
  function canSelectBranch(user: AuthUser | null, newBranchId: string): boolean {
    if (!newBranchId) return false
    if (user?.branches && user.branches.length > 0) {
      const authorizedIds = user.branches.map((b) => b.outlet_id || b.id)
      return authorizedIds.includes(newBranchId)
    }
    return true
  }

  // Pure assistant outlet ID resolver mirror from Assistant.tsx
  function resolveAssistantOutletId(
    user: AuthUser | null,
    currentSelectedShopId: string
  ): { targetOutletId?: string; isBlocked: boolean; blockReason?: string } {
    if (user && Array.isArray(user.branches) && user.branches.length === 0) {
      return {
        isBlocked: true,
        blockReason: 'আপনার অ্যাকাউন্টের সাথে কোনো অনুমোদিত শাখা সংযুক্ত নেই।',
      }
    }

    if (user?.branches && user.branches.length > 0) {
      const authorizedIds = user.branches.map((b) => b.outlet_id || b.id)
      if (authorizedIds.includes(currentSelectedShopId)) {
        return { targetOutletId: currentSelectedShopId, isBlocked: false }
      }
      // Stale or invalid ID auto-corrects to primary
      const primary = user.branches.find((b) => b.is_primary) || user.branches[0]
      const targetId = primary ? (primary.outlet_id || primary.id) : authorizedIds[0]
      return { targetOutletId: targetId, isBlocked: false }
    }

    return { targetOutletId: currentSelectedShopId, isBlocked: false }
  }

  it('replaces stale unauthorized OUT002 with primary branch OUT-DEMO-OWNER after login', () => {
    const ownerUser: AuthUser = {
      id: 'user-owner',
      username: 'owner',
      fullName: 'Shop Owner',
      branches: [
        {
          id: 'OUT-DEMO-OWNER',
          outlet_id: 'OUT-DEMO-OWNER',
          name: 'হালখাতা জেনারেল স্টোর',
          is_primary: true,
        },
      ],
    }

    const staleShopId = 'OUT002'
    const reconciled = reconcileSelectedBranch(ownerUser, staleShopId, mockSetItem)

    expect(reconciled).toBe('OUT-DEMO-OWNER')
    expect(mockGetItem('hb-selected-shop-id')).toBe('OUT-DEMO-OWNER')
  })

  it('preserves authorized branch when already selected', () => {
    const ownerUser: AuthUser = {
      id: 'user-owner',
      username: 'owner',
      branches: [
        {
          id: 'OUT-DEMO-OWNER',
          outlet_id: 'OUT-DEMO-OWNER',
          name: 'হালখাতা জেনারেল স্টোর',
          is_primary: true,
        },
      ],
    }

    const selectedShopId = 'OUT-DEMO-OWNER'
    const reconciled = reconcileSelectedBranch(ownerUser, selectedShopId, mockSetItem)

    expect(reconciled).toBe('OUT-DEMO-OWNER')
  })

  it('rejects attempt to select unauthorized branch OUT002 or OUT001', () => {
    const ownerUser: AuthUser = {
      id: 'user-owner',
      username: 'owner',
      branches: [
        {
          id: 'OUT-DEMO-OWNER',
          outlet_id: 'OUT-DEMO-OWNER',
          name: 'হালখাতা জেনারেল স্টোর',
          is_primary: true,
        },
      ],
    }

    expect(canSelectBranch(ownerUser, 'OUT002')).toBe(false)
    expect(canSelectBranch(ownerUser, 'OUT001')).toBe(false)
    expect(canSelectBranch(ownerUser, 'shop-affluent-01')).toBe(false)
    expect(canSelectBranch(ownerUser, 'OUT-DEMO-OWNER')).toBe(true)
  })

  it('allows switching between legitimate authorized branches', () => {
    const multiBranchUser: AuthUser = {
      id: 'user-multi',
      username: 'multiowner',
      branches: [
        {
          id: 'OUT-BRANCH-A',
          outlet_id: 'OUT-BRANCH-A',
          name: 'ধানমন্ডি শাখা',
          is_primary: true,
        },
        {
          id: 'OUT-BRANCH-B',
          outlet_id: 'OUT-BRANCH-B',
          name: 'মিরপুর শাখা',
          is_primary: false,
        },
      ],
    }

    expect(canSelectBranch(multiBranchUser, 'OUT-BRANCH-A')).toBe(true)
    expect(canSelectBranch(multiBranchUser, 'OUT-BRANCH-B')).toBe(true)
    expect(canSelectBranch(multiBranchUser, 'OUT-BRANCH-UNAUTHORIZED')).toBe(false)
  })

  it('blocks assistant request and displays administrator guidance when user has zero authorized branches', () => {
    const userWithoutBranches: AuthUser = {
      id: 'user-new',
      username: 'nobranches',
      branches: [],
    }

    const result = resolveAssistantOutletId(userWithoutBranches, 'OUT002')
    expect(result.isBlocked).toBe(true)
    expect(result.targetOutletId).toBeUndefined()
    expect(result.blockReason).toContain('অনুমোদিত শাখা সংযুক্ত নেই')
  })

  it('auto-corrects stale outlet ID before sending assistant request', () => {
    const ownerUser: AuthUser = {
      id: 'user-owner',
      username: 'owner',
      branches: [
        {
          id: 'OUT-DEMO-OWNER',
          outlet_id: 'OUT-DEMO-OWNER',
          name: 'হালখাতা জেনারেল স্টোর',
          is_primary: true,
        },
      ],
    }

    // Even if currentShop was stale 'shop-affluent-01' or 'OUT002', assistant resolves to 'OUT-DEMO-OWNER'
    const result = resolveAssistantOutletId(ownerUser, 'OUT002')
    expect(result.isBlocked).toBe(false)
    expect(result.targetOutletId).toBe('OUT-DEMO-OWNER')

    const resultFromMock = resolveAssistantOutletId(ownerUser, 'shop-affluent-01')
    expect(resultFromMock.isBlocked).toBe(false)
    expect(resultFromMock.targetOutletId).toBe('OUT-DEMO-OWNER')
  })
})
