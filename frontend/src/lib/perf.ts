// Hardware capability detection & runtime FPS performance monitoring
// Supports: 'high' | 'medium' | 'low' tiers with automatic FPS throttling

import { useState, useEffect, useSyncExternalStore } from 'react'

export type PerfTier = 'high' | 'medium' | 'low'
export type AnimationPreference = 'auto' | 'reduced' | 'off'

const PREF_STORAGE_KEY = 'hb_anim_preference'

function detectInitialTier(): PerfTier {
  if (typeof window === 'undefined') return 'medium'

  // 1. Reduced motion check
  const prefersReduced = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches
  if (prefersReduced) return 'low'

  // 2. Save-Data mode check
  const nav = navigator as any
  if (nav.connection?.saveData) return 'low'

  // 3. Hardware concurrency & device memory
  const cores = nav.hardwareConcurrency || 4
  const memory = nav.deviceMemory || 4 // In GB (Chrome only, undefined in Safari/Firefox)

  // Low tier rule: cores <= 4 or device memory <= 2GB
  if (cores <= 4 || memory <= 2) {
    return 'low'
  }

  // Medium tier: cores <= 6 or memory <= 4GB
  if (cores <= 6 || memory <= 4) {
    return 'medium'
  }

  return 'high'
}

class PerfMonitor {
  private initialTier: PerfTier = detectInitialTier()
  private currentTier: PerfTier = this.initialTier
  private preference: AnimationPreference = 'auto'
  private currentFps: number = 60
  private listeners = new Set<() => void>()
  private animFrameId: number | null = null
  private isMonitoring: boolean = false

  // Cached stable snapshot reference for React's useSyncExternalStore
  private cachedSnapshot = {
    tier: this.currentTier,
    preference: this.preference,
    fps: this.currentFps,
    canAnimate: true,
    shelfRows: this.currentTier === 'high' ? 3 : 1,
    isStaticShelf: this.currentTier === 'low',
    setPreference: (pref: AnimationPreference) => this.setPreference(pref),
  }

  // FPS calculation variables
  private frameCount: number = 0
  private lastTime: number = 0
  private windowStartTime: number = 0

  constructor() {
    this.updateSnapshot()

    if (typeof window !== 'undefined') {
      // Load saved user preference
      try {
        const saved = localStorage.getItem(PREF_STORAGE_KEY) as AnimationPreference | null
        if (saved && (saved === 'auto' || saved === 'reduced' || saved === 'off')) {
          this.preference = saved
        }
      } catch {
        // ignore storage errors
      }

      this.applyPreferenceToTier()
      this.updateSnapshot()

      // Start FPS monitor if preference allows
      if (this.preference === 'auto') {
        this.startFpsMonitoring()
      }

      // Pause monitoring when tab is hidden
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
          this.stopFpsMonitoring()
        } else if (this.preference === 'auto') {
          this.startFpsMonitoring()
        }
      })
    }
  }

  private updateSnapshot() {
    const prefersReduced =
      typeof window !== 'undefined'
        ? window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches
        : false

    const canAnimate = this.preference !== 'off' && !prefersReduced

    this.cachedSnapshot = {
      tier: this.currentTier,
      preference: this.preference,
      fps: this.currentFps,
      canAnimate,
      shelfRows: this.currentTier === 'high' ? 3 : 1,
      isStaticShelf: this.currentTier === 'low' || this.preference === 'off',
      setPreference: (pref: AnimationPreference) => this.setPreference(pref),
    }
  }

  private applyPreferenceToTier() {
    if (this.preference === 'off') {
      this.currentTier = 'low'
    } else if (this.preference === 'reduced') {
      this.currentTier = 'medium'
    } else {
      // 'auto': preserve current calculated tier
      if (this.currentTier === 'low' && this.initialTier !== 'low') {
        // keep downgraded tier if already measured
      } else {
        this.currentTier = this.initialTier
      }
    }
  }

  public getSnapshot = () => {
    return this.cachedSnapshot
  }

  public subscribe = (listener: () => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private notify() {
    this.updateSnapshot()
    this.listeners.forEach((l) => l())
  }

  public setPreference(pref: AnimationPreference) {
    this.preference = pref
    try {
      localStorage.setItem(PREF_STORAGE_KEY, pref)
    } catch {
      // ignore
    }

    this.applyPreferenceToTier()
    this.updateSnapshot()

    if (pref === 'auto') {
      this.startFpsMonitoring()
    } else {
      this.stopFpsMonitoring()
    }

    this.notify()
  }

  private startFpsMonitoring() {
    if (this.isMonitoring || typeof window === 'undefined') return
    this.isMonitoring = true
    this.frameCount = 0
    this.lastTime = performance.now()
    this.windowStartTime = this.lastTime

    const loop = (now: number) => {
      if (!this.isMonitoring) return

      this.frameCount++
      const elapsed = now - this.windowStartTime

      // Measure average FPS over 2 seconds (2000ms)
      if (elapsed >= 2000) {
        const measuredFps = Math.round((this.frameCount * 1000) / elapsed)
        this.currentFps = measuredFps
        this.frameCount = 0
        this.windowStartTime = now

        // Downgrade rule: If average FPS < 45, downgrade tier by 1 step (high -> medium -> low)
        // Never automatically upgrade back up to avoid flickering (ঝিকিমিকি এড়াতে)
        if (this.preference === 'auto' && measuredFps < 45) {
          if (this.currentTier === 'high') {
            this.currentTier = 'medium'
            this.notify()
          } else if (this.currentTier === 'medium') {
            this.currentTier = 'low'
            this.notify()
          }
        }
      }

      this.animFrameId = requestAnimationFrame(loop)
    }

    this.animFrameId = requestAnimationFrame(loop)
  }

  private stopFpsMonitoring() {
    this.isMonitoring = false
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId)
      this.animFrameId = null
    }
  }
}

export const perfMonitor = new PerfMonitor()

export function usePerfTier() {
  return useSyncExternalStore(perfMonitor.subscribe, perfMonitor.getSnapshot, perfMonitor.getSnapshot)
}
