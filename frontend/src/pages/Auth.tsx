import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ShoppingBag,
  User,
  Lock,
  Eye,
  EyeOff,
  Store,
  AlertCircle,
  CheckCircle2,
  ArrowRight,
  Sun,
  Moon,
  Sparkles,
  TrendingUp,
  Package,
  ShieldCheck,
  UserCheck,
  UserPlus,
  MapPin,
  Plus,
  Trash2,
} from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { useLang } from '@/i18n'
import { useTheme } from '@/providers/ThemeProvider'
import { cn } from '@/lib/utils'
import { CrateAnimation } from '@/components/motion'

const BD_DISTRICTS = [
  'ঢাকা (Dhaka)',
  'চট্টগ্রাম (Chattogram)',
  'রাজশাহী (Rajshahi)',
  'খুলনা (Khulna)',
  'সিলেট (Sylhet)',
  'বরিশাল (Barishal)',
  'রংপুর (Rangpur)',
  'ময়মনসিংহ (Mymensingh)',
  'কুমিল্লা (Cumilla)',
  'গাজীপুর (Gazipur)',
  'নারায়ণগঞ্জ (Narayanganj)',
  'বগুড়া (Bogura)',
  'দিনাজপুর (Dinajpur)',
  'যশোর (Jashore)',
  'কক্সবাজার (Cox\'s Bazar)',
  'টাঙ্গাইল (Tangail)',
]

