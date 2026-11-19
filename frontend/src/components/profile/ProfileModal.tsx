import { useState, useEffect } from 'react'
import {
  User,
  Store,
  MapPin,
  Phone,
  Lock,
  Plus,
  Check,
  Building2,
  X,
  AlertCircle,
  Sparkles,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useLang } from '@/i18n'
import { useAuth } from '@/context/AuthContext'
import { useShopContext } from '@/hooks/useShopContext'
import { db } from '@/db/schema'
import type { Shop } from '@/types'

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

interface ProfileModalProps {
  isOpen: boolean
  onClose: () => void
  initialTab?: 'profile' | 'branches'
}

export function ProfileModal({ isOpen, onClose, initialTab = 'profile' }: ProfileModalProps) {
  const { lang } = useLang()
  const { user, updateProfile } = useAuth()
  const { shops, currentShop, setCurrentShop } = useShopContext()

  const [activeTab, setActiveTab] = useState<'profile' | 'branches'>(initialTab)

  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab)
    }
  }, [isOpen, initialTab])

  // Profile Form state
  const [fullName, setFullName] = useState(user?.fullName || '')
  const [shopName, setShopName] = useState(user?.shopName || '')
  const [phone, setPhone] = useState(user?.phone || '')
  const [address, setAddress] = useState(user?.address || '')
  const [password, setPassword] = useState('')
  const [profileSuccess, setProfileSuccess] = useState<string | null>(null)
  const [profileError, setProfileError] = useState<string | null>(null)
  const [isSavingProfile, setIsSavingProfile] = useState(false)

  // Branch Form state
  const [showAddBranch, setShowAddBranch] = useState(false)
  const [branchDistrict, setBranchDistrict] = useState('ঢাকা (Dhaka)')
  const [branchArea, setBranchArea] = useState('')
  const [branchNameBn, setBranchNameBn] = useState('')
  const [branchNameEn, setBranchNameEn] = useState('')
  const [branchAddress, setBranchAddress] = useState('')
  const [branchPhone, setBranchPhone] = useState('')
  const [branchAreaType, setBranchAreaType] = useState<'mixed' | 'student' | 'garment' | 'affluent'>('mixed')
  const [branchSuccess, setBranchSuccess] = useState<string | null>(null)
  const [branchError, setBranchError] = useState<string | null>(null)
  const [isSavingBranch, setIsSavingBranch] = useState(false)

  if (!isOpen) return null

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    setProfileError(null)
    setProfileSuccess(null)
    setIsSavingProfile(true)

    try {
      const res = await updateProfile({
        fullName,
        shopName,
        phone,
        address,
        password: password ? password : undefined,
      })

      if (res.success) {
        setProfileSuccess(
          lang === 'bn'
            ? 'প্রোফাইল সফলভাবে আপডেট করা হয়েছে!'
            : 'Profile updated successfully!'
        )
        setPassword('')
        setTimeout(() => setProfileSuccess(null), 3000)
      } else {
        setProfileError(res.error || 'Failed to update profile')
      }
    } catch (err: any) {
      setProfileError(err.message || 'An error occurred')
    } finally {
      setIsSavingProfile(false)
    }
  }

  const handleAddBranch = async (e: React.FormEvent) => {
    e.preventDefault()
    setBranchError(null)
    setBranchSuccess(null)

    if (!branchArea.trim() && !branchNameBn.trim()) {
      setBranchError(lang === 'bn' ? 'শাখার এলাকা বা নাম প্রদান করুন' : 'Branch area or name is required')
      return
    }

    setIsSavingBranch(true)
    try {
      const finalNameBn = branchNameBn.trim() || `${branchArea.trim()}, ${branchDistrict}`
      const finalAddress = `${branchAddress ? branchAddress.trim() + ', ' : ''}${branchArea ? branchArea.trim() + ', ' : ''}${branchDistrict}`

      const newShop: Shop = {
        id: `shop-${Date.now()}`,
        name: finalNameBn,
        nameEn: branchNameEn.trim() || finalNameBn,
        address: finalAddress,
        location: finalAddress,
        phone: branchPhone.trim() || '',
        areaType: branchAreaType,
        area: branchArea.trim() || finalNameBn,
        ownerName: user?.fullName || 'Shop Owner',
        updatedAt: new Date().toISOString(),
        deleted: 0,
      }

      await db.shops.add(newShop)
      setCurrentShop(newShop)

      setBranchSuccess(
        lang === 'bn'
          ? `"${newShop.name}" শাখা সফলভাবে যুক্ত ও সক্রিয় করা হয়েছে!`
          : `Branch "${newShop.nameEn || newShop.name}" added and set as active!`
      )

      // Reset form
      setBranchNameBn('')
      setBranchNameEn('')
      setBranchAddress('')
      setBranchArea('')
      setBranchPhone('')
      setShowAddBranch(false)

      setTimeout(() => setBranchSuccess(null), 4000)
    } catch (err: any) {
      setBranchError(err.message || 'Failed to add branch')
    } finally {
      setIsSavingBranch(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 animate-in fade-in duration-200">
      <div
        className={cn(
          'w-full max-w-2xl bg-card text-text rounded-2xl shadow-card-elevated',
          'border border-border',
          'flex flex-col max-h-[90vh] overflow-hidden'
        )}
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-border flex items-center justify-between bg-background-secondary">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-accent flex items-center justify-center text-[#493522] shadow-sm">
              <User className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-text">
                {lang === 'bn' ? 'দোকানের মালিকের প্রোফাইল ও শাখা' : 'Owner Profile & Store Branches'}
              </h2>
              <p className="text-xs text-text-secondary">
                {lang === 'bn'
                  ? 'আপনার ব্যবসায়িক তথ্য ও শাখা পরিচালনা করুন'
                  : 'Manage store credentials, settings, and physical branches'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-text-secondary hover:bg-background-secondary transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-amber-100 dark:border-amber-900/40 px-4 sm:px-6 bg-amber-50/40 dark:bg-black/20">
          <button
            onClick={() => setActiveTab('profile')}
            className={cn(
              'flex items-center gap-2 py-3 px-4 text-xs sm:text-sm font-bold border-b-2 transition-all',
              activeTab === 'profile'
                ? 'border-brand-orange text-brand-orange'
                : 'border-transparent text-brand-brown/60 dark:text-brand-cream/60 hover:text-brand-brown dark:hover:text-brand-cream'
            )}
          >
            <User className="w-4 h-4" />
            <span>{lang === 'bn' ? 'মালিকের প্রোফাইল' : 'Owner Profile'}</span>
          </button>
          <button
            onClick={() => setActiveTab('branches')}
            className={cn(
              'flex items-center gap-2 py-3 px-4 text-xs sm:text-sm font-bold border-b-2 transition-all',
              activeTab === 'branches'
                ? 'border-brand-orange text-brand-orange'
                : 'border-transparent text-brand-brown/60 dark:text-brand-cream/60 hover:text-brand-brown dark:hover:text-brand-cream'
            )}
          >
            <Building2 className="w-4 h-4" />
            <span>{lang === 'bn' ? 'শাখা ও লোকেশন' : 'Branches & Locations'}</span>
            <span className="ml-1 px-1.5 py-0.2 rounded-full bg-amber-200 dark:bg-amber-900/60 text-[10px] font-extrabold text-brand-brown dark:text-brand-cream">
              {shops.length}
            </span>
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {/* TAB 1: OWNER PROFILE */}
          {activeTab === 'profile' && (
            <form onSubmit={handleSaveProfile} className="space-y-4">
              {profileSuccess && (
                <div className="p-3 rounded-xl bg-green-50 dark:bg-green-950/40 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-300 text-xs sm:text-sm flex items-center gap-2">
                  <Check className="w-4 h-4 shrink-0" />
                  <span>{profileSuccess}</span>
                </div>
              )}

              {profileError && (
                <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-xs sm:text-sm flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{profileError}</span>
                </div>
              )}

              {/* Username & Role Badges (Uneditable / System IDs) */}
              <div className="p-3.5 rounded-xl bg-amber-50/70 dark:bg-white/5 border border-amber-200/60 dark:border-amber-900/40 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-brand-yellow/30 flex items-center justify-center text-brand-brown dark:text-brand-cream font-bold">
                    {user?.fullName?.charAt(0) || user?.username?.charAt(0) || 'U'}
                  </div>
                  <div>
                    <div className="font-bold text-sm text-brand-brown dark:text-brand-cream flex items-center gap-2">
                      <span>@{user?.username}</span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-200/80 dark:bg-amber-900/60 text-brand-orange dark:text-amber-300">
                        {lang === 'bn' ? 'দোকানের মালিক' : 'Store Owner'}
                      </span>
                    </div>
                    <div className="text-[11px] text-brand-brown/60 dark:text-brand-cream/60">
                      ID: {user?.id} • {lang === 'bn' ? 'সিস্টেম অ্যাডমিন ও শপকিপার' : 'Unified Shop Administrator'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Editable Fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-bold text-brand-brown dark:text-brand-cream mb-1">
                    {lang === 'bn' ? 'পূর্ণ নাম' : 'Full Name'}
                  </label>
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder={lang === 'bn' ? 'যেমন: মোহাম্মদ করিম' : 'e.g. John Doe'}
                    className="w-full px-3 py-2 rounded-xl text-sm border border-amber-200 dark:border-amber-900/60 bg-white dark:bg-white/5 text-brand-brown dark:text-brand-cream focus:outline-none focus:ring-2 focus:ring-brand-orange"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-brand-brown dark:text-brand-cream mb-1">
                    {lang === 'bn' ? 'দোকানের মূল নাম' : 'Main Grocery Store Name'}
                  </label>
                  <input
                    type="text"
                    value={shopName}
                    onChange={(e) => setShopName(e.target.value)}
                    placeholder={lang === 'bn' ? 'যেমন: হাট-বাজার সুপারস্টোর' : 'e.g. Hat-Bazar Superstore'}
                    className="w-full px-3 py-2 rounded-xl text-sm border border-amber-200 dark:border-amber-900/60 bg-white dark:bg-white/5 text-brand-brown dark:text-brand-cream focus:outline-none focus:ring-2 focus:ring-brand-orange"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-brand-brown dark:text-brand-cream mb-1">
                    {lang === 'bn' ? 'মোবাইল নম্বর' : 'Phone Number'}
                  </label>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="017XXXXXXXX"
                    className="w-full px-3 py-2 rounded-xl text-sm border border-amber-200 dark:border-amber-900/60 bg-white dark:bg-white/5 text-brand-brown dark:text-brand-cream focus:outline-none focus:ring-2 focus:ring-brand-orange"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-brand-brown dark:text-brand-cream mb-1">
                    {lang === 'bn' ? 'বর্তমান ঠিকানা / অবস্থান' : 'Address / Location'}
                  </label>
                  <input
                    type="text"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder={lang === 'bn' ? 'যেমন: ৯/এ, ধানমন্ডি, ঢাকা' : 'e.g. 9/A, Dhanmondi, Dhaka'}
                    className="w-full px-3 py-2 rounded-xl text-sm border border-amber-200 dark:border-amber-900/60 bg-white dark:bg-white/5 text-brand-brown dark:text-brand-cream focus:outline-none focus:ring-2 focus:ring-brand-orange"
                  />
                </div>
              </div>

              {/* Change Password */}
              <div className="pt-2 border-t border-amber-100 dark:border-amber-900/30">
                <label className="block text-xs font-bold text-brand-brown dark:text-brand-cream mb-1">
                  {lang === 'bn' ? 'নতুন পাসওয়ার্ড (পরিবর্তন করতে চাইলে)' : 'New Password (Optional)'}
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 absolute left-3 top-2.5 text-brand-brown/40 dark:text-brand-cream/40" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={lang === 'bn' ? 'নতুন পাসওয়ার্ড দিন...' : 'Enter new password...'}
                    className="w-full pl-9 pr-3 py-2 rounded-xl text-sm border border-amber-200 dark:border-amber-900/60 bg-white dark:bg-white/5 text-brand-brown dark:text-brand-cream focus:outline-none focus:ring-2 focus:ring-brand-orange"
                  />
                </div>
                <p className="text-[11px] text-brand-brown/50 dark:text-brand-cream/50 mt-1">
                  {lang === 'bn'
                    ? 'পাসওয়ার্ড ফাঁকা রাখলে বর্তমান পাসওয়ার্ড অপরিবর্তিত থাকবে'
                    : 'Leave blank to keep your current password'}
                </p>
              </div>

              <div className="flex justify-end pt-3">
                <button
                  type="submit"
                  disabled={isSavingProfile}
                  className="px-5 py-2.5 rounded-xl font-bold text-sm bg-gradient-to-r from-brand-yellow to-brand-orange text-brand-brown shadow-md hover:brightness-105 active:scale-95 transition-all flex items-center gap-2"
                >
                  <Check className="w-4 h-4" />
                  <span>{isSavingProfile ? (lang === 'bn' ? 'সংরক্ষণ হচ্ছে...' : 'Saving...') : (lang === 'bn' ? 'প্রোফাইল সংরক্ষণ করুন' : 'Save Profile')}</span>
                </button>
              </div>
            </form>
          )}

          {/* TAB 2: BRANCHES */}
          {activeTab === 'branches' && (
            <div className="space-y-4">
              {branchSuccess && (
                <div className="p-3 rounded-xl bg-green-50 dark:bg-green-950/40 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-300 text-xs sm:text-sm flex items-center gap-2">
                  <Check className="w-4 h-4 shrink-0" />
                  <span>{branchSuccess}</span>
                </div>
              )}

              {branchError && (
                <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-xs sm:text-sm flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{branchError}</span>
                </div>
              )}

              {/* Action bar */}
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-brand-brown dark:text-brand-cream">
                    {lang === 'bn' ? 'বিদ্যমান শাখাসমূহ' : 'Registered Branches'}
                  </h3>
                  <p className="text-xs text-brand-brown/60 dark:text-brand-cream/60">
                    {lang === 'bn'
                      ? 'যেকোনো শাখায় ক্লিক করে সক্রিয় করুন'
                      : 'Switch between stores with one click'}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setShowAddBranch((p) => !p)}
                  className="px-3 py-1.5 rounded-xl font-bold text-xs bg-brand-yellow/80 hover:bg-brand-yellow text-brand-brown border border-amber-300 dark:border-amber-700 flex items-center gap-1.5 transition-all"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{showAddBranch ? (lang === 'bn' ? 'ফর্ম লুকান' : 'Hide Form') : (lang === 'bn' ? '+ নতুন শাখা যোগ করুন' : '+ Add New Branch')}</span>
                </button>
              </div>

              {/* Add Branch Inline Form */}
              {showAddBranch && (
                <form
                  onSubmit={handleAddBranch}
                  className="p-4 rounded-xl bg-amber-50/70 dark:bg-white/5 border border-amber-300/80 dark:border-amber-800/60 space-y-3 animate-in fade-in slide-in-from-top-2 duration-150"
                >
                  <div className="flex items-center gap-2 text-xs font-bold text-brand-orange uppercase tracking-wide">
                    <Sparkles className="w-4 h-4" />
                    <span>{lang === 'bn' ? 'নতুন শাখা নিবন্ধন' : 'Register New Branch'}</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-brand-brown dark:text-brand-cream mb-1">
                        {lang === 'bn' ? 'জেলা' : 'District'} *
                      </label>
                      <select
                        value={branchDistrict}
                        onChange={(e) => setBranchDistrict(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl text-sm border border-amber-200 dark:border-amber-900/60 bg-white dark:bg-black/30 text-brand-brown dark:text-brand-cream focus:outline-none focus:ring-2 focus:ring-brand-orange"
                      >
                        {BD_DISTRICTS.map((d) => (
                          <option key={d} value={d}>
                            {d}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-brand-brown dark:text-brand-cream mb-1">
                        {lang === 'bn' ? 'এলাকা / লোকেশন' : 'Area / Location'} *
                      </label>
                      <input
                        type="text"
                        required
                        value={branchArea}
                        onChange={(e) => setBranchArea(e.target.value)}
                        placeholder={lang === 'bn' ? 'যেমন: ৯/এ, ধানমন্ডি' : 'e.g. 9/A, Dhanmondi'}
                        className="w-full px-3 py-2 rounded-xl text-sm border border-amber-200 dark:border-amber-900/60 bg-white dark:bg-black/30 text-brand-brown dark:text-brand-cream focus:outline-none focus:ring-2 focus:ring-brand-orange"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-brand-brown dark:text-brand-cream mb-1">
                        {lang === 'bn' ? 'শাখার নাম (ঐচ্ছিক)' : 'Branch Display Name (Optional)'}
                      </label>
                      <input
                        type="text"
                        value={branchNameBn}
                        onChange={(e) => setBranchNameBn(e.target.value)}
                        placeholder={lang === 'bn' ? 'যেমন: ধানমন্ডি শাখা' : 'e.g. Dhanmondi Branch'}
                        className="w-full px-3 py-2 rounded-xl text-sm border border-amber-200 dark:border-amber-900/60 bg-white dark:bg-black/30 text-brand-brown dark:text-brand-cream focus:outline-none focus:ring-2 focus:ring-brand-orange"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-brand-brown dark:text-brand-cream mb-1">
                        {lang === 'bn' ? 'মোবাইল / হেল্পলাইন' : 'Contact Phone'}
                      </label>
                      <input
                        type="text"
                        value={branchPhone}
                        onChange={(e) => setBranchPhone(e.target.value)}
                        placeholder="017XXXXXXXX"
                        className="w-full px-3 py-2 rounded-xl text-sm border border-amber-200 dark:border-amber-900/60 bg-white dark:bg-black/30 text-brand-brown dark:text-brand-cream focus:outline-none focus:ring-2 focus:ring-brand-orange"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-brand-brown dark:text-brand-cream mb-1">
                      {lang === 'bn' ? 'এলাকার ধরণ' : 'Area Type'}
                    </label>
                    <select
                      value={branchAreaType}
                      onChange={(e) => setBranchAreaType(e.target.value as any)}
                      className="w-full sm:w-1/2 px-3 py-2 rounded-xl text-sm border border-amber-200 dark:border-amber-900/60 bg-white dark:bg-black/30 text-brand-brown dark:text-brand-cream focus:outline-none focus:ring-2 focus:ring-brand-orange"
                    >
                      <option value="mixed">{lang === 'bn' ? 'মিশ্র এলাকা (Mixed)' : 'Mixed Market Area'}</option>
                      <option value="affluent">{lang === 'bn' ? 'আবাসিক / আধুনিক এলাকা' : 'Residential / Affluent'}</option>
                      <option value="student">{lang === 'bn' ? 'শিক্ষার্থী / ক্যাম্পাস এলাকা' : 'Student / Campus Area'}</option>
                      <option value="garment">{lang === 'bn' ? 'শ্রমিক / পোশাক-কর্মী এলাকা' : 'Industrial / Garment Area'}</option>
                    </select>
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowAddBranch(false)}
                      className="px-3 py-1.5 rounded-xl text-xs font-semibold text-brand-brown/70 dark:text-brand-cream/70 hover:bg-amber-100 dark:hover:bg-white/10"
                    >
                      {lang === 'bn' ? 'বাতিল' : 'Cancel'}
                    </button>
                    <button
                      type="submit"
                      disabled={isSavingBranch}
                      className="px-4 py-1.5 rounded-xl text-xs font-bold bg-brand-orange text-white shadow hover:brightness-105 active:scale-95 transition-all flex items-center gap-1.5"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>{isSavingBranch ? (lang === 'bn' ? 'যোগ হচ্ছে...' : 'Adding...') : (lang === 'bn' ? 'শাখা যোগ করুন' : 'Save Branch')}</span>
                    </button>
                  </div>
                </form>
              )}

              {/* Branch List Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {shops.map((shop) => {
                  const isActive = shop.id === currentShop?.id
                  return (
                    <div
                      key={shop.id}
                      onClick={() => {
                        setCurrentShop(shop)
                      }}
                      className={cn(
                        'p-3.5 rounded-xl border transition-all cursor-pointer flex flex-col justify-between gap-2.5',
                        isActive
                          ? 'border-brand-orange bg-amber-50/90 dark:bg-amber-950/40 ring-2 ring-brand-orange/40 shadow-sm'
                          : 'border-amber-200/70 dark:border-amber-900/40 bg-white dark:bg-white/5 hover:border-brand-orange/50'
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-start gap-2.5">
                          <div className={cn(
                            'w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5',
                            isActive ? 'bg-brand-orange text-white' : 'bg-amber-100 dark:bg-white/10 text-brand-brown dark:text-brand-cream'
                          )}>
                            <MapPin className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="text-sm font-bold text-brand-brown dark:text-brand-cream leading-tight">
                              {lang === 'bn' ? shop.name : (shop.nameEn || shop.name)}
                            </div>
                            <div className="text-xs text-brand-brown/60 dark:text-brand-cream/60 mt-0.5 line-clamp-1">
                              {shop.address || shop.location || (lang === 'bn' ? 'ঢাকা, বাংলাদেশ' : 'Dhaka, Bangladesh')}
                            </div>
                          </div>
                        </div>

                        {isActive && (
                          <span className="shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold bg-brand-orange text-white flex items-center gap-1">
                            <Check className="w-3 h-3" />
                            <span>{lang === 'bn' ? 'বর্তমান' : 'Active'}</span>
                          </span>
                        )}
                      </div>

                      <div className="flex items-center justify-between text-[11px] pt-2 border-t border-amber-100 dark:border-amber-900/30 text-brand-brown/60 dark:text-brand-cream/60">
                        <span>{shop.phone || '01711-000000'}</span>
                        <span className="capitalize font-medium">
                          {shop.areaType || 'mixed'}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
