// Customer credit (বাকি) tracking page — simple and shopkeeper-friendly
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
} from 'lucide-react'
import { isBefore, parseISO } from 'date-fns'
import { useLang } from '@/i18n'
import { useShopContext } from '@/hooks/useShopContext'
import { useCredits } from '@/db/hooks'
import { addCredit, markCreditPaid, updateCredit } from '@/db/mutations'
import { calcCreditStats } from '@/engines/credit'
import { Card, Button, Badge, Modal, DemoBadge, EmptyState } from '@/components/ui'
import { AnimatedNumber, SwipeRow, CheckDraw, Stagger, showSaveToast } from '@/components/motion'
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

  // Form states
  const [customerName, setCustomerName] = useState('')
  const [amount, setAmount] = useState<number>(500)
  const [description, setDescription] = useState('')
  const [dueDate, setDueDate] = useState('')

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
            c.description?.toLowerCase().includes(searchQuery.toLowerCase())
          if (!match) return false
        }
        return true
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  }, [credits, filterPaid, searchQuery])

  const handleOpenAddModal = () => {
    setCustomerName('')
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

  const handleRemindCustomer = (c: Credit) => {
    showSaveToast(
      lang === 'bn'
        ? `${c.customerName}-কে তাগাদার এসএমএস ড্রাফট প্রস্তুত`
        : `Reminder drafted for ${c.customerName}`
    )
  }

  return (
    <div className="space-y-6">
      {/* Title & Add Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold text-brand-brown dark:text-brand-cream">
              {t.credit.creditTitle || (lang === 'bn' ? 'বাকি খাতা' : 'Customer Credit')}
            </h1>
          </div>
          <p className="text-sm text-brand-brown/70 dark:text-brand-cream/70 mt-1">
            {lang === 'bn'
              ? 'গ্রাহকদের বাকির হিসাব ও পরিশোধের সহজ ট্র্যাকিং (সোয়াইপ করে দ্রুত পরিশোধ বা তাগাদা)'
              : 'Simple customer credit ledger with swipe actions to pay or remind'}
          </p>
        </div>

        <Button
          onClick={handleOpenAddModal}
          className="bg-brand-yellow hover:bg-brand-orange text-brand-brown font-bold flex items-center gap-2 px-5 py-2.5 rounded-xl shadow-sm"
        >
          <Plus className="w-5 h-5" />
          <span>{t.credit.addCredit}</span>
        </Button>
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
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-brand-brown/50" />
            <input
              type="text"
              placeholder={lang === 'bn' ? 'গ্রাহকের নাম খুঁজুন...' : 'Search customer name...'}
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
              ? 'গ্রাহকদের বাকির হিসাব রাখতে নতুন এন্ট্রি যোগ করুন।'
              : 'Add customer credit entries to manage dues.'
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

                {/* Amount & Mark Paid */}
                <div className="flex items-center justify-between md:justify-end gap-4 border-t md:border-t-0 pt-3 md:pt-0">
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
                    <Button
                      size="sm"
                      onClick={() => handleMarkPaid(c.id)}
                      className="bg-brand-yellow hover:bg-brand-orange text-brand-brown font-bold text-xs flex items-center gap-1.5 px-3.5 py-2 shadow-sm whitespace-nowrap"
                    >
                      <Check className="w-4 h-4" />
                      <span>{t.credit.markPaid}</span>
                    </Button>
                  )}
                </div>
              </Card>
            )

            return (
              <div key={c.id}>
                {!c.isPaid ? (
                  <SwipeRow
                    onSwipeRight={() => handleMarkPaid(c.id)}
                    onSwipeLeft={() => handleRemindCustomer(c)}
                    rightLabel={lang === 'bn' ? 'পরিশোধিত করুন' : 'Mark Paid'}
                    leftLabel={lang === 'bn' ? 'মনে করান' : 'Remind'}
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