export default function AuthPage() {
  const { login, register } = useAuth()
  const { t, lang, setLang } = useLang()
  const { isDark, setTheme } = useTheme()
  const navigate = useNavigate()

  const [mode, setMode] = useState<'login' | 'register'>('login')

  // Form states: User ID and User Password
  const [userId, setUserId] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [shopName, setShopName] = useState('')

  // District & Branch location states (User Request #2)
  const [primaryDistrict, setPrimaryDistrict] = useState('ঢাকা (Dhaka)')
  const [primaryArea, setPrimaryArea] = useState('ধানমন্ডি ৯/এ')
  const [extraBranches, setExtraBranches] = useState<Array<{ name: string; district: string; area: string }>>([])

  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault()
    setErrorMessage(null)
    setSuccessMessage(null)

    if (!userId.trim() || !password.trim()) {
      setErrorMessage(
        lang === 'bn'
          ? 'ইউজার আইডি এবং পাসওয়ার্ড উভয়ই প্রদান করুন।'
          : 'Please enter both User ID and Password.'
      )
      return
    }

    setIsSubmitting(true)
    try {
      const res = await login(userId, password)
      if (res.success) {
        setSuccessMessage(
          lang === 'bn'
            ? 'লগইন সফল হয়েছে! ড্যাশবোর্ডে নিয়ে যাওয়া হচ্ছে...'
            : 'Login successful! Redirecting to ERP dashboard...'
        )
        setTimeout(() => {
          navigate('/', { replace: true })
        }, 350)
      } else {
        setErrorMessage(
          res.error ||
            (lang === 'bn'
              ? 'ভুল ইউজার আইডি অথবা পাসওয়ার্ড।'
              : 'Invalid User ID or Password. Please try again.')
        )
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Login failed')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleRegister = async (e: FormEvent) => {
    e.preventDefault()
    setErrorMessage(null)
    setSuccessMessage(null)

    if (!userId.trim() || !password.trim()) {
      setErrorMessage(
        lang === 'bn'
          ? 'ইউজার আইডি এবং পাসওয়ার্ড উভয়ই প্রদান করুন।'
          : 'Please enter both User ID and Password.'
      )
      return
    }

    if (password !== confirmPassword) {
      setErrorMessage(t.auth.passwordMismatch)
      return
    }

    if (password.length < 4) {
      setErrorMessage(t.auth.passwordTooShort)
      return
    }

    setIsSubmitting(true)
    try {
      const primaryBranch = {
        name: shopName.trim() || `${primaryArea}, ${primaryDistrict}`,
        district: primaryDistrict,
        area: primaryArea.trim() || 'প্রধান শাখা',
      }
      const validExtra = extraBranches.filter((b) => b.area.trim())
      const allBranches = [primaryBranch, ...validExtra]

      const res = await register({
        username: userId,
        password,
        fullName: fullName.trim() || undefined,
        shopName: primaryBranch.name,
        district: primaryDistrict,
        area: primaryArea,
        branches: allBranches,
      })
      if (res.success) {
        setSuccessMessage(
          lang === 'bn'
            ? 'অ্যাকাউন্ট ও শাখাসমূহ সফলভাবে নিবন্ধিত হয়েছে! ড্যাশবোর্ডে প্রবেশ করা হচ্ছে...'
            : 'Account & store branches registered successfully! Redirecting...'
        )
        setTimeout(() => {
          navigate('/', { replace: true })
        }, 350)
      } else {
        setErrorMessage(res.error || 'Registration failed')
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Registration failed')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen w-full flex flex-col justify-between bg-background text-text transition-colors duration-150">
      {/* Top Header Bar */}
      <header className="w-full max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-2xl bg-accent flex items-center justify-center text-[#493522] shadow-sm">
            <ShoppingBag className="w-5 h-5" />
          </div>
          <div>
            <span className="font-extrabold text-lg tracking-tight text-text block leading-tight">
              Hat-Bazar ERP
            </span>
            <span className="text-xs font-semibold text-accent block">
              Smart Grocery
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Language Toggle */}
          <div className="flex items-center rounded-xl border border-border bg-card p-0.5 shadow-sm">
            {(['bn', 'en'] as const).map((l) => (
              <button
                key={l}
                type="button"
                onClick={() => setLang(l)}
                className={cn(
                  'px-2.5 py-1 text-xs font-bold rounded-lg transition-all',
                  lang === l
                    ? 'bg-accent text-[#493522] shadow-sm'
                    : 'text-text-secondary hover:bg-background-secondary'
                )}
              >
                {l === 'bn' ? 'বাংলা' : 'EN'}
              </button>
            ))}
          </div>

          {/* Theme Toggle */}
          <button
            type="button"
            onClick={() => setTheme(isDark ? 'light' : 'dark')}
            aria-label="Toggle Theme"
            className="w-9 h-9 rounded-xl border border-border bg-card flex items-center justify-center text-text hover:bg-background-secondary transition-colors shadow-sm"
          >
            {isDark ? <Sun className="w-4 h-4 text-amber-300" /> : <Moon className="w-4 h-4 text-text" />}
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-4 sm:py-8">
        <div className="w-full max-w-md sm:max-w-lg">
          {/* Required Titles */}
          <div className="text-center mb-5 sm:mb-6">
            <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-amber-100/90 dark:bg-amber-950/70 border border-amber-300/80 dark:border-amber-800/80 text-brand-brown dark:text-amber-300 text-xs font-bold mb-2.5 shadow-sm">
              <Sparkles className="w-3.5 h-3.5 text-brand-orange animate-pulse" />
              <span>Smart Grocery Management System</span>
            </div>

            {/* Title track */}
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight text-text">
              Hat-Bazar ERP
            </h1>

            {/* Secondary title line */}
            <p className="mt-2 text-sm sm:text-base md:text-lg font-semibold text-accent max-w-md mx-auto leading-relaxed">
              An Enterprise Resource Planning system for smart Grocery
            </p>

            {/* Smart Grocery Flow Crate Animation */}
            <div className="mt-3">
              <CrateAnimation />
            </div>
          </div>

          {/* Authentication Card */}
          <div className="bg-card rounded-3xl border border-border shadow-card p-5 sm:p-7">
            {/* 2-Mode Selector: Log In (Shop Owner) | Account Registration */}
            <div className="grid grid-cols-2 p-1 rounded-2xl bg-amber-50 dark:bg-black/40 border border-amber-200/60 dark:border-amber-900/40 mb-5 gap-1">
              <button
                type="button"
                onClick={() => {
                  setMode('login')
                  setErrorMessage(null)
                  setSuccessMessage(null)
                }}
                className={cn(
                  'flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl font-bold text-sm transition-all duration-200',
                  mode === 'login'
                    ? 'bg-brand-yellow text-brand-brown shadow-md shadow-amber-500/20'
                    : 'text-brand-brown/70 dark:text-brand-cream/70 hover:text-brand-brown dark:hover:text-brand-cream'
                )}
              >
                <UserCheck className="w-4 h-4" />
                <span>{lang === 'bn' ? 'লগইন (মালিক)' : 'Sign In'}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setMode('register')
                  setErrorMessage(null)
                  setSuccessMessage(null)
                }}
                className={cn(
                  'flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl font-bold text-sm transition-all duration-200',
                  mode === 'register'
                    ? 'bg-brand-yellow text-brand-brown shadow-md shadow-amber-500/20'
                    : 'text-brand-brown/70 dark:text-brand-cream/70 hover:text-brand-brown dark:hover:text-brand-cream'
                )}
              >
                <UserPlus className="w-4 h-4" />
                <span>{lang === 'bn' ? 'নতুন অ্যাকাউন্ট' : 'Register'}</span>
              </button>
            </div>

            {/* Error Message */}
            {errorMessage && (
              <div className="mb-4 flex items-start gap-2.5 p-3 rounded-2xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 text-red-700 dark:text-red-300 text-xs sm:text-sm animate-in fade-in duration-200">
                <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0 text-red-600 dark:text-red-400" />
                <span className="font-medium">{errorMessage}</span>
              </div>
            )}

            {/* Success Message */}
            {successMessage && (
              <div className="mb-4 flex items-start gap-2.5 p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/50 text-emerald-700 dark:text-emerald-300 text-xs sm:text-sm animate-in fade-in duration-200">
                <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0 text-emerald-600 dark:text-emerald-400" />
                <span className="font-medium">{successMessage}</span>
              </div>
            )}

            {/* Sign In Form: User ID and User Password */}
            {mode === 'login' ? (
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-brand-brown dark:text-brand-cream uppercase tracking-wider mb-1.5">
                    {lang === 'bn' ? 'ইউজার আইডি' : 'User ID'}
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-brand-brown/40 dark:text-brand-cream/40">
                      <User className="w-4 h-4" />
                    </div>
                    <input
                      type="text"
                      value={userId}
                      onChange={(e) => setUserId(e.target.value)}
                      placeholder={lang === 'bn' ? 'আপনার ইউজার আইডি দিন' : 'Enter your User ID'}
                      autoFocus
                      required
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-amber-200 dark:border-amber-900/60 bg-amber-50/40 dark:bg-black/30 text-brand-brown dark:text-brand-cream placeholder:text-brand-brown/40 dark:placeholder:text-brand-cream/30 focus:outline-none focus:ring-2 focus:ring-brand-yellow focus:border-transparent text-sm transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-brand-brown dark:text-brand-cream uppercase tracking-wider mb-1.5">
                    {lang === 'bn' ? 'ইউজার পাসওয়ার্ড' : 'User Password'}
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-brand-brown/40 dark:text-brand-cream/40">
                      <Lock className="w-4 h-4" />
                    </div>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder={lang === 'bn' ? 'পাসওয়ার্ড দিন' : 'Enter your password'}
                      required
                      className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-amber-200 dark:border-amber-900/60 bg-amber-50/40 dark:bg-black/30 text-brand-brown dark:text-brand-cream placeholder:text-brand-brown/40 dark:placeholder:text-brand-cream/30 focus:outline-none focus:ring-2 focus:ring-brand-yellow focus:border-transparent text-sm transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-brand-brown/40 dark:text-brand-cream/40 hover:text-brand-brown dark:hover:text-brand-cream"
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full mt-2 py-3 px-4 rounded-xl font-extrabold text-sm sm:text-base text-brand-brown bg-gradient-to-r from-brand-yellow via-amber-400 to-brand-yellow hover:brightness-105 active:scale-[0.99] shadow-lg shadow-amber-500/25 transition-all flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? (
                    <div className="w-5 h-5 border-2 border-brand-brown border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <span>{lang === 'bn' ? 'দোকানের সিস্টেমে সাইন ইন করুন' : 'Sign In as Shop Owner'}</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>

                {/* Footer Switcher */}
                <div className="text-center pt-3 border-t border-amber-100 dark:border-amber-900/40">
                  <span className="text-xs text-brand-brown/70 dark:text-brand-cream/70">
                    {t.auth.dontHaveAccount}{' '}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setMode('register')
                      setErrorMessage(null)
                    }}
                    className="text-xs font-bold text-brand-orange hover:underline focus:outline-none"
                  >
                    {t.auth.registerNow}
                  </button>
                </div>
              </form>
            ) : (
              /* Register Form */
              <form onSubmit={handleRegister} className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-brand-brown dark:text-brand-cream uppercase tracking-wider mb-1">
                    {lang === 'bn' ? 'ইউজার আইডি' : 'User ID'} <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-brand-brown/40 dark:text-brand-cream/40">
                      <User className="w-4 h-4" />
                    </div>
                    <input
                      type="text"
                      value={userId}
                      onChange={(e) => setUserId(e.target.value)}
                      placeholder={lang === 'bn' ? 'নতুন ইউজার আইডি দিন' : 'Enter User ID (e.g. my_shop)'}
                      required
                      autoFocus
                      className="w-full pl-10 pr-4 py-2 rounded-xl border border-amber-200 dark:border-amber-900/60 bg-amber-50/40 dark:bg-black/30 text-brand-brown dark:text-brand-cream placeholder:text-brand-brown/40 dark:placeholder:text-brand-cream/30 focus:outline-none focus:ring-2 focus:ring-brand-yellow focus:border-transparent text-sm transition-all"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-brand-brown dark:text-brand-cream uppercase tracking-wider mb-1">
                      {lang === 'bn' ? 'মালিকের নাম' : 'Owner Name'}
                    </label>
                    <input
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder={lang === 'bn' ? 'উদাঃ রহিম আহমেদ' : 'e.g. Rahim Ahmed'}
                      className="w-full px-3.5 py-2 rounded-xl border border-amber-200 dark:border-amber-900/60 bg-amber-50/40 dark:bg-black/30 text-brand-brown dark:text-brand-cream placeholder:text-brand-brown/40 dark:placeholder:text-brand-cream/30 focus:outline-none focus:ring-2 focus:ring-brand-yellow focus:border-transparent text-sm transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-brand-brown dark:text-brand-cream uppercase tracking-wider mb-1">
                      {lang === 'bn' ? 'দোকানের নাম / ব্র্যান্ড' : 'Shop / Brand Name'}
                    </label>
                    <input
                      type="text"
                      value={shopName}
                      onChange={(e) => setShopName(e.target.value)}
                      placeholder={lang === 'bn' ? 'উদাঃ হাট-বাজার সুপার গ্রোসারি' : 'e.g. Haat-Bazar Super Grocery'}
                      className="w-full px-3.5 py-2 rounded-xl border border-amber-200 dark:border-amber-900/60 bg-amber-50/40 dark:bg-black/30 text-brand-brown dark:text-brand-cream placeholder:text-brand-brown/40 dark:placeholder:text-brand-cream/30 focus:outline-none focus:ring-2 focus:ring-brand-yellow focus:border-transparent text-sm transition-all"
                    />
                  </div>
                </div>

                {/* Primary Branch Location: District then Area (User Request #2) */}
                <div className="p-3 rounded-2xl bg-amber-50/80 dark:bg-black/40 border border-amber-200/80 dark:border-amber-900/60 space-y-2.5">
                  <div className="flex items-center gap-2 text-xs font-bold text-brand-orange">
                    <MapPin className="w-4 h-4" />
                    <span>{lang === 'bn' ? 'প্রধান দোকানের লোকেশন (প্রথমে জেলা, পরে এলাকা)' : 'Main Branch Location (District & Area)'}</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-[11px] font-semibold text-brand-brown/70 dark:text-brand-cream/70 mb-1">
                        {lang === 'bn' ? 'জেলা' : 'District'} <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={primaryDistrict}
                        onChange={(e) => setPrimaryDistrict(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-border bg-input text-text text-xs focus:ring-2 focus:ring-accent focus:outline-none"
                      >
                        {BD_DISTRICTS.map((d) => (
                          <option key={d} value={d}>
                            {d}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-text-secondary mb-1">
                        {lang === 'bn' ? 'এলাকা / রোড নং' : 'Area / Road'} <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={primaryArea}
                        onChange={(e) => setPrimaryArea(e.target.value)}
                        placeholder={lang === 'bn' ? 'উদাঃ ৯/এ, ধানমন্ডি' : 'e.g. 9/A, Dhanmondi'}
                        required
                        className="w-full px-3 py-2 rounded-xl border border-border bg-input text-text text-xs focus:ring-2 focus:ring-accent focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* Extra branches dynamically added during registration */}
                  {extraBranches.map((b, idx) => (
                    <div key={idx} className="p-2.5 rounded-xl border border-dashed border-border bg-background-secondary space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-text">
                          {lang === 'bn' ? `শাখা ${idx + 2}` : `Branch ${idx + 2}`}
                        </span>
                        <button
                          type="button"
                          onClick={() => setExtraBranches(extraBranches.filter((_, i) => i !== idx))}
                          className="text-red-500 hover:text-red-700 text-xs flex items-center gap-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>{lang === 'bn' ? 'মুছুন' : 'Remove'}</span>
                        </button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <select
                          value={b.district}
                          onChange={(e) => {
                            const updated = [...extraBranches]
                            updated[idx].district = e.target.value
                            setExtraBranches(updated)
                          }}
                          className="w-full px-2.5 py-1.5 rounded-lg border border-border bg-input text-text text-xs focus:ring-2 focus:ring-accent"
                        >
                          {BD_DISTRICTS.map((d) => (
                            <option key={d} value={d}>
                              {d}
                            </option>
                          ))}
                        </select>
                        <input
                          type="text"
                          value={b.area}
                          onChange={(e) => {
                            const updated = [...extraBranches]
                            updated[idx].area = e.target.value
                            updated[idx].name = `${e.target.value}, ${updated[idx].district}`
                            setExtraBranches(updated)
                          }}
                          placeholder={lang === 'bn' ? 'উদাঃ মিরপুর-১০ শাখা' : 'e.g. Mirpur-10 Branch'}
                          className="w-full px-2.5 py-1.5 rounded-lg border border-border bg-input text-text text-xs focus:ring-2 focus:ring-accent"
                        />
                      </div>
                    </div>
                  ))}

                  <button
                    type="button"
                    onClick={() =>
                      setExtraBranches([
                        ...extraBranches,
                        { name: '', district: primaryDistrict, area: '' },
                      ])
                    }
                    className="w-full py-1.5 px-3 rounded-xl border border-dashed border-amber-400 dark:border-amber-700 text-brand-orange hover:bg-amber-100/60 dark:hover:bg-white/5 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>{lang === 'bn' ? '+ অন্য কোনো শাখা থাকলে যোগ করুন' : '+ Add More Branches'}</span>
                  </button>
                </div>

                <div>
                  <label className="block text-xs font-bold text-brand-brown dark:text-brand-cream uppercase tracking-wider mb-1">
                    {lang === 'bn' ? 'ইউজার পাসওয়ার্ড' : 'User Password'} <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-brand-brown/40 dark:text-brand-cream/40">
                      <Lock className="w-4 h-4" />
                    </div>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder={lang === 'bn' ? 'কমপক্ষে ৪ অক্ষরের পাসওয়ার্ড' : 'At least 4 characters'}
                      required
                      className="w-full pl-10 pr-10 py-2 rounded-xl border border-amber-200 dark:border-amber-900/60 bg-amber-50/40 dark:bg-black/30 text-brand-brown dark:text-brand-cream placeholder:text-brand-brown/40 dark:placeholder:text-brand-cream/30 focus:outline-none focus:ring-2 focus:ring-brand-yellow focus:border-transparent text-sm transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-brand-brown/40 dark:text-brand-cream/40 hover:text-brand-brown dark:hover:text-brand-cream"
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-brand-brown dark:text-brand-cream uppercase tracking-wider mb-1">
                    {t.auth.confirmPassword} <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-brand-brown/40 dark:text-brand-cream/40">
                      <Lock className="w-4 h-4" />
                    </div>
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder={t.auth.confirmPasswordPlaceholder}
                      required
                      className="w-full pl-10 pr-10 py-2 rounded-xl border border-amber-200 dark:border-amber-900/60 bg-amber-50/40 dark:bg-black/30 text-brand-brown dark:text-brand-cream placeholder:text-brand-brown/40 dark:placeholder:text-brand-cream/30 focus:outline-none focus:ring-2 focus:ring-brand-yellow focus:border-transparent text-sm transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-brand-brown/40 dark:text-brand-cream/40 hover:text-brand-brown dark:hover:text-brand-cream"
                      tabIndex={-1}
                    >
                      {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Submit Register */}
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full mt-3 py-3 px-4 rounded-xl font-extrabold text-sm sm:text-base text-brand-brown bg-gradient-to-r from-brand-yellow via-amber-400 to-brand-yellow hover:brightness-105 active:scale-[0.99] shadow-lg shadow-amber-500/25 transition-all flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? (
                    <div className="w-5 h-5 border-2 border-brand-brown border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <span>{lang === 'bn' ? 'দোকানের অ্যাকাউন্ট খুলুন' : 'Register Shop Account'}</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>

                {/* Switch back to Login */}
                <div className="text-center pt-2 border-t border-amber-100 dark:border-amber-900/40">
                  <span className="text-xs text-brand-brown/70 dark:text-brand-cream/70">
                    {t.auth.alreadyHaveAccount}{' '}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setMode('login')
                      setErrorMessage(null)
                    }}
                    className="text-xs font-bold text-brand-orange hover:underline focus:outline-none"
                  >
                    {t.auth.signInNow}
                  </button>
                </div>
              </form>
            )}
          </div>

          {/* Feature Highlights */}
          <div className="mt-6 grid grid-cols-3 gap-3 text-center">
            <div className="p-3 rounded-2xl bg-card border border-border shadow-card">
              <Package className="w-5 h-5 mx-auto text-accent mb-1" />
              <div className="text-xs font-bold text-text">
                {lang === 'bn' ? 'স্মার্ট স্টক' : 'Smart Stock'}
              </div>
              <div className="text-[10px] text-text-secondary">
                {lang === 'bn' ? 'মেয়াদ ও ব্যাচ' : 'AI Expiry & Batch'}
              </div>
            </div>

            <div className="p-3 rounded-2xl bg-card border border-border shadow-card">
              <TrendingUp className="w-5 h-5 mx-auto text-accent mb-1" />
              <div className="text-xs font-bold text-text">
                {lang === 'bn' ? 'চাহিদা পূর্বাভাস' : 'Demand Forecast'}
              </div>
              <div className="text-[10px] text-text-secondary">
                {lang === 'bn' ? 'বহু-শাখা হিসাব' : 'Multi-Branch'}
              </div>
            </div>

            <div className="p-3 rounded-2xl bg-card border border-border shadow-card">
              <ShieldCheck className="w-5 h-5 mx-auto text-success mb-1" />
              <div className="text-xs font-bold text-text">
                {lang === 'bn' ? 'মালিকের ড্যাশবোর্ড' : 'Shop Owner'}
              </div>
              <div className="text-[10px] text-text-secondary">
                {lang === 'bn' ? 'পূর্ণ নিয়ন্ত্রণ' : 'Full ERP Access'}
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full text-center py-3 px-4 text-xs text-brand-brown/60 dark:text-brand-cream/50">
        <p>
          © {new Date().getFullYear()} Hat-Bazar ERP — {t.auth.systemSubtitle}
        </p>
      </footer>
    </div>
  )
}
