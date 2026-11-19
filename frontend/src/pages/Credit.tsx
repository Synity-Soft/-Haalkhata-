// Customer credit (বাকি) tracking page — simple and shopkeeper-friendly with SMS Reminders
import { useState, useMemo } from 'react'
import {
  CreditCard,
  Plus,
  CheckCircle,
  Clock,
  AlertTriangle,
  User,
  Calendar,
  Check,
  Search,
  MessageSquare,
  Send,
  Copy,
  Phone,
  Sparkles,
} from 'lucide-react'
import { isBefore, parseISO } from 'date-fns'
import { useLang } from '@/i18n'
import { useShopContext } from '@/hooks/useShopContext'
import { useCredits } from '@/db/hooks'
import { addCredit, markCreditPaid, updateCredit } from '@/db/mutations'
import { calcCreditStats } from '@/engines/credit'
import { Card, Button, Badge, Modal, DemoBadge, EmptyState } from '@/components/ui'
import { AnimatedNumber, SwipeRow, CheckDraw, Stagger, showSaveToast } from '@/components/motion'
import { formatCustomerSmsReminder } from '@/mock/haalkhataFeatures'
import type { Credit } from '@/types'

export default function CreditPage() {
  const { t, lang, formatNum, formatCurrency } = useLang()
  const { currentShop } = useShopContext()

  const shopId = currentShop?.id || 'shop-student-01'
  const rawCredits = useCredits(shopId) as Credit[] | undefined
  const credits = rawCredits || []

  const [searchQuery, setSearchQuery] = useState('')
  const [filterPaid, setFilterPaid] = useState<'all' | 'unpaid' | 'paid'>('unpaid')
  const [isModalOpen, setIsModalOpen] = useState(false)

  // Form states for Add Credit
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [amount, setAmount] = useState<number>(500)
  const [description, setDescription] = useState('')
  const [dueDate, setDueDate] = useState('')

  // SMS Modal State
  const [isSmsModalOpen, setIsSmsModalOpen] = useState(false)
  const [selectedCreditForSms, setSelectedCreditForSms] = useState<Credit | null>(null)
  const [smsPhone, setSmsPhone] = useState('')
  const [smsTone, setSmsTone] = useState<'friendly' | 'urgent'>('friendly')
  const [smsCustomText, setSmsCustomText] = useState('')

  const stats = useMemo(() => calcCreditStats(credits), [credits])

  const filteredCredits = useMemo(() => {
    return credits
      .filter((c) => !c.deleted)
      .filter((c) => {
        if (filterPaid === 'unpaid' && c.isPaid) return false
        if (filterPaid === 'paid' && !c.isPaid) return false
        if (searchQuery.trim()) {
          const match =
            c.customerName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            c.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            c.customerPhone?.includes(searchQuery)
          if (!match) return false
        }
        return true
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  }, [credits, filterPaid, searchQuery])

  const handleOpenAddModal = () => {
    setCustomerName('')
    setCustomerPhone('')
    setAmount(500)
    setDescription('')
    setDueDate('')
    setIsModalOpen(true)
  }

  const handleSaveCredit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!customerName.trim() || amount <= 0) return

    await addCredit({
      shopId,
      customerName: customerName.trim(),
      customerPhone: customerPhone.trim() || undefined,
      amount: Number(amount),
      description: description.trim(),
      dueDate: dueDate ? dueDate : undefined,
      isPaid: false,
      createdAt: new Date().toISOString(),
    })

    setIsModalOpen(false)
    showSaveToast(lang === 'bn' ? 'বাকির হিসাব যুক্ত হয়েছে ✓' : 'Credit record added ✓')
  }

  const handleMarkPaid = async (id: string) => {
    await markCreditPaid(id)
    showSaveToast(lang === 'bn' ? 'বাকি পরিশোধ সম্পন্ন হয়েছে ✓' : 'Payment recorded ✓')
  }

  // Open SMS modal with pre-generated text
  const handleOpenSmsModal = (c: Credit) => {
    setSelectedCreditForSms(c)
    const phone = c.customerPhone || '01712-345678'
    setSmsPhone(phone)

    const isOverdue = !c.isPaid && c.dueDate && isBefore(parseISO(c.dueDate), new Date())
    const initialTone: 'friendly' | 'urgent' = isOverdue ? 'urgent' : 'friendly'
    setSmsTone(initialTone)

    const generated = formatCustomerSmsReminder({
      customerName: c.customerName,
      dueAmount: c.amount,
      shopName: currentShop?.name || 'হালখাতা স্টোর',
      dueDate: c.dueDate,
      tone: initialTone,
    })
    setSmsCustomText(generated)
    setIsSmsModalOpen(true)
  }

  const handleToneChange = (newTone: 'friendly' | 'urgent') => {
    if (!selectedCreditForSms) return
    setSmsTone(newTone)
    const generated = formatCustomerSmsReminder({
      customerName: selectedCreditForSms.customerName,
      dueAmount: selectedCreditForSms.amount,
      shopName: currentShop?.name || 'হালখাতা স্টোর',
      dueDate: selectedCreditForSms.dueDate,
      tone: newTone,
    })
    setSmsCustomText(generated)
  }

  const handleSendSms = async () => {
    if (!selectedCreditForSms) return
    const phone = smsPhone.trim()
    const cleanPhone = phone.replace(/[^0-9+]/g, '')

    await updateCredit(selectedCreditForSms.id, {
      customerPhone: phone,
      lastSmsSentAt: new Date().toISOString(),
      smsCount: (selectedCreditForSms.smsCount || 0) + 1,
    })

    if (cleanPhone) {
      window.open(`sms:${cleanPhone}?body=${encodeURIComponent(smsCustomText)}`, '_blank')
    }

    showSaveToast(
      lang === 'bn'
        ? `${selectedCreditForSms.customerName}-কে এসএমএস পাঠানো হয়েছে ✓`
        : `SMS sent to ${selectedCreditForSms.customerName} ✓`
    )
    setIsSmsModalOpen(false)
  }

  const handleCopySms = () => {
    navigator.clipboard?.writeText(smsCustomText)
    showSaveToast(lang === 'bn' ? 'মেসেজ কপি হয়েছে ✓' : 'SMS copied to clipboard ✓')
  }

  const handleBulkSmsRemindAll = async () => {
    const unpaid = credits.filter((c) => !c.deleted && !c.isPaid)
    if (unpaid.length === 0) {
      showSaveToast(lang === 'bn' ? 'কোনো বকেয়া বাকি নেই' : 'No pending unpaid credits')
      return
    }

    const now = new Date().toISOString()
    for (const c of unpaid) {
      await updateCredit(c.id, {
        lastSmsSentAt: now,
        smsCount: (c.smsCount || 0) + 1,
      })
    }

    showSaveToast(
      lang === 'bn'
        ? `${unpaid.length} জন বকেয়া গ্রাহকের জন্য এসএমএস তাগাদা কিউ হয়েছে ✓`
        : `Queued SMS reminders to ${unpaid.length} customers ✓`
    )
  }

  return (
    <div className="space-y-6">
      {/* Title & Action Buttons */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold text-brand-brown dark:text-brand-cream">
              {t.credit.creditTitle || (lang === 'bn' ? 'হালখাতা বাকি খাতা ও এসএমএস তাগাদা' : 'Customer Credit & SMS Reminders')}
            </h1>
          </div>
          <p className="text-sm text-brand-brown/70 dark:text-brand-cream/70 mt-1">
            {lang === 'bn'
              ? 'গ্রাহকদের বাকির হিসাব রাখা ও সময়মতো স্বয়ংক্রিয় এসএমএস তাগাদা পাঠানো'
              : 'Track dues and send friendly automated SMS payment reminders'}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button
            onClick={handleBulkSmsRemindAll}
            className="bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 dark:bg-amber-950/60 dark:text-amber-200 dark:border-amber-700 font-bold flex items-center gap-2 px-4 py-2.5 rounded-xl shadow-sm transition-all"
            title={lang === 'bn' ? 'সকল অনাদায়ী বাকিদারকে এক ক্লিকে এসএমএস পাঠান' : 'Send SMS to all unpaid credits'}
          >
            <MessageSquare className="w-4 h-4 text-brand-orange" />
            <span>{lang === 'bn' ? 'সকলকে এসএমএস তাগাদা' : 'Bulk SMS Reminder'}</span>
          </Button>

          <Button
            onClick={handleOpenAddModal}
            className="bg-brand-yellow hover:bg-brand-orange text-brand-brown font-bold flex items-center gap-2 px-5 py-2.5 rounded-xl shadow-sm"
          >
            <Plus className="w-5 h-5" />
            <span>{t.credit.addCredit}</span>
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Total Outstanding */}
        <Card className="p-4 border-l-4 border-l-amber-500">
          <span className="text-xs font-bold uppercase text-brand-brown/70 dark:text-brand-cream/70">
            {t.credit.totalCredit}
          </span>
          <div className="text-2xl font-bold text-amber-600 mt-1">
            <AnimatedNumber value={stats.totalOutstanding} isCurrency />
          </div>
          <span className="text-xs text-brand-brown/60 dark:text-brand-cream/60 mt-0.5 block">
            {lang === 'bn' ? 'মোট অনাদায়ী বাকি' : 'Total unpaid balance'}
          </span>
        </Card>

        {/* Overdue Amount */}
        <Card className="p-4 border-l-4 border-l-red-500">
          <span className="text-xs font-bold uppercase text-brand-brown/70 dark:text-brand-cream/70">
            {t.credit.overdueCredits}
          </span>
          <div className="text-2xl font-bold text-red-600 mt-1">
            <AnimatedNumber value={stats.overdueAmount} isCurrency />
          </div>
          <span className="text-xs text-red-700 dark:text-red-400 mt-0.5 block">
            {formatNum(stats.overdueCount)} {lang === 'bn' ? 'জনের সময় পার হয়েছে' : 'overdue customers'}
          </span>
        </Card>

        {/* Total Paid */}
        <Card className="p-4 border-l-4 border-l-green-500">
          <span className="text-xs font-bold uppercase text-brand-brown/70 dark:text-brand-cream/70">
            {lang === 'bn' ? 'পরিশোধিত বাকি' : 'Total Paid Repayments'}
          </span>
          <div className="text-2xl font-bold text-green-600 mt-1">
            <AnimatedNumber value={stats.totalPaid} isCurrency />
          </div>
          <span className="text-xs text-green-700 dark:text-green-400 mt-0.5 block">
            {lang === 'bn' ? 'আদায়কৃত মোট টাকা' : 'Successfully collected'}
          </span>
        </Card>
      </div>

      {/* Search & Tabs */}
      <Card className="p-4 space-y-3">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-brand-brown/50" />
            <input
              type="text"
              placeholder={lang === 'bn' ? 'গ্রাহকের নাম বা ফোন নম্বর খুঁজুন...' : 'Search customer name or phone...'}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border border-[#F0D080] dark:border-[#4D2A00] bg-white dark:bg-[#1a0f07] focus:ring-2 focus:ring-brand-yellow"
            />
          </div>

          <div className="flex items-center gap-1 w-full sm:w-auto">
            <button
              onClick={() => setFilterPaid('unpaid')}
              className={`flex-1 sm:flex-none px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
                filterPaid === 'unpaid'
                  ? 'bg-brand-yellow text-brand-brown shadow-sm'
                  : 'bg-white dark:bg-[#1a0f07] text-brand-brown/70 border border-[#F0D080]/60'
              }`}
            >
              {lang === 'bn' ? 'বাকি রয়েছে' : 'Unpaid'}
            </button>
            <button
              onClick={() => setFilterPaid('paid')}
              className={`flex-1 sm:flex-none px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
                filterPaid === 'paid'
                  ? 'bg-brand-yellow text-brand-brown shadow-sm'
                  : 'bg-white dark:bg-[#1a0f07] text-brand-brown/70 border border-[#F0D080]/60'
              }`}
            >
              {lang === 'bn' ? 'পরিশোধিত' : 'Paid'}
            </button>
            <button
              onClick={() => setFilterPaid('all')}
              className={`flex-1 sm:flex-none px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
                filterPaid === 'all'
                  ? 'bg-brand-yellow text-brand-brown shadow-sm'
                  : 'bg-white dark:bg-[#1a0f07] text-brand-brown/70 border border-[#F0D080]/60'
              }`}
            >
              {lang === 'bn' ? 'সকল' : 'All'}
            </button>
          </div>
        </div>
      </Card>

      {/* Credit Records List */}
      {filteredCredits.length === 0 ? (
        <EmptyState
          icon={CreditCard}
          title={lang === 'bn' ? 'কোনো বাকির তথ্য নেই' : 'No credit records found'}
          description={
            lang === 'bn'
              ? 'গ্রাহকদের বাকির হিসাব রাখতে ও এসএমএস পাঠাতে নতুন এন্ট্রি যোগ করুন।'
              : 'Add customer credit entries to manage dues and reminders.'
          }
          action={{
            label: t.credit.addCredit,
            onClick: handleOpenAddModal,
          }}
        />
      ) : (
        <Stagger className="space-y-3">
          {filteredCredits.map((c) => {
            const isOverdue =
              !c.isPaid && c.dueDate && isBefore(parseISO(c.dueDate), new Date())

            const content = (
              <Card
                className={`p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all w-full ${
                  isOverdue ? 'border-l-4 border-l-red-500 bg-red-50/10' : ''
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-brand-cream/80 dark:bg-[#2e1c0d] flex items-center justify-center text-brand-brown dark:text-brand-cream flex-shrink-0 mt-0.5">
                    <User className="w-5 h-5 text-brand-orange" />
                  </div>

                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-bold text-base text-brand-brown dark:text-brand-cream">
                        {c.customerName}
                      </h3>

                      {c.customerPhone && (
                        <span className="text-xs text-brand-brown/70 dark:text-brand-cream/70 flex items-center gap-1">
                          <Phone className="w-3 h-3 text-brand-orange" />
                          <span>{c.customerPhone}</span>
                        </span>
                      )}

                      {c.isPaid ? (
                        <div className="flex items-center gap-1.5">
                          <CheckDraw />
                          <Badge variant="success">
                            {lang === 'bn' ? 'পরিশোধিত' : 'Paid'}
                          </Badge>
                        </div>
                      ) : isOverdue ? (
                        <Badge variant="danger">
                          {lang === 'bn' ? 'সময় পার হয়েছে' : 'Overdue'}
                        </Badge>
                      ) : (
                        <Badge variant="warning">
                          {lang === 'bn' ? 'বাকি' : 'Pending'}
                        </Badge>
                      )}

                      {c.smsCount && c.smsCount > 0 ? (
                        <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-blue-100 text-blue-800 dark:bg-blue-950/70 dark:text-blue-300 flex items-center gap-1">
                          <MessageSquare className="w-3 h-3" />
                          <span>
                            {lang === 'bn'
                              ? `এসএমএস পাঠানো হয়েছে (${formatNum(c.smsCount)} বার)`
                              : `SMS sent (${c.smsCount}x)`}
                          </span>
                        </span>
                      ) : null}
                    </div>

                    {c.description && (
                      <p className="text-xs text-brand-brown/70 dark:text-brand-cream/70 mt-1">
                        {c.description}
                      </p>
                    )}

                    <div className="flex items-center gap-3 text-xs text-brand-brown/60 dark:text-brand-cream/60 mt-1.5 flex-wrap">
                      <span>
                        {lang === 'bn' ? 'তারিখ' : 'Date'}:{' '}
                        {new Date(c.createdAt).toLocaleDateString()}
                      </span>
                      {c.dueDate && (
                        <>
                          <span>•</span>
                          <span className={isOverdue ? 'text-red-600 font-bold' : ''}>
                            {t.credit.dueDate}: {c.dueDate}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Amount & Actions */}
                <div className="flex items-center justify-between md:justify-end gap-3 border-t md:border-t-0 pt-3 md:pt-0">
                  <div className="text-left md:text-right">
                    <span className="text-xs text-brand-brown/60 dark:text-brand-cream/60 block">
                      {t.credit.amount}
                    </span>
                    <span
                      className={`text-xl font-extrabold ${
                        c.isPaid ? 'text-green-600' : 'text-brand-brown dark:text-brand-cream'
                      }`}
                    >
                      {formatCurrency(c.amount)}
                    </span>
                  </div>

                  {!c.isPaid && (
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        onClick={() => handleOpenSmsModal(c)}
                        className="bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 dark:bg-amber-950/50 dark:text-amber-200 font-bold text-xs flex items-center gap-1.5 px-3 py-2 rounded-xl shadow-sm whitespace-nowrap"
                        title={lang === 'bn' ? 'এসএমএস তাগাদা ড্রাফট করুন' : 'Send SMS reminder'}
                      >
                        <MessageSquare className="w-3.5 h-3.5 text-brand-orange" />
                        <span>{lang === 'bn' ? 'এসএমএস পাঠান' : 'SMS'}</span>
                      </Button>

                      <Button
                        size="sm"
                        onClick={() => handleMarkPaid(c.id)}
                        className="bg-brand-yellow hover:bg-brand-orange text-brand-brown font-bold text-xs flex items-center gap-1.5 px-3.5 py-2 shadow-sm whitespace-nowrap"
                      >
                        <Check className="w-4 h-4" />
                        <span>{t.credit.markPaid}</span>
                      </Button>
                    </div>
                  )}
                </div>
              </Card>
            )

            return (
              <div key={c.id}>
                {!c.isPaid ? (
                  <SwipeRow
                    onSwipeRight={() => handleMarkPaid(c.id)}
                    onSwipeLeft={() => handleOpenSmsModal(c)}
                    rightLabel={lang === 'bn' ? 'পরিশোধিত করুন' : 'Mark Paid'}
                    leftLabel={lang === 'bn' ? 'এসএমএস পাঠান' : 'Send SMS'}
                  >
                    {content}
                  </SwipeRow>
                ) : (
                  content
                )}
              </div>
            )
          })}
        </Stagger>
      )}

      {/* SMS Reminder Modal */}
      <Modal
        isOpen={isSmsModalOpen}
        onClose={() => setIsSmsModalOpen(false)}
        title={lang === 'bn' ? '📱 বকেয়া পরিশোধের এসএমএস তাগাদা' : '📱 SMS Payment Reminder'}
      >
        {selectedCreditForSms && (
          <div className="space-y-4">
            <div className="p-3 bg-amber-50 dark:bg-amber-950/40 rounded-xl border border-amber-200 dark:border-amber-800 text-xs text-brand-brown dark:text-brand-cream">
              <div className="flex justify-between items-center font-bold text-sm">
                <span>{selectedCreditForSms.customerName}</span>
                <span className="text-brand-orange">{formatCurrency(selectedCreditForSms.amount)}</span>
              </div>
              {selectedCreditForSms.dueDate && (
                <div className="text-xs text-brand-brown/70 mt-1">
                  পরিশোধের নির্ধারিত তারিখ: {selectedCreditForSms.dueDate}
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-brand-brown dark:text-brand-cream mb-1">
                {lang === 'bn' ? 'গ্রাহকের মোবাইল নম্বর' : 'Customer Phone Number'}
              </label>
              <input
                type="text"
                value={smsPhone}
                onChange={(e) => setSmsPhone(e.target.value)}
                placeholder="e.g. 01712345678"
                className="w-full px-3 py-2 rounded-xl border border-[#F0D080] dark:border-[#4D2A00] bg-white dark:bg-[#1a0f07] text-sm focus:ring-2 focus:ring-brand-yellow font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-brand-brown dark:text-brand-cream mb-1">
                {lang === 'bn' ? 'মেসেজের ধরন' : 'Message Tone'}
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => handleToneChange('friendly')}
                  className={`p-2 rounded-xl text-xs font-semibold text-center transition-all ${
                    smsTone === 'friendly'
                      ? 'bg-brand-yellow text-brand-brown border-2 border-brand-orange font-bold'
                      : 'bg-surface-light dark:bg-surface-dark border border-border text-text'
                  }`}
                >
                  🤝 বিনীত ও প্রীতিমূলক
                </button>
                <button
                  type="button"
                  onClick={() => handleToneChange('urgent')}
                  className={`p-2 rounded-xl text-xs font-semibold text-center transition-all ${
                    smsTone === 'urgent'
                      ? 'bg-red-500 text-white font-bold'
                      : 'bg-surface-light dark:bg-surface-dark border border-border text-text'
                  }`}
                >
                  ⚠️ জরুরি তাগাদা
                </button>
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-xs font-bold text-brand-brown dark:text-brand-cream">
                  {lang === 'bn' ? 'এসএমএস বার্তা প্রিভিউ' : 'SMS Text Preview'}
                </label>
                <button
                  type="button"
                  onClick={handleCopySms}
                  className="text-xs text-brand-orange hover:underline flex items-center gap-1 font-semibold"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>{lang === 'bn' ? 'কপি করুন' : 'Copy'}</span>
                </button>
              </div>
              <textarea
                rows={4}
                value={smsCustomText}
                onChange={(e) => setSmsCustomText(e.target.value)}
                className="w-full p-3 rounded-xl border border-[#F0D080] dark:border-[#4D2A00] bg-white dark:bg-[#1a0f07] text-xs leading-relaxed focus:ring-2 focus:ring-brand-yellow"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
              <Button type="button" variant="outline" onClick={() => setIsSmsModalOpen(false)}>
                {t.common.cancel}
              </Button>
              <Button
                type="button"
                onClick={handleSendSms}
                className="bg-brand-yellow hover:bg-brand-orange text-brand-brown font-bold flex items-center gap-2"
              >
                <Send className="w-4 h-4" />
                <span>{lang === 'bn' ? 'এসএমএস পাঠান ও রেকর্ড করুন' : 'Send & Record SMS'}</span>
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Add Credit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={t.credit.addCredit}
      >
        <form onSubmit={handleSaveCredit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-brand-brown dark:text-brand-cream mb-1">
              {t.credit.customerName} *
            </label>
            <input
              type="text"
              required
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="e.g. করিম সাহেব (Karim)"
              className="w-full px-3 py-2 rounded-xl border border-[#F0D080] dark:border-[#4D2A00] bg-white dark:bg-[#1a0f07] text-sm focus:ring-2 focus:ring-brand-yellow"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-brand-brown dark:text-brand-cream mb-1">
              {lang === 'bn' ? 'মোবাইল নম্বর (এসএমএস তাগাদার জন্য)' : 'Mobile Phone (For SMS Reminders)'}
            </label>
            <input
              type="text"
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
              placeholder="e.g. 01712-345678"
              className="w-full px-3 py-2 rounded-xl border border-[#F0D080] dark:border-[#4D2A00] bg-white dark:bg-[#1a0f07] text-sm focus:ring-2 focus:ring-brand-yellow font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-brand-brown dark:text-brand-cream mb-1">
              {t.credit.amount} (৳) *
            </label>
            <input
              type="number"
              required
              min="1"
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
              className="w-full px-3 py-2 rounded-xl border border-[#F0D080] dark:border-[#4D2A00] bg-white dark:bg-[#1a0f07] text-sm focus:ring-2 focus:ring-brand-yellow"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-brand-brown dark:text-brand-cream mb-1">
              {lang === 'bn' ? 'বিবরণ (পণ্য ইত্যাদি)' : 'Description (Items)'}
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. চাল ও তেলের বাকি"
              className="w-full px-3 py-2 rounded-xl border border-[#F0D080] dark:border-[#4D2A00] bg-white dark:bg-[#1a0f07] text-sm focus:ring-2 focus:ring-brand-yellow"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-brand-brown dark:text-brand-cream mb-1">
              {t.credit.dueDate} ({lang === 'bn' ? 'ঐচ্ছিক' : 'Optional'})
            </label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-[#F0D080] dark:border-[#4D2A00] bg-white dark:bg-[#1a0f07] text-sm focus:ring-2 focus:ring-brand-yellow"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-3">
            <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>
              {t.common.cancel}
            </Button>
            <Button type="submit" variant="primary">
              {t.common.save}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
