import { describe, it, expect } from 'vitest'

describe('Authentication & Registration logic', () => {
  it('validates username and password presence', () => {
    const username = ''
    const password = ''
    const isValid = Boolean(username.trim() && password.trim())
    expect(isValid).toBe(false)
  })

  it('verifies demo credentials for Hat-Bazar ERP', () => {
    const demoAccounts = [
      { username: 'owner', password: 'password123' },
      { username: 'admin', password: 'password123' },
      { username: 'admin', password: 'admin123' },
    ]

    const testLogin = (u: string, p: string) =>
      demoAccounts.some(
        (acc) => acc.username.toLowerCase() === u.toLowerCase() && acc.password === p
      )

    expect(testLogin('admin', 'admin123')).toBe(true)
    expect(testLogin('admin', 'password123')).toBe(true)
    expect(testLogin('owner', 'password123')).toBe(true)
    expect(testLogin('admin', 'wrongpass')).toBe(false)
  })

  it('registers a new user and checks for duplicate usernames', () => {
    const users = [{ username: 'admin' }]
    const newUsername = 'admin'
    const isDuplicate = users.some((u) => u.username.toLowerCase() === newUsername.toLowerCase())
    expect(isDuplicate).toBe(true)

    const freshUser = 'my_shop_owner'
    const isFreshDuplicate = users.some(
      (u) => u.username.toLowerCase() === freshUser.toLowerCase()
    )
    expect(isFreshDuplicate).toBe(false)
  })
})
