// Bangla & English AI Voice Bookkeeping Modal (Section 4.1)
import { useState, useEffect, useRef } from 'react'
import {
  Mic,
  MicOff,
  Sparkles,
  CheckCircle,
  Clock,
  ArrowRight,
  TrendingUp,
  CreditCard,
  DollarSign,
  Receipt,
  RotateCcw,
  Volume2,
  Trash2,
  Edit2,
  Check,
  AlertCircle,
  Send,
} from 'lucide-react'
import { useLang } from '@/i18n'
import { useShopContext } from '@/hooks/useShopContext'
import { addSale, addCredit } from '@/db/mutations'
import { Card, Button, Badge, Modal } from '@/components/ui'
import { showSaveToast } from '@/components/motion'
import { parseNaturalLanguageTransaction } from '@/mock/haalkhataFeatures'
import type { VoiceParsedTransaction } from '@/types'

interface VoiceBookkeepingModalProps {
  isOpen: boolean
  onClose: () => void
}

interface SavedVoiceEntry {
  id: string
  rawText: string
  totalSales: number
  cashReceived: number
  customerCredit: number
  expenseAmount: number
  customerName?: string
  date: string
  savedAt: string
}

export function VoiceBookkeepingModal({ isOpen, onClose }: VoiceBookkeepingModalProps) {
  const { lang, formatNum, formatCurrency } = useLang()
  const { currentShop } = useShopContext()
  const shopId = currentShop?.id || 'shop-student-01'

  const [activeTab, setActiveTab] = useState<'record' | 'history'>('record')
  const [speechLang, setSpeechLang] = useState<'bn-BD' | 'en-US'>('bn-BD')
  const [isListening, setIsListening] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [speechSupported, setSpeechSupported] = useState(true)

  // Extracted transaction details
  const [parsed, setParsed] = useState<VoiceParsedTransaction | null>(null)

  // Editable confirmation values
  const [editSales, setEditSales] = useState<number>(0)
  const [editCash, setEditCash] = useState<number>(0)
  const [editCredit, setEditCredit] = useState<number>(0)
  const [editExpense, setEditExpense] = useState<number>(0)
  const [editCustomer, setEditCustomer] = useState<string>('')

  // Voice transaction history (persisted in session)
  const [history, setHistory] = useState<SavedVoiceEntry[]>([
    {
      id: 'vh-01',
      rawText: 'আজকে ১৫ হাজার টাকার বিক্রি হয়েছে। ৫ হাজার টাকা ক্যাশ, ১০ হাজার টাকা বাকি।',
      totalSales: 15000,
      cashReceived: 5000,
      customerCredit: 10000,
      expenseAmount: 0,
      date: new Date().toISOString().slice(0, 10),
      savedAt: new Date(Date.now() - 3600000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ])

  const recognitionRef = useRef<any>(null)

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
      if (SpeechRecognition) {
        recognitionRef.current = new SpeechRecognition()
        recognitionRef.current.continuous = false
        recognitionRef.current.interimResults = true

        recognitionRef.current.onresult = (event: any) => {
          let currentTranscript = ''
          for (let i = 0; i < event.results.length; i++) {
            currentTranscript += event.results[i][0].transcript
          }
          setTranscript(currentTranscript)
          handleParseText(currentTranscript)
        }

        recognitionRef.current.onerror = (event: any) => {
          console.warn('Speech recognition error:', event.error)
          setIsListening(false)
        }

        recognitionRef.current.onend = () => {
          setIsListening(false)
        }
      } else {
        setSpeechSupported(false)
      }
    }
  }, [])

  // Auto-parse on transcript change
  const handleParseText = (text: string) => {
    if (!text.trim()) {
      setParsed(null)
      return
    }
    const result = parseNaturalLanguageTransaction(text)
    setParsed(result)
    setEditSales(result.totalSales || 0)
    setEditCash(result.cashReceived || 0)
    setEditCredit(result.customerCredit || 0)
    setEditExpense(result.expenseAmount || 0)
    setEditCustomer(result.customerName || '')
  }

  const toggleListening = () => {
    if (!recognitionRef.current) {
      showSaveToast(lang === 'bn' ? 'ব্রাউজার ভয়েস রিকগনিশন সাপোর্ট করে না' : 'Speech recognition not supported in browser')
      return
    }

    if (isListening) {
      recognitionRef.current.stop()
      setIsListening(false)
    } else {
      setTranscript('')
      setParsed(null)
      recognitionRef.current.lang = speechLang
      try {
        recognitionRef.current.start()
        setIsListening(true)
      } catch (err) {
        console.warn('Speech start error:', err)
        setIsListening(false)
      }
    }
  }

  const handleUseExample = (exampleText: string) => {
    setTranscript(exampleText)
    handleParseText(exampleText)
  }

  // Confirm and Save into Digital Ledger
  const handleConfirmAndSave = async () => {
    if (editSales <= 0 && editExpense <= 0 && editCredit <= 0 && editCash <= 0) {
      showSaveToast(lang === 'bn' ? 'অনুগ্রহ করে হিসাবের পরিমাণ প্রদান করুন' : 'Please provide transaction amount')
      return
    }

    const now = new Date().toISOString()

    // 1. If cash sales recorded, add sale record
    if (editCash > 0) {
      await addSale({
        shopId,
        quantity: 1,
        pricePerUnit: editCash,
        soldAt: now,
        paymentMethod: 'cash',
        totalAmount: editCash,
      })
    }

    // 2. If customer credit recorded, add credit ledger entry
    if (editCredit > 0) {
      await addCredit({
        shopId,
        customerName: editCustomer || (lang === 'bn' ? 'ভয়েস এন্ট্রি কাস্টমার' : 'Voice Entry Customer'),
        amount: editCredit,
        description: `ভয়েস খতিয়ান: ${transcript.slice(0, 40)}`,
        isPaid: false,
        createdAt: now,
      })
    }

    // 2b. If expense recorded, save to local expenses
    if (editExpense > 0) {
      try {
        const saved = localStorage.getItem('haalkhata_expenses')
        const currentList = saved ? JSON.parse(saved) : []
        const newExp = {
          id: `exp-${Date.now()}`,
          shopId,
          title: editCustomer ? `${editCustomer} খরচ` : 'ভয়েস বুককিপিং খরচ',
          category: 'other',
          amount: editExpense,
          date: now.slice(0, 10),
          createdAt: now,
        }
        localStorage.setItem('haalkhata_expenses', JSON.stringify([newExp, ...currentList]))
      } catch (e) {
        console.warn('Failed to save voice expense to localStorage:', e)
      }
    }

    // 3. Save to local voice history
    const newHistoryEntry: SavedVoiceEntry = {
      id: `vh-${Date.now()}`,
      rawText: transcript || `${editSales} টাকা বিক্রি (${editCash} ক্যাশ, ${editCredit} বাকি)`,
      totalSales: editSales,
      cashReceived: editCash,
      customerCredit: editCredit,
      expenseAmount: editExpense,
      customerName: editCustomer || undefined,
      date: now.slice(0, 10),
      savedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    }

    setHistory((prev) => [newHistoryEntry, ...prev])
    showSaveToast(lang === 'bn' ? 'খতিয়ানে সফলভাবে যুক্ত ও সংরক্ষিত হয়েছে ✓' : 'Saved to digital ledger ✓')

    // Reset and close
    setTranscript('')
    setParsed(null)
    onClose()
  }

  const handleDeleteHistory = (id: string) => {
    setHistory((prev) => prev.filter((h) => h.id !== id))
    showSaveToast(lang === 'bn' ? 'রেকর্ড মুছে ফেলা হয়েছে' : 'Record removed')
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={lang === 'bn' ? '🎙️ বাংলা ও ইংরেজি এআই ভয়েস খাতা' : '🎙️ Bangla & English AI Voice Bookkeeping'}
    >
      <div className="space-y-4">
        {/* Navigation Sub-Tabs */}
        <div className="flex items-center gap-2 border-b border-border pb-2">
          <button
            onClick={() => setActiveTab('record')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'record'
                ? 'bg-brand-yellow text-brand-brown shadow-sm'
                : 'text-text-secondary hover:text-text'
            }`}
          >
            {lang === 'bn' ? 'ভয়েস এন্ট্রি' : 'Voice Entry'}
          </button>

          <button
            onClick={() => setActiveTab('history')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'history'
                ? 'bg-brand-yellow text-brand-brown shadow-sm'
                : 'text-text-secondary hover:text-text'
            }`}
          >
            <span>{lang === 'bn' ? 'ইতিহাস ও সংশোধন' : 'History & Correction'}</span>
            <span className="px-1.5 py-0.2 rounded-full bg-black/10 dark:bg-white/10 text-[10px]">
              {formatNum(history.length)}
            </span>
          </button>
        </div>

        {activeTab === 'record' && (
          <div className="space-y-4">
            {/* Language Switcher & Listening Status */}
            <div className="flex items-center justify-between">
              <span className="text-xs text-brand-brown/70 dark:text-brand-cream/70">
                {lang === 'bn'
                  ? 'মুখে স্বাভাবিক ভাষায় বলুন (ফর্ম পূরণ ছাড়া)'
                  : 'Speak naturally without filling complex forms'}
              </span>

              <div className="flex items-center gap-1 bg-surface-light dark:bg-surface-dark p-1 rounded-xl border border-border">
                <button
                  type="button"
                  onClick={() => setSpeechLang('bn-BD')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors ${
                    speechLang === 'bn-BD'
                      ? 'bg-brand-yellow text-brand-brown'
                      : 'text-text-secondary hover:text-text'
                  }`}
                >
                  🇧🇩 বাংলা
                </button>
                <button
                  type="button"
                  onClick={() => setSpeechLang('en-US')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors ${
                    speechLang === 'en-US'
                      ? 'bg-brand-yellow text-brand-brown'
                      : 'text-text-secondary hover:text-text'
                  }`}
                >
                  🇬🇧 English
                </button>
              </div>
            </div>

            {/* Voice Mic Hero Section */}
            <div className="p-5 rounded-2xl bg-gradient-to-b from-amber-500/10 via-yellow-500/5 to-transparent border border-amber-300 dark:border-amber-700/60 text-center relative overflow-hidden">
              <div className="relative inline-block mx-auto mb-3">
                {isListening && (
                  <div className="absolute inset-0 rounded-full bg-red-500/30 animate-ping scale-150" />
                )}
                <button
                  type="button"
                  onClick={toggleListening}
                  className={`w-16 h-16 rounded-full flex items-center justify-center shadow-lg transition-all transform active:scale-95 ${
                    isListening
                      ? 'bg-red-500 text-white ring-4 ring-red-400/50'
                      : 'bg-brand-yellow hover:bg-brand-orange text-brand-brown ring-4 ring-amber-300/40'
                  }`}
                  title={isListening ? 'শোনা বন্ধ করুন' : 'কথা বলা শুরু করুন'}
                >
                  {isListening ? <MicOff className="w-8 h-8 animate-pulse" /> : <Mic className="w-8 h-8" />}
                </button>
              </div>

              <div className="text-xs font-bold text-brand-brown dark:text-brand-cream">
                {isListening ? (
                  <span className="text-red-600 animate-pulse flex items-center justify-center gap-1.5">
                    ● {lang === 'bn' ? 'শুনছি... এখন কথা বলুন...' : 'Listening... Speak now...'}
                  </span>
                ) : (
                  <span>
                    {lang === 'bn'
                      ? 'মাইক্রোফোনে ট্যাপ করে কথা বলুন'
                      : 'Tap microphone and speak your transaction'}
                  </span>
                )}
              </div>

              {/* Text Input / Speech preview */}
              <div className="mt-3">
                <textarea
                  rows={2}
                  value={transcript}
                  onChange={(e) => {
                    setTranscript(e.target.value)
                    handleParseText(e.target.value)
                  }}
                  placeholder={
                    lang === 'bn'
                      ? 'অথবা এখানে লিখুন: "আজকে ১৫ হাজার টাকার বিক্রি হয়েছে। ৫ হাজার টাকা ক্যাশ, ১০ হাজার টাকা বাকি।"'
                      : 'Or type here: "Today total sales 15000 taka. 5000 cash, 10000 credit."'
                  }
                  className="w-full p-2.5 rounded-xl border border-border bg-white dark:bg-[#1a0f07] text-xs leading-relaxed focus:ring-2 focus:ring-brand-yellow"
                />
              </div>

              {/* Clickable Sample Voice Prompts */}
              <div className="mt-2.5 flex items-center gap-1.5 overflow-x-auto pb-1 text-left">
                <span className="text-[10px] text-brand-brown/60 dark:text-brand-cream/60 whitespace-nowrap">
                  উদাহরণ:
                </span>
                <button
                  type="button"
                  onClick={() =>
                    handleUseExample('আজকে ১৫ হাজার টাকার বিক্রি হয়েছে। ৫ হাজার টাকা ক্যাশ, ১০ হাজার টাকা বাকি।')
                  }
                  className="px-2 py-1 rounded-lg bg-white/80 dark:bg-black/30 border border-amber-300 dark:border-amber-800 text-[11px] font-semibold text-brand-brown dark:text-brand-cream hover:bg-amber-100 whitespace-nowrap"
                >
                  🗣️ ১৫ হাজার বিক্রি (৫ হাজার ক্যাশ, ১০ হাজার বাকি)
                </button>
                <button
                  type="button"
                  onClick={() =>
                    handleUseExample('রহিম ভাই চাল ও তেল নিয়েছেন ১২০০ টাকা বাকি।')
                  }
                  className="px-2 py-1 rounded-lg bg-white/80 dark:bg-black/30 border border-amber-300 dark:border-amber-800 text-[11px] font-semibold text-brand-brown dark:text-brand-cream hover:bg-amber-100 whitespace-nowrap"
                >
                  🗣️ রহিম ভাই ১২০০ টাকা বাকি
                </button>
                <button
                  type="button"
                  onClick={() =>
                    handleUseExample('দোকানের ভাড়া ৪০০০ টাকা খরচ দিয়েছি।')
                  }
                  className="px-2 py-1 rounded-lg bg-white/80 dark:bg-black/30 border border-amber-300 dark:border-amber-800 text-[11px] font-semibold text-brand-brown dark:text-brand-cream hover:bg-amber-100 whitespace-nowrap"
                >
                  🗣️ দোকান ভাড়া ৪০০০ টাকা খরচ
                </button>
              </div>
            </div>

            {/* AI Extracted Information Card for Confirmation */}
            {parsed && (
              <div className="p-4 rounded-xl bg-card border-2 border-brand-orange/60 shadow-sm space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-border">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-brand-orange" />
                    <h4 className="font-extrabold text-sm text-brand-brown dark:text-brand-cream">
                      {lang === 'bn' ? 'এআই এক্সট্রাক্টেড হিসাব (যাচাই করুন)' : 'Extracted Details (Confirmation)'}
                    </h4>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-800">
                    ৯৮% আত্মবিশ্বাস
                  </span>
                </div>

                {/* Extracted Key-Value Breakdown */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs">
                  <div className="p-2.5 rounded-xl bg-amber-50/50 dark:bg-amber-950/30 border border-amber-200">
                    <span className="text-brand-brown/60 dark:text-brand-cream/60 block text-[10px]">
                      মোট বিক্রি (Total Sales)
                    </span>
                    <input
                      type="number"
                      value={editSales}
                      onChange={(e) => setEditSales(Number(e.target.value))}
                      className="w-full bg-transparent font-extrabold text-sm text-brand-brown dark:text-brand-cream border-b border-amber-300 focus:outline-none"
                    />
                  </div>

                  <div className="p-2.5 rounded-xl bg-green-50/50 dark:bg-green-950/30 border border-green-200">
                    <span className="text-green-800/70 dark:text-green-300/70 block text-[10px]">
                      প্রাপ্ত ক্যাশ (Cash Received)
                    </span>
                    <input
                      type="number"
                      value={editCash}
                      onChange={(e) => setEditCash(Number(e.target.value))}
                      className="w-full bg-transparent font-extrabold text-sm text-green-700 dark:text-green-300 border-b border-green-300 focus:outline-none"
                    />
                  </div>

                  <div className="p-2.5 rounded-xl bg-red-50/50 dark:bg-red-950/30 border border-red-200">
                    <span className="text-red-800/70 dark:text-red-300/70 block text-[10px]">
                      গ্রাহক বাকি (Customer Credit)
                    </span>
                    <input
                      type="number"
                      value={editCredit}
                      onChange={(e) => setEditCredit(Number(e.target.value))}
                      className="w-full bg-transparent font-extrabold text-sm text-red-600 dark:text-red-300 border-b border-red-300 focus:outline-none"
                    />
                  </div>

                  {editExpense > 0 && (
                    <div className="p-2.5 rounded-xl bg-orange-50/50 dark:bg-orange-950/30 border border-orange-200">
                      <span className="text-orange-800/70 dark:text-orange-300/70 block text-[10px]">
                        দোকান খরচ (Expense)
                      </span>
                      <input
                        type="number"
                        value={editExpense}
                        onChange={(e) => setEditExpense(Number(e.target.value))}
                        className="w-full bg-transparent font-extrabold text-sm text-orange-600 dark:text-orange-300 border-b border-orange-300 focus:outline-none"
                      />
                    </div>
                  )}

                  {editCredit > 0 && (
                    <div className="p-2.5 rounded-xl bg-surface-light dark:bg-surface-dark border border-border col-span-2">
                      <span className="text-brand-brown/60 dark:text-brand-cream/60 block text-[10px]">
                        বাকি গ্রহীতার নাম (Customer Name)
                      </span>
                      <input
                        type="text"
                        value={editCustomer}
                        onChange={(e) => setEditCustomer(e.target.value)}
                        placeholder="e.g. করিম সাহেব"
                        className="w-full bg-transparent font-bold text-xs text-text border-b border-border focus:outline-none"
                      />
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between text-xs text-brand-brown/70 dark:text-brand-cream/70 pt-1">
                  <span>তারিখ: {parsed.date} (আজ)</span>
                  {parsed.items && parsed.items.length > 0 && (
                    <span>চিহ্নিত পণ্য: {parsed.items.join(', ')}</span>
                  )}
                </div>
              </div>
            )}

            {/* Bottom Actions */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
              <Button type="button" variant="outline" onClick={onClose}>
                বাতিল
              </Button>
              <Button
                type="button"
                onClick={handleConfirmAndSave}
                disabled={!parsed && editSales === 0 && editCredit === 0 && editExpense === 0}
                className="bg-brand-yellow hover:bg-brand-orange text-brand-brown font-extrabold flex items-center gap-2 px-5"
              >
                <CheckCircle className="w-4 h-4" />
                <span>ডিজিটাল খতিয়ানে নিশ্চিত করুন ও সেভ করুন</span>
              </Button>
            </div>
          </div>
        )}

        {/* ─── History & Correction Tab ─────────────────────────────────────── */}
        {activeTab === 'history' && (
          <div className="space-y-3">
            {history.length === 0 ? (
              <p className="text-center text-xs text-brand-brown/60 py-8">
                এখনো কোনো ভয়েস লেনদেনের রেকর্ড সংরক্ষিত হয়নি।
              </p>
            ) : (
              history.map((item) => (
                <Card key={item.id} className="p-3.5 border-l-4 border-l-amber-500 text-xs space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-brand-brown dark:text-brand-cream">
                        "{item.rawText}"
                      </p>
                      <span className="text-[10px] text-brand-brown/60 dark:text-brand-cream/60 mt-0.5 block">
                        তারিখ: {item.date} • সময়: {item.savedAt}
                      </span>
                    </div>

                    <button
                      onClick={() => handleDeleteHistory(item.id)}
                      className="text-red-500 hover:text-red-700 p-1"
                      title="মুছুন"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="flex items-center gap-3 pt-1 border-t border-border text-[11px]">
                    {item.totalSales > 0 && (
                      <span className="font-bold text-brand-orange">
                        মোট বিক্রি: ৳{formatNum(item.totalSales)}
                      </span>
                    )}
                    {item.cashReceived > 0 && (
                      <span className="font-bold text-green-600">
                        ক্যাশ: ৳{formatNum(item.cashReceived)}
                      </span>
                    )}
                    {item.customerCredit > 0 && (
                      <span className="font-bold text-red-600">
                        বাকি: ৳{formatNum(item.customerCredit)}
                      </span>
                    )}
                    {item.expenseAmount > 0 && (
                      <span className="font-bold text-orange-600">
                        খরচ: ৳{formatNum(item.expenseAmount)}
                      </span>
                    )}
                  </div>
                </Card>
              ))
            )}
          </div>
        )}
      </div>
    </Modal>
  )
}
