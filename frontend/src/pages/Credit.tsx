// Smart Digital Ledger & Khata Management (Section 4.2) with Customer Credit & SMS Reminders
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
  Building2,
  DollarSign,
  TrendingDown,
  TrendingUp,
  Receipt,
  FileText,
  Wallet,
  ArrowDownLeft,
  ArrowUpRight,
  Filter,
} from 'lucide-react'
import { isBefore, parseISO } from 'date-fns'
import { useLang } from '@/i18n'
import { useShopContext } from '@/hooks/useShopContext'
import { useCredits, useSales } from '@/db/hooks'
import { addCredit, markCreditPaid, updateCredit, addSale } from '@/db/mutations'
import { calcCreditStats } from '@/engines/credit'
import { Card, Button, Badge, Modal, EmptyState } from '@/components/ui'
import { AnimatedNumber, SwipeRow, CheckDraw, Stagger, showSaveToast } from '@/components/motion'
import {
  formatCustomerSmsReminder,
  INITIAL_EXPENSES,
  INITIAL_SUPPLIER_DUES,
} from '@/mock/haalkhataFeatures'
import type { Credit, Expense, SupplierDue } from '@/types'

export default function CreditPage() {
  const { t, lang, formatNum, formatCurrency } = useLang()
  const { currentShop } = useShopContext()

  const shopId = currentShop?.id || 'shop-student-01'
  const rawCredits = useCredits(shopId) as Credit[] | undefined
  const rawSales = useSales(shopId, 30)
  const credits = rawCredits || []
  const sales = rawSales || []

  // Sub-tab: 1. Customer Credit, 2. Supplier Khata, 3. Cash Book & Expenses, 4. Customer Statement
  const [ledgerTab, setLedgerTab] = useState<'customer' | 'supplier' | 'cashbook' | 'statement'>('customer')

  const [searchQuery, setSearchQuery] = useState('')
  const [filterPaid, setFilterPaid] = useState<'all' | 'unpaid' | 'paid'>('unpaid')
  const [isModalOpen, setIsModalOpen] = useState(false)

  // Form states for Add Credit
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [amount, setAmount] = useState<number>(500)
  const [description, setDescription] = useState('')
  const [dueDate, setDueDate] = useState('')

  // Partial Payment Modal State
  const [isPayModalOpen, setIsPayModalOpen] = useState(false)
  const [selectedCreditForPay, setSelectedCreditForPay] = useState<Credit | null>(null)
  const [partialPayAmount, setPartialPayAmount] = useState<number>(0)

  // SMS Modal State
  const [isSmsModalOpen, setIsSmsModalOpen] = useState(false)
  const [selectedCreditForSms, setSelectedCreditForSms] = useState<Credit | null>(null)
  const [smsPhone, setSmsPhone] = useState('')
  const [smsTone, setSmsTone] = useState<'friendly' | 'urgent'>('friendly')
  const [smsCustomText, setSmsCustomText] = useState('')

  // Supplier Ledger State
  const [supplierDues, setSupplierDues] = useState<SupplierDue[]>(INITIAL_SUPPLIER_DUES)
  const [isSupplierPayModalOpen, setIsSupplierPayModalOpen] = useState(false)
  const [selectedSupplier, setSelectedSupplier] = useState<SupplierDue | null>(null)
  const [supplierPayAmount, setSupplierPayAmount] = useState<number>(0)

  // Cash Book & Expense State
  const [expenses, setExpenses] = useState<Expense[]>(() => {
    try {
      const saved = localStorage.getItem('haalkhata_expenses')
      return saved ? JSON.parse(saved) : INITIAL_EXPENSES
    } catch {
      return INITIAL_EXPENSES
    }
  })
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false)
  const [expTitle, setExpTitle] = useState('')
  const [expCategory, setExpCategory] = useState<Expense['category']>('rent')
  const [expAmount, setExpAmount] = useState<number>(500)
  const [expNote, setExpNote] = useState('')

  const stats = useMemo(() => calcCreditStats(credits), [credits])

  // Customer Filtered Credits
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

  // Supplier Metrics
  const totalSupplierPayable = useMemo(() => {
    return supplierDues.reduce((sum, s) => sum + (s.amount - s.paidAmount), 0)
  }, [supplierDues])

  // Cash Book Metrics (Today's Cash In vs Cash Out)
  const totalExpensesSum = useMemo(() => {
    return expenses.reduce((sum, e) => sum + e.amount, 0)
  }, [expenses])

  const totalCashSalesSum = useMemo(() => {
    return sales.reduce((sum, s: any) => sum + Number((s.totalAmount ?? s.totalPrice ?? s.quantity * (s.pricePerUnit || 0)) || 0), 0)
  }, [sales])

  const netCashBalance = totalCashSalesSum - totalExpensesSum

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

  // Open Partial Payment Modal
  const handleOpenPaymentModal = (c: Credit) => {
    setSelectedCreditForPay(c)
    setPartialPayAmount(c.amount)
    setIsPayModalOpen(true)
  }

  // Record Partial or Complete Payment
  const handleConfirmCustomerPayment = async () => {
    if (!selectedCreditForPay || partialPayAmount <= 0) return

    if (partialPayAmount >= selectedCreditForPay.amount) {
      // Complete payment
      await markCreditPaid(selectedCreditForPay.id)
      showSaveToast(lang === 'bn' ? 'সম্পূর্ণ বকেয়া পরিশোধ সম্পন্ন হয়েছে ✓' : 'Payment completed in full ✓')
    } else {
      // Partial payment: subtract amount and update
      const remaining = selectedCreditForPay.amount - partialPayAmount
      await updateCredit(selectedCreditForPay.id, {
        amount: remaining,
        note: `আংশিক পরিশোধ: ৳${partialPayAmount} (অবশিষ্ট: ৳${remaining})`,
      })
      showSaveToast(
        lang === 'bn'
          ? `আংশিক পরিশোধ ৳${partialPayAmount} জমা হয়েছে (বাকি: ৳${remaining}) ✓`
          : `Partial payment of ৳${partialPayAmount} recorded ✓`
      )
    }

    // Also record cash in sales ledger
    await addSale({
      shopId,
      quantity: 1,
      pricePerUnit: partialPayAmount,
      soldAt: new Date().toISOString(),
      paymentMethod: 'cash',
      totalAmount: partialPayAmount,
    })

    setIsPayModalOpen(false)
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
        ? `${unpaid.length} জন বকেয়া গ্রাহকের জন্য এসএমএস তাগাদা পাঠানো হয়েছে ✓`
        : `Sent SMS reminders to ${unpaid.length} customers ✓`
    )
  }

  // Supplier Payment Handler
  const handleRecordSupplierPayment = () => {
    if (!selectedSupplier || supplierPayAmount <= 0) return

    setSupplierDues((prev) =>
      prev.map((s) => {
        if (s.id !== selectedSupplier.id) return s
        const newPaid = s.paidAmount + supplierPayAmount
        const status = newPaid >= s.amount ? ('paid' as const) : ('partial' as const)
        return { ...s, paidAmount: newPaid, status, updatedAt: new Date().toISOString() }
      })
    )

    showSaveToast(
      lang === 'bn'
        ? `${selectedSupplier.companyName}-কে ৳${supplierPayAmount} পরিশোধ রেকর্ড হয়েছে ✓`
        : `Recorded supplier payment of ৳${supplierPayAmount} ✓`
    )
    setIsSupplierPayModalOpen(false)
  }

  // Add Expense Handler
  const handleSaveExpense = (e: React.FormEvent) => {
    e.preventDefault()
    if (!expTitle.trim() || expAmount <= 0) return

    const newExp: Expense = {
      id: `exp-${Date.now()}`,
      shopId,
      title: expTitle.trim(),
      category: expCategory,
      amount: Number(expAmount),
      date: new Date().toISOString().slice(0, 10),
      note: expNote.trim(),
      createdAt: new Date().toISOString(),
    }

    setExpenses((prev) => {
      const next = [newExp, ...prev]
      try {
        localStorage.setItem('haalkhata_expenses', JSON.stringify(next))
      } catch (e) {
        console.warn(e)
      }
      return next
    })
    setIsExpenseModalOpen(false)
    setExpTitle('')
    setExpNote('')
    showSaveToast(lang === 'bn' ? 'দোকান খরচ সফলভাবে সংরক্ষিত হয়েছে ✓' : 'Expense recorded ✓')
  }

  return (
    <div className="space-y-6">
      {/* Title & Action Buttons */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold text-brand-brown dark:text-brand-cream">
              {lang === 'bn'
                ? '📒 হালখাতা স্মার্ট ডিজিটাল লেজার ও খাতা'
                : '📒 Haalkhata Smart Digital Ledger'}
            </h1>
          </div>
          <p className="text-sm text-brand-brown/70 dark:text-brand-cream/70 mt-1">
            {lang === 'bn'
              ? 'দৈনিক বিক্রি, কাস্টমার বাকি, মহাজন ও সাপ্লায়ার দেনা-পাওনা এবং ক্যাশ বুকের সমন্বিত হিসাব'
              : 'Unified ledger for sales, customer dues, supplier payables, and daily cashbook'}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {ledgerTab === 'customer' && (
            <>
              <Button
                onClick={handleBulkSmsRemindAll}
                className="bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 dark:bg-amber-950/60 dark:text-amber-200 dark:border-amber-700 font-bold flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl shadow-sm text-xs"
              >
                <MessageSquare className="w-4 h-4 text-brand-orange" />
                <span>{lang === 'bn' ? 'সকলকে এসএমএস তাগাদা' : 'Bulk SMS'}</span>
              </Button>

              <Button
                onClick={handleOpenAddModal}
                className="bg-brand-yellow hover:bg-brand-orange text-brand-brown font-bold flex items-center gap-1.5 px-4 py-2.5 rounded-xl shadow-sm text-xs sm:text-sm"
              >
                <Plus className="w-4 h-4" />
                <span>{t.credit.addCredit}</span>
              </Button>
            </>
          )}

          {ledgerTab === 'cashbook' && (
            <Button
              onClick={() => setIsExpenseModalOpen(true)}
              className="bg-brand-yellow hover:bg-brand-orange text-brand-brown font-bold flex items-center gap-1.5 px-4 py-2.5 rounded-xl shadow-sm text-xs"
            >
              <TrendingDown className="w-4 h-4 text-red-600" />
              <span>{lang === 'bn' ? 'নতুন খরচ লিখুন' : 'Add Expense'}</span>
            </Button>
          )}
        </div>
      </div>

      {/* KPI Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 sm:gap-4">
        {/* Total Outstanding Customer Credit */}
        <Card className="p-4 border-l-4 border-l-amber-500">
          <span className="text-xs font-bold uppercase text-brand-brown/70 dark:text-brand-cream/70">
            {lang === 'bn' ? 'মোট কাস্টমার বাকি' : 'Customer Dues'}
          </span>
          <div className="text-2xl font-bold text-amber-600 mt-1">
            <AnimatedNumber value={stats.totalOutstanding} isCurrency />
          </div>
          <span className="text-xs text-brand-brown/60 dark:text-brand-cream/60 mt-0.5 block">
            {formatNum(stats.unpaidCount)} {lang === 'bn' ? 'জন গ্রাহকের কাছে পাওনা' : 'unpaid customers'}
          </span>
        </Card>

        {/* Total Supplier Payables */}
        <Card className="p-4 border-l-4 border-l-red-500">
          <span className="text-xs font-bold uppercase text-brand-brown/70 dark:text-brand-cream/70">
            {lang === 'bn' ? 'মহাজন ও ডিলার দেনা' : 'Supplier Payables'}
          </span>
          <div className="text-2xl font-bold text-red-600 mt-1">
            ৳{formatNum(totalSupplierPayable)}
          </div>
          <span className="text-xs text-red-700 dark:text-red-400 mt-0.5 block">
            {formatNum(supplierDues.filter((s) => s.status !== 'paid').length)} টি ডিলার চালান বাকি
          </span>
        </Card>

        {/* Total Daily Cash Sales In */}
        <Card className="p-4 border-l-4 border-l-green-500">
          <span className="text-xs font-bold uppercase text-brand-brown/70 dark:text-brand-cream/70">
            {lang === 'bn' ? 'মোট ক্যাশ বিক্রি (In)' : 'Total Cash In'}
          </span>
          <div className="text-2xl font-bold text-green-600 mt-1">
            ৳{formatNum(totalCashSalesSum)}
          </div>
          <span className="text-xs text-green-700 dark:text-green-400 mt-0.5 block">
            নগদ বিক্রয় ও আদায়
          </span>
        </Card>

        {/* Net Cash in Hand */}
        <Card className="p-4 border-l-4 border-l-blue-500">
          <span className="text-xs font-bold uppercase text-brand-brown/70 dark:text-brand-cream/70">
            {lang === 'bn' ? 'নিট ক্যাশ উদ্বৃত্ত' : 'Net Cash in Hand'}
          </span>
          <div className="text-2xl font-bold text-blue-600 mt-1">
            ৳{formatNum(Math.max(0, netCashBalance))}
          </div>
          <span className="text-xs text-brand-brown/60 dark:text-brand-cream/60 mt-0.5 block">
            বিক্রি থেকে খরচ বাদ
          </span>
        </Card>
      </div>

      {/* 4 Tabs of the Digital Ledger */}
      <div className="flex items-center gap-2 border-b border-border pb-2 overflow-x-auto">
        <button
          onClick={() => setLedgerTab('customer')}
          className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-1.5 whitespace-nowrap transition-all ${
            ledgerTab === 'customer'
              ? 'bg-brand-yellow text-brand-brown shadow-sm'
              : 'text-text-secondary hover:text-text hover:bg-background-secondary'
          }`}
        >
          <User className="w-4 h-4 text-brand-orange" />
          <span>{lang === 'bn' ? 'কাস্টমার বাকি খাতা ও এসএমএস' : 'Customer Credit Khata'}</span>
          <span className="px-1.5 py-0.2 rounded-full bg-black/10 dark:bg-white/10 text-[10px]">
            {formatNum(credits.length)}
          </span>
        </button>

        <button
          onClick={() => setLedgerTab('supplier')}
          className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-1.5 whitespace-nowrap transition-all ${
            ledgerTab === 'supplier'
              ? 'bg-brand-yellow text-brand-brown shadow-sm'
              : 'text-text-secondary hover:text-text hover:bg-background-secondary'
          }`}
        >
          <Building2 className="w-4 h-4 text-blue-600" />
          <span>{lang === 'bn' ? 'মহাজন ও সাপ্লায়ার খাতা' : 'Supplier Dues Khata'}</span>
          <span className="px-1.5 py-0.2 rounded-full bg-red-100 text-red-800 text-[10px]">
            {formatNum(supplierDues.length)}
          </span>
        </button>

        <button
          onClick={() => setLedgerTab('cashbook')}
          className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-1.5 whitespace-nowrap transition-all ${
            ledgerTab === 'cashbook'
              ? 'bg-brand-yellow text-brand-brown shadow-sm'
              : 'text-text-secondary hover:text-text hover:bg-background-secondary'
          }`}
        >
          <Wallet className="w-4 h-4 text-green-600" />
          <span>{lang === 'bn' ? 'ক্যাশ বুক ও দোকান খরচ' : 'Cash Book & Expenses'}</span>
        </button>

        <button
          onClick={() => setLedgerTab('statement')}
          className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-1.5 whitespace-nowrap transition-all ${
            ledgerTab === 'statement'
              ? 'bg-brand-yellow text-brand-brown shadow-sm'
              : 'text-text-secondary hover:text-text hover:bg-background-secondary'
          }`}
        >
          <FileText className="w-4 h-4 text-purple-600" />
          <span>{lang === 'bn' ? 'গ্রাহক খতিয়ান হিস্ট্রি' : 'Customer Statement'}</span>
        </button>
      </div>

      {/* ─── TAB 1: CUSTOMER CREDIT & SMS KHATA ──────────────────────────────── */}
      {ledgerTab === 'customer' && (
        <div className="space-y-4">
          {/* Search & Status Filters */}
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

          {/* Records List */}
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
                        <div className="flex items-center gap-1.5">
                          <Button
                            size="sm"
                            onClick={() => handleOpenSmsModal(c)}
                            className="bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 dark:bg-amber-950/50 dark:text-amber-200 font-bold text-xs flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl shadow-sm whitespace-nowrap"
                            title="এসএমএস পাঠান"
                          >
                            <MessageSquare className="w-3.5 h-3.5 text-brand-orange" />
                            <span>{lang === 'bn' ? 'এসএমএস' : 'SMS'}</span>
                          </Button>

                          <Button
                            size="sm"
                            onClick={() => handleOpenPaymentModal(c)}
                            className="bg-brand-yellow hover:bg-brand-orange text-brand-brown font-bold text-xs flex items-center gap-1.5 px-3 py-1.5 shadow-sm whitespace-nowrap"
                          >
                            <Check className="w-4 h-4" />
                            <span>{lang === 'bn' ? 'পরিশোধ লিখুন' : 'Pay'}</span>
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
                        onSwipeRight={() => handleOpenPaymentModal(c)}
                        onSwipeLeft={() => handleOpenSmsModal(c)}
                        rightLabel={lang === 'bn' ? 'পরিশোধ' : 'Pay'}
                        leftLabel={lang === 'bn' ? 'এসএমএস' : 'SMS'}
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
        </div>
      )}

      {/* ─── TAB 2: SUPPLIER & DISTRIBUTOR KHATA ─────────────────────────────── */}
      {ledgerTab === 'supplier' && (
        <div className="space-y-4">
          <Card className="p-4 bg-gradient-to-r from-blue-500/10 via-indigo-500/5 to-transparent border border-blue-300">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-extrabold text-base text-blue-900 dark:text-blue-100">
                  মহাজন ও প্রস্তুতকারক ডিস্ট্রিবিউটর পাওনা ট্র্যাকিং
                </h3>
                <p className="text-xs text-blue-800/80 dark:text-blue-200/80 mt-0.5">
                  কোম্পানির ডিলারের চালান, পরিশোধ ও বকেয়া পাওনার হিসাব এক নজরে।
                </p>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-brand-brown/60 block">মোট ডিলার দেনা</span>
                <span className="text-lg font-black text-red-600">৳{formatNum(totalSupplierPayable)}</span>
              </div>
            </div>
          </Card>

          <div className="space-y-3">
            {supplierDues.map((sup) => {
              const remaining = sup.amount - sup.paidAmount
              const isFullyPaid = sup.status === 'paid' || remaining <= 0

              return (
                <Card key={sup.id} className="p-4 border-l-4 border-l-blue-600">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-extrabold text-base text-text">{sup.companyName}</h4>
                        <span className="text-xs text-brand-orange font-semibold">({sup.supplierName})</span>
                        {isFullyPaid ? (
                          <Badge variant="success">পরিশোধিত ✓</Badge>
                        ) : sup.status === 'partial' ? (
                          <Badge variant="warning">আংশিক পরিশোধ</Badge>
                        ) : (
                          <Badge variant="danger">অনাদায়ী চালান</Badge>
                        )}
                      </div>

                      <p className="text-xs text-brand-brown/70 dark:text-brand-cream/70 mt-1">
                        {sup.note} {sup.dueDate ? `• পরিশোধের মেয়াদ: ${sup.dueDate}` : ''}
                      </p>
                    </div>

                    <div className="flex items-center justify-between md:justify-end gap-4 border-t md:border-t-0 pt-2 md:pt-0">
                      <div className="text-left md:text-right text-xs">
                        <span className="text-brand-brown/60 block text-[10px]">মোট চালান / বকেয়া</span>
                        <div className="font-mono">
                          <span className="text-brand-brown font-bold">চালান: ৳{formatNum(sup.amount)}</span> •{' '}
                          <span className="text-green-600 font-bold">জমা: ৳{formatNum(sup.paidAmount)}</span>
                        </div>
                        <span className="text-red-600 font-extrabold text-sm block">
                          বাকি: ৳{formatNum(remaining)}
                        </span>
                      </div>

                      {!isFullyPaid && (
                        <Button
                          size="sm"
                          onClick={() => {
                            setSelectedSupplier(sup)
                            setSupplierPayAmount(remaining)
                            setIsSupplierPayModalOpen(true)
                          }}
                          className="bg-brand-yellow hover:bg-brand-orange text-brand-brown font-bold text-xs"
                        >
                          টাকা পরিশোধ
                        </Button>
                      )}
                    </div>
                  </div>
                </Card>
              )
            })}
          </div>
        </div>
      )}

      {/* ─── TAB 3: CASH BOOK & DAILY EXPENSES ──────────────────────────────── */}
      {ledgerTab === 'cashbook' && (
        <div className="space-y-4">
          {/* Summary Strip */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Card className="p-3.5 bg-green-50/50 dark:bg-green-950/30 border border-green-200">
              <span className="text-xs text-green-800 dark:text-green-300 font-bold flex items-center gap-1">
                <ArrowDownLeft className="w-4 h-4 text-green-600" />
                <span>মোট ক্যাশ প্রাপ্তি (Cash In)</span>
              </span>
              <div className="text-xl font-black text-green-700 dark:text-green-300 mt-1">
                +৳{formatNum(totalCashSalesSum)}
              </div>
            </Card>

            <Card className="p-3.5 bg-red-50/50 dark:bg-red-950/30 border border-red-200">
              <span className="text-xs text-red-800 dark:text-red-300 font-bold flex items-center gap-1">
                <ArrowUpRight className="w-4 h-4 text-red-600" />
                <span>মোট দোকান খরচ (Cash Out)</span>
              </span>
              <div className="text-xl font-black text-red-600 mt-1">
                -৳{formatNum(totalExpensesSum)}
              </div>
            </Card>

            <Card className="p-3.5 bg-blue-50/50 dark:bg-blue-950/30 border border-blue-200">
              <span className="text-xs text-blue-800 dark:text-blue-300 font-bold flex items-center gap-1">
                <Wallet className="w-4 h-4 text-blue-600" />
                <span>ক্যাশ ড্রয়ার নিট ব্যালেন্স</span>
              </span>
              <div className="text-xl font-black text-blue-600 mt-1">
                ৳{formatNum(netCashBalance)}
              </div>
            </Card>
          </div>

          {/* Expenses List */}
          <Card className="p-4">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <h3 className="font-extrabold text-sm text-text">দৈনিক দোকান খরচ খতিয়ান</h3>
              <Button
                size="sm"
                onClick={() => setIsExpenseModalOpen(true)}
                className="bg-brand-yellow hover:bg-brand-orange text-brand-brown font-bold text-xs"
              >
                + খরচ যোগ করুন
              </Button>
            </div>

            <div className="mt-3 divide-y divide-border">
              {expenses.map((exp) => (
                <div key={exp.id} className="py-2.5 flex items-center justify-between text-xs">
                  <div>
                    <span className="font-bold text-text block">{exp.title}</span>
                    <span className="text-[10px] text-brand-brown/60 dark:text-brand-cream/60">
                      তারিখ: {exp.date} {exp.note ? `• ${exp.note}` : ''}
                    </span>
                  </div>
                  <span className="font-bold text-red-600 text-sm">-৳{formatNum(exp.amount)}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {/* ─── TAB 4: CUSTOMER LEDGER STATEMENT ────────────────────────────────── */}
      {ledgerTab === 'statement' && (
        <div className="space-y-4">
          <Card className="p-4 bg-purple-50 dark:bg-purple-950/20 border border-purple-200">
            <div className="flex items-center gap-2 text-purple-900 dark:text-purple-200">
              <FileText className="w-5 h-5 text-purple-600" />
              <div>
                <h3 className="font-bold text-sm">গ্রাহকভিত্তিক খতিয়ান ও পেমেন্ট হিস্ট্রি</h3>
                <p className="text-xs text-purple-800/70 mt-0.5">
                  কোন কাস্টমার কত টাকা বাকি নিয়েছিলেন এবং কত টাকা পরিশোধ করেছেন তার স্বচ্ছ বিবরণ।
                </p>
              </div>
            </div>
          </Card>

          <div className="space-y-3">
            {Array.from(new Set(credits.map((c) => c.customerName))).map((custName) => {
              const custCredits = credits.filter((c) => c.customerName === custName)
              const totalTaken = custCredits.reduce((s, c) => s + c.amount, 0)
              const totalPaid = custCredits.filter((c) => c.isPaid).reduce((s, c) => s + c.amount, 0)
              const currentDue = totalTaken - totalPaid

              return (
                <Card key={custName} className="p-4 border-l-4 border-l-purple-500">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <h4 className="font-extrabold text-base text-text">{custName}</h4>
                      <p className="text-xs text-brand-brown/70 dark:text-brand-cream/70 mt-0.5">
                        মোট লেনদেন: {formatNum(custCredits.length)} বার
                      </p>
                    </div>

                    <div className="flex items-center gap-4 text-xs">
                      <div>
                        <span className="text-brand-brown/60 block text-[10px]">মোট বাকি নেওয়া</span>
                        <strong className="text-brand-brown font-mono">৳{formatNum(totalTaken)}</strong>
                      </div>
                      <div>
                        <span className="text-green-600 block text-[10px]">পরিশোধিত</span>
                        <strong className="text-green-600 font-mono">৳{formatNum(totalPaid)}</strong>
                      </div>
                      <div>
                        <span className="text-red-600 block text-[10px]">বর্তমান বকেয়া</span>
                        <strong className="text-red-600 font-mono font-black text-sm">৳{formatNum(currentDue)}</strong>
                      </div>
                    </div>
                  </div>
                </Card>
              )
            })}
          </div>
        </div>
      )}

      {/* ─── MODAL: PARTIAL / FULL REPAYMENT ─────────────────────────────────── */}
      <Modal
        isOpen={isPayModalOpen}
        onClose={() => setIsPayModalOpen(false)}
        title={lang === 'bn' ? '💵 বাকি পরিশোধ গ্রহণ' : '💵 Record Payment'}
      >
        {selectedCreditForPay && (
          <div className="space-y-4">
            <div className="p-3 bg-amber-50 dark:bg-amber-950/40 rounded-xl border border-amber-200 text-xs">
              <span className="text-brand-brown/60 block">গ্রাহকের নাম:</span>
              <strong className="text-sm text-brand-brown dark:text-brand-cream">{selectedCreditForPay.customerName}</strong>
              <div className="text-xs mt-1 text-brand-orange font-bold">
                বর্তমান মোট বকেয়া: {formatCurrency(selectedCreditForPay.amount)}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-brand-brown dark:text-brand-cream mb-1">
                পরিশোধের পরিমাণ (৳)
              </label>
              <input
                type="number"
                min="1"
                max={selectedCreditForPay.amount}
                value={partialPayAmount}
                onChange={(e) => setPartialPayAmount(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-xl border border-[#F0D080] dark:border-[#4D2A00] bg-white dark:bg-[#1a0f07] text-sm focus:ring-2 focus:ring-brand-yellow font-bold text-green-600"
              />
              <span className="text-[10px] text-brand-brown/60 mt-1 block">
                {partialPayAmount >= selectedCreditForPay.amount
                  ? '✓ সম্পূর্ণ পরিশোধ হিসেবে চিহ্নিত হবে'
                  : `অবশিষ্ট বকেয়া থাকবে: ৳${selectedCreditForPay.amount - partialPayAmount}`}
              </span>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
              <Button type="button" variant="outline" onClick={() => setIsPayModalOpen(false)}>
                বাতিল
              </Button>
              <Button
                type="button"
                onClick={handleConfirmCustomerPayment}
                className="bg-brand-yellow hover:bg-brand-orange text-brand-brown font-bold"
              >
                পরিশোধ সংরক্ষণ করুন
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* ─── MODAL: SUPPLIER PAYMENT ─────────────────────────────────────────── */}
      <Modal
        isOpen={isSupplierPayModalOpen}
        onClose={() => setIsSupplierPayModalOpen(false)}
        title="ডিলার / মহাজনকে টাকা পরিশোধ"
      >
        {selectedSupplier && (
          <div className="space-y-4">
            <div className="p-3 bg-blue-50 dark:bg-blue-950/40 rounded-xl border border-blue-200 text-xs">
              <strong className="text-sm text-text block">{selectedSupplier.companyName}</strong>
              <span className="text-brand-brown/70 block mt-0.5">{selectedSupplier.supplierName}</span>
              <div className="text-xs text-red-600 font-bold mt-1">
                বকেয়া বাকি: ৳{formatNum(selectedSupplier.amount - selectedSupplier.paidAmount)}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-brand-brown dark:text-brand-cream mb-1">
                পরিশোধের পরিমাণ (৳)
              </label>
              <input
                type="number"
                min="1"
                value={supplierPayAmount}
                onChange={(e) => setSupplierPayAmount(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-xl border border-border bg-card text-sm focus:ring-2 focus:ring-brand-yellow font-bold text-green-600"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
              <Button type="button" variant="outline" onClick={() => setIsSupplierPayModalOpen(false)}>
                বাতিল
              </Button>
              <Button
                type="button"
                onClick={handleRecordSupplierPayment}
                className="bg-brand-yellow hover:bg-brand-orange text-brand-brown font-bold"
              >
                পেমেন্ট রেকর্ড করুন
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* ─── MODAL: ADD EXPENSE ──────────────────────────────────────────────── */}
      <Modal
        isOpen={isExpenseModalOpen}
        onClose={() => setIsExpenseModalOpen(false)}
        title="দোকানের খরচ লিখুন"
      >
        <form onSubmit={handleSaveExpense} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-text mb-1">খরচের খাত *</label>
            <input
              type="text"
              required
              value={expTitle}
              onChange={(e) => setExpTitle(e.target.value)}
              placeholder="e.g. দোকান ভাড়া / বিদ্যুৎ বিল / চা নাস্তা"
              className="w-full px-3 py-2 rounded-xl border border-border bg-card text-sm focus:ring-2 focus:ring-brand-yellow"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-text mb-1">পরিমাণ (৳) *</label>
              <input
                type="number"
                min="1"
                required
                value={expAmount}
                onChange={(e) => setExpAmount(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-xl border border-border bg-card text-sm focus:ring-2 focus:ring-brand-yellow font-bold text-red-600"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-text mb-1">ক্যাটাগরি</label>
              <select
                value={expCategory}
                onChange={(e: any) => setExpCategory(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-border bg-card text-sm focus:ring-2 focus:ring-brand-yellow"
              >
                <option value="rent">ভাড়া</option>
                <option value="utility">বিদ্যুৎ / গ্যাস বিল</option>
                <option value="transport">পরিবহন / কুলি</option>
                <option value="salary">কর্মচারীর বেতন</option>
                <option value="snack">চা ও নাস্তা</option>
                <option value="other">অন্যান্য</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-text mb-1">মন্তব্য</label>
            <input
              type="text"
              value={expNote}
              onChange={(e) => setExpNote(e.target.value)}
              placeholder="ঐচ্ছিক নোট"
              className="w-full px-3 py-2 rounded-xl border border-border bg-card text-sm focus:ring-2 focus:ring-brand-yellow"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
            <Button type="button" variant="outline" onClick={() => setIsExpenseModalOpen(false)}>
              বাতিল
            </Button>
            <Button type="submit" className="bg-brand-yellow hover:bg-brand-orange text-brand-brown font-bold">
              সংরক্ষণ করুন
            </Button>
          </div>
        </form>
      </Modal>

      {/* ─── MODAL: SMS REMINDER ─────────────────────────────────────────────── */}
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
                  নির্ধারিত তারিখ: {selectedCreditForSms.dueDate}
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-brand-brown dark:text-brand-cream mb-1">
                গ্রাহকের মোবাইল নম্বর
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
                মেসেজের ধরন
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
                  এসএমএস বার্তা প্রিভিউ
                </label>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard?.writeText(smsCustomText)
                    showSaveToast('এসএমএস কপি করা হয়েছে ✓')
                  }}
                  className="text-xs text-brand-orange hover:underline flex items-center gap-1 font-semibold"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>কপি করুন</span>
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
                বাতিল
              </Button>
              <Button
                type="button"
                onClick={handleSendSms}
                className="bg-brand-yellow hover:bg-brand-orange text-brand-brown font-bold flex items-center gap-2"
              >
                <Send className="w-4 h-4" />
                <span>এসএমএস পাঠান ও রেকর্ড করুন</span>
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* ─── MODAL: ADD CREDIT ──────────────────────────────────────────────── */}
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
              মোবাইল নম্বর (এসএমএস তাগাদার জন্য)
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
              বিবরণ (পণ্য ইত্যাদি)
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
              {t.credit.dueDate} (ঐচ্ছিক)
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
