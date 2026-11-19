// App settings: language, theme, shop & area profile, sync status, and system info
import { useState } from 'react'
import {
  Globe,
  Sun,
  Moon,
  Monitor,
  Store,
  RefreshCw,
  Wifi,
  WifiOff,
  CheckCircle2,
  Database,
  Info,
  Send,
  Download,
  Gauge,
  Zap,
} from 'lucide-react'
import { useLang, type Language } from '@/i18n'
import { useTheme } from '@/providers/ThemeProvider'
import { useShopContext } from '@/hooks/useShopContext'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'
import { useOutbox } from '@/db/hooks'
import { usePerfTier } from '@/lib/perf'
import { api } from '@/lib/api'
import { Card, Button, Badge, DemoBadge } from '@/components/ui'
import { db } from '@/db/schema'

export default function Settings() {
  const { t, lang, setLang, formatNum } = useLang()
  const { theme, setTheme } = useTheme()
  const { tier, preference, setPreference, fps } = usePerfTier()
  const { currentShop, shops, selectShopId, isSyncing, setIsSyncing, lastSyncAt, setLastSyncAt } =
    useShopContext()
  const isOnline = useOnlineStatus()
  const outboxEntries = useOutbox() || []

  const [syncMessage, setSyncMessage] = useState<string | null>(null)
  const [syncStatusType, setSyncStatusType] = useState<'success' | 'error' | null>(null)

  // Push Sync handler
  const handlePushSync = async () => {
    if (!isOnline) {
      setSyncMessage(
        lang === 'bn' ? 'ইন্টারনেট সংযোগ নেই। অনলাইন হলে পুনরায় চেষ্টা করুন।' : 'No internet connection.'
      )
      setSyncStatusType('error')
      return
    }

    try {
      setIsSyncing(true)
      setSyncMessage(lang === 'bn' ? 'সার্ভারে পরিবর্তন পাঠানো হচ্ছে...' : 'Pushing changes to server...')
      setSyncStatusType(null)

      const entries = await db.outbox.toArray()
      if (entries.length === 0) {
        setSyncMessage(lang === 'bn' ? 'পাঠানোর মতো কোনো পরিবর্তন নেই।' : 'No local changes pending.')
        setSyncStatusType('success')
        setIsSyncing(false)
        return
      }

      await api.syncPush(entries)
      // Clear outbox after successful push
      await db.outbox.clear()

      const now = new Date()
      setLastSyncAt(now)
      localStorage.setItem('hb-last-sync', now.toISOString())

      setSyncMessage(
        lang === 'bn'
          ? `সফলভাবে ${formatNum(entries.length)} টি পরিবর্তন সিঙ্ক হয়েছে!`
          : `Successfully pushed ${entries.length} changes!`
      )
      setSyncStatusType('success')
    } catch (err: any) {
      setSyncMessage(
        lang === 'bn'
          ? 'সিঙ্ক ব্যর্থ হয়েছে: সার্ভারে সংযোগ করা সম্ভব হয়নি।'
          : `Sync failed: Could not reach backend.`
      )
      setSyncStatusType('error')
    } finally {
      setIsSyncing(false)
    }
  }

  // Pull Sync handler
  const handlePullSync = async () => {
    if (!isOnline) {
      setSyncMessage(
        lang === 'bn' ? 'ইন্টারনেট সংযোগ নেই।' : 'No internet connection.'
      )
      setSyncStatusType('error')
      return
    }

    try {
      setIsSyncing(true)
      setSyncMessage(lang === 'bn' ? 'সার্ভার থেকে ডেটা নেওয়া হচ্ছে...' : 'Pulling data from server...')
      setSyncStatusType(null)

      const since = lastSyncAt ? lastSyncAt.toISOString() : '2020-01-01T00:00:00Z'
      const res = await api.syncPull(since)

      const now = new Date()
      setLastSyncAt(now)
      localStorage.setItem('hb-last-sync', now.toISOString())

      setSyncMessage(
        lang === 'bn'
          ? `সার্ভার আপডেট সম্পন্ন। সার্ভার সময়: ${res.serverTime || 'OK'}`
          : `Pull complete. Server time: ${res.serverTime || 'OK'}`
      )
      setSyncStatusType('success')
    } catch (err: any) {
      setSyncMessage(
        lang === 'bn'
          ? 'সার্ভার থেকে ডেটা টানতে ব্যর্থ হয়েছে (সার্ভার অফলাইন থাকতে পারে)।'
          : 'Failed to pull from server (API might be offline).'
      )
      setSyncStatusType('error')
    } finally {
      setIsSyncing(false)
    }
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Title */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold text-brand-brown dark:text-brand-cream">
              {t.settings.shopProfile || (lang === 'bn' ? 'সেটিংস' : 'Settings')}
            </h1>
          </div>
          <p className="text-sm text-brand-brown/70 dark:text-brand-cream/70 mt-1">
            {lang === 'bn'
              ? 'অ্যাপের ভাষা, থিম, দোকানের প্রোফাইল ও সিঙ্ক্রোনাইজেশন কনফিগারেশন'
              : 'Preferences, store profile, and offline sync management'}
          </p>
        </div>
      </div>

      {/* 1. Language Preferences */}
      <Card className="p-5 space-y-4">
        <div className="flex items-center gap-2.5">
          <Globe className="w-5 h-5 text-brand-orange" />
          <div>
            <h3 className="font-bold text-base text-brand-brown dark:text-brand-cream">
              {t.settings.language} / Language
            </h3>
            <p className="text-xs text-brand-brown/60 dark:text-brand-cream/60">
              {lang === 'bn' ? 'তাত্ক্ষণিকভাবে সম্পূর্ণ ইন্টারফেসের ভাষা পরিবর্তন করুন' : 'Switch app language instantly with no refresh'}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 pt-1 max-w-sm">
          <button
            type="button"
            onClick={() => setLang('bn')}
            className={`py-3 px-4 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all ${
              lang === 'bn'
                ? 'bg-brand-yellow text-brand-brown shadow-sm ring-2 ring-brand-orange'
                : 'bg-white dark:bg-[#1f130a] border border-[#F0D080]/60 text-brand-brown dark:text-brand-cream hover:bg-brand-cream/30'
            }`}
          >
            <span>বাংলা (Bangla)</span>
          </button>

          <button
            type="button"
            onClick={() => setLang('en')}
            className={`py-3 px-4 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all ${
              lang === 'en'
                ? 'bg-brand-yellow text-brand-brown shadow-sm ring-2 ring-brand-orange'
                : 'bg-white dark:bg-[#1f130a] border border-[#F0D080]/60 text-brand-brown dark:text-brand-cream hover:bg-brand-cream/30'
            }`}
          >
            <span>English</span>
          </button>
        </div>
      </Card>

      {/* 2. Theme Preferences */}
      <Card className="p-5 space-y-4">
        <div className="flex items-center gap-2.5">
          <Sun className="w-5 h-5 text-brand-orange" />
          <div>
            <h3 className="font-bold text-base text-brand-brown dark:text-brand-cream">
              {t.settings.theme}
            </h3>
            <p className="text-xs text-brand-brown/60 dark:text-brand-cream/60">
              {lang === 'bn' ? 'আলো ও অন্ধকার থিম পছন্দ নির্ধারণ করুন' : 'Select appearance mode for daytime or night use'}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 pt-1 max-w-md">
          {[
            { id: 'light', label: t.settings.light, icon: Sun },
            { id: 'dark', label: t.settings.dark, icon: Moon },
            { id: 'system', label: t.settings.system, icon: Monitor },
          ].map((mode) => {
            const Icon = mode.icon
            const isSelected = theme === mode.id
            return (
              <button
                key={mode.id}
                type="button"
                onClick={() => setTheme(mode.id as any)}
                className={`py-3 px-3 rounded-xl text-xs font-bold flex flex-col items-center justify-center gap-1.5 transition-all ${
                  isSelected
                    ? 'bg-brand-yellow text-brand-brown shadow-sm ring-2 ring-brand-orange'
                    : 'bg-white dark:bg-[#1f130a] border border-[#F0D080]/60 text-brand-brown dark:text-brand-cream hover:bg-brand-cream/30'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{mode.label}</span>
              </button>
            )
          })}
        </div>
      </Card>

      {/* 2b. Animation & Performance Preferences */}
      <Card className="p-5 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <Gauge className="w-5 h-5 text-brand-orange" />
            <div>
              <h3 className="font-bold text-base text-brand-brown dark:text-brand-cream">
                {lang === 'bn' ? 'অ্যানিমেশন ও পারফরম্যান্স' : 'Animation & Performance'}
              </h3>
              <p className="text-xs text-brand-brown/60 dark:text-brand-cream/60">
                {lang === 'bn'
                  ? 'দুর্বল ডিভাইসে স্বয়ংক্রিয়ভাবে অ্যানিমেশন কমিয়ে মসৃণ স্ক্রোলিং নিশ্চিত করা হয়'
                  : 'Optimize animation intensity and frame rate for low-spec devices'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-brand-orange border border-amber-200">
              {fps} FPS
            </span>
            <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-brand-yellow/30 text-brand-brown border border-brand-yellow/50 capitalize">
              {tier === 'high' ? (lang === 'bn' ? 'উচ্চ গতি' : 'High') : tier === 'medium' ? (lang === 'bn' ? 'মাঝারি' : 'Medium') : (lang === 'bn' ? 'সাশ্রয়ী' : 'Low')}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 pt-1 max-w-md">
          {[
            { id: 'auto', label: lang === 'bn' ? 'স্বয়ংক্রিয়' : 'Auto', desc: lang === 'bn' ? 'ডিভাইস গতি দেখে' : 'Adaptive' },
            { id: 'reduced', label: lang === 'bn' ? 'কম' : 'Reduced', desc: lang === 'bn' ? 'হালকা অ্যানিমেশন' : 'Lite' },
            { id: 'off', label: lang === 'bn' ? 'বন্ধ' : 'Off', desc: lang === 'bn' ? 'স্থির মোড' : 'Static' },
          ].map((mode) => {
            const isSelected = preference === mode.id
            return (
              <button
                key={mode.id}
                type="button"
                onClick={() => setPreference(mode.id as any)}
                className={`py-3 px-3 rounded-xl text-xs font-bold flex flex-col items-center justify-center gap-1 transition-all ${
                  isSelected
                    ? 'bg-brand-yellow text-brand-brown shadow-sm ring-2 ring-brand-orange'
                    : 'bg-white border border-[#F0D080]/60 text-brand-brown hover:bg-brand-cream/30'
                }`}
              >
                <Zap className={`w-4 h-4 ${isSelected ? 'text-brand-brown' : 'text-brand-orange'}`} />
                <span>{mode.label}</span>
                <span className="text-[10px] font-normal opacity-75">{mode.desc}</span>
              </button>
            )
          })}
        </div>
      </Card>

      {/* 3. Shop & Area Profile */}
      <Card className="p-5 space-y-4">
        <div className="flex items-center gap-2.5">
          <Store className="w-5 h-5 text-brand-orange" />
          <div>
            <h3 className="font-bold text-base text-brand-brown dark:text-brand-cream">
              {t.settings.shopProfile}
            </h3>
            <p className="text-xs text-brand-brown/60 dark:text-brand-cream/60">
              {lang === 'bn' ? 'বর্তমান সক্রিয় দোকান ও এলাকার তথ্য' : 'Active shop profile and area configuration'}
            </p>
          </div>
        </div>

        <div className="space-y-3 pt-1">
          <div>
            <label className="block text-xs font-bold text-brand-brown dark:text-brand-cream mb-1">
              {lang === 'bn' ? 'দোকান নির্বাচন করুন' : 'Select Active Shop'}
            </label>
            <select
              value={currentShop?.id || ''}
              onChange={(e) => selectShopId(e.target.value)}
              className="w-full sm:w-80 px-3 py-2.5 rounded-xl border border-[#F0D080] dark:border-[#4D2A00] bg-white dark:bg-[#1a0f07] text-sm text-brand-brown dark:text-brand-cream focus:ring-2 focus:ring-brand-yellow font-medium"
            >
              {shops.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({t.areaTypes[s.areaType as keyof typeof t.areaTypes] || s.areaType})
                </option>
              ))}
            </select>
          </div>

          {currentShop && (
            <div className="p-3.5 rounded-xl bg-brand-cream/30 dark:bg-[#1f130a] border border-[#F0D080]/40 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-brand-brown/60 dark:text-brand-cream/60 block">
                  {lang === 'bn' ? 'দোকানের নাম:' : 'Shop Name:'}
                </span>
                <strong className="text-brand-brown dark:text-brand-cream text-sm">
                  {currentShop.name}
                </strong>
              </div>
              <div>
                <span className="text-brand-brown/60 dark:text-brand-cream/60 block">
                  {t.purchase.areaType}:
                </span>
                <strong className="text-brand-orange text-sm">
                  {t.areaTypes[currentShop.areaType as keyof typeof t.areaTypes] || currentShop.areaType}
                </strong>
              </div>
              <div className="col-span-2">
                <span className="text-brand-brown/60 dark:text-brand-cream/60 block">
                  {lang === 'bn' ? 'অবস্থান:' : 'Location:'}
                </span>
                <span className="text-brand-brown dark:text-brand-cream">
                  {currentShop.location || (currentShop as any).address || 'ঢাকা, বাংলাদেশ'}
                </span>
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* 4. Sync Status & Outbox */}
      <Card className="p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <RefreshCw className={`w-5 h-5 text-brand-orange ${isSyncing ? 'animate-spin' : ''}`} />
            <div>
              <h3 className="font-bold text-base text-brand-brown dark:text-brand-cream">
                {t.settings.syncStatus}
              </h3>
              <p className="text-xs text-brand-brown/60 dark:text-brand-cream/60">
                {lang === 'bn'
                  ? 'অফলাইন আউটবক্স ও ক্লাউড সিঙ্ক নিয়ন্ত্রণ'
                  : 'Manage offline queue and cloud synchronization'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isOnline ? (
              <Badge variant="success" className="flex items-center gap-1 text-xs">
                <Wifi className="w-3.5 h-3.5" />
                <span>{t.dashboard.online}</span>
              </Badge>
            ) : (
              <Badge variant="danger" className="flex items-center gap-1 text-xs">
                <WifiOff className="w-3.5 h-3.5" />
                <span>{t.dashboard.offline}</span>
              </Badge>
            )}
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-brand-cream/20 dark:bg-[#1a0f07] border border-[#F0D080]/30 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-brand-brown/70 dark:text-brand-cream/70">
              {lang === 'bn' ? 'আউটবক্সে অপেক্ষমান পরিবর্তন:' : 'Pending Outbox Changes:'}
            </span>
            <span className="font-bold text-brand-brown dark:text-brand-cream">
              {formatNum(outboxEntries.length)} {lang === 'bn' ? 'টি' : 'records'}
            </span>
          </div>

          <div className="flex items-center justify-between text-xs">
            <span className="text-brand-brown/70 dark:text-brand-cream/70">
              {t.settings.lastSynced}:
            </span>
            <span className="text-brand-brown/80 dark:text-brand-cream/80 font-medium">
              {lastSyncAt ? lastSyncAt.toLocaleTimeString() : lang === 'bn' ? 'এখনও সিঙ্ক হয়নি' : 'Never'}
            </span>
          </div>
        </div>

        {syncMessage && (
          <div
            className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
              syncStatusType === 'success'
                ? 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-200'
                : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200'
            }`}
          >
            <Info className="w-4 h-4 flex-shrink-0" />
            <span>{syncMessage}</span>
          </div>
        )}

        <div className="flex items-center gap-3 pt-2">
          <Button
            onClick={handlePushSync}
            disabled={isSyncing}
            className="flex-1 bg-brand-yellow hover:bg-brand-orange text-brand-brown font-bold text-xs flex items-center justify-center gap-2 py-2.5 rounded-xl shadow-sm"
          >
            <Send className="w-4 h-4" />
            <span>{t.settings.pushSync}</span>
          </Button>

          <Button
            variant="outline"
            onClick={handlePullSync}
            disabled={isSyncing}
            className="flex-1 text-xs font-bold flex items-center justify-center gap-2 py-2.5 rounded-xl"
          >
            <Download className="w-4 h-4" />
            <span>{t.settings.pullSync}</span>
          </Button>
        </div>
      </Card>

      {/* 5. About Haalkhata */}
      <Card className="p-5 space-y-3 text-xs text-brand-brown/75 dark:text-brand-cream/75">
        <div className="flex items-center gap-3">
          <img src="/logo.png" alt="হালখাতা" className="w-12 h-12 object-contain" />
          <div>
            <h4 className="font-bold text-base text-brand-brown dark:text-brand-cream">
              {lang === 'bn' ? 'হালখাতা (Haalkhata) পরিচিতি' : 'About Haalkhata'}
            </h4>
            <p className="text-sm font-semibold text-brand-orange dark:text-amber-400">
              {lang === 'bn'
                ? 'হালখাতা (Haalkhata) — স্মার্ট মুদিখানা ও ইনভেন্টরি ম্যানেজমেন্ট সিস্টেম'
                : 'Haalkhata — Smart Grocery Inventory & Supply-Chain Management System'}
            </p>
          </div>
        </div>
        <p className="leading-relaxed">
          {lang === 'bn'
            ? 'হালখাতা হলো আধুনিক মুদি দোকান ও রিটেইল চেইনের জন্য ডিজাইন করা একটি অফলাইন-ফার্স্ট বিজনেস ম্যানেজমেন্ট ও বাকির হিসাব সিস্টেম। এটি এসএমএস রিমাইন্ডার, ডিস্ট্রিবিউটর কানেকশন, এলাকার দোকান নেটওয়ার্ক, ব্যাচ কোড ও বারকোড ট্র্যাকিং, স্মার্ট এক্সপায়ারি ক্লিয়ারেন্স এবং ডায়নামিক ডিসকাউন্ট অ্যালগরিদমের মাধ্যমে অপচয় রোধ ও মুনাফা বৃদ্ধিতে সহায়তা করে।'
            : 'Haalkhata is an intelligent offline-first grocery ERP and ledger management platform. It streamlines daily store operations with automated customer SMS reminders, distributor ordering connector, peer shop network for overstock/emergency exchanges, barcode batch expiry risk mitigation, and dynamic clearance discounts.'}
        </p>
      </Card>
    </div>
  )
}

