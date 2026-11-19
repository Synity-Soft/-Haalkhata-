// AI Business Assistant — online via FastAPI (Gemini), offline via local rule-based engine
import { useState, useRef, useEffect } from 'react'
import {
  Bot,
  Send,
  User,
  Sparkles,
  Wifi,
  WifiOff,
  AlertCircle,
  HelpCircle,
  RotateCcw,
} from 'lucide-react'
import { format } from 'date-fns'
import { useLang } from '@/i18n'
import { useShopContext } from '@/hooks/useShopContext'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'
import { useProducts, useBatches, useSales } from '@/db/hooks'
import { calculateBatchRisk, calcExpiryStats } from '@/engines/expiry'
import { calcPurchaseSuggestion } from '@/engines/purchase'
import { getUpcomingFestivals } from '@/engines/festival'
import { api } from '@/lib/api'
import { Card, Button, SoftIcon } from '@/components/ui'
import { getProductName } from '@/lib/utils'
import { ThinkingDots } from '@/components/motion'
import type { ChatMessage, Product, Batch, Sale } from '@/types'

export default function Assistant() {
  const { t, lang, formatNum, formatCurrency } = useLang()
  const { currentShop } = useShopContext()
  const isOnline = useOnlineStatus()

  const shopId = currentShop?.id || 'shop-student-01'
  const rawProducts = useProducts(shopId) as Product[] | undefined
  const rawBatches = useBatches(shopId) as Batch[] | undefined
  const rawSales = useSales(shopId, 30)

  const products = rawProducts || []
  const batches = rawBatches || []
  const sales = rawSales || []

  const [messages, setMessages] = useState<ChatMessage[]>(() => [
    {
      id: 'welcome',
      role: 'assistant',
      content:
        lang === 'bn'
          ? `নমস্কার / আসসালামু আলাইকুম! আমি আপনার হাট-বাজার এআই সহকারী। ${
              currentShop?.name || 'আপনার দোকান'
            }-এর কেনাকাটা, মেয়াদোত্তীর্ণের ঝুঁকি বা উৎসবের প্রস্তুতি নিয়ে যেকোনো প্রশ্ন করতে পারেন।`
          : `Hello! I am your Haat-Bazaar AI assistant. Ask me anything about purchase suggestions, expiry risks, or festival prep for ${
              currentShop?.name || 'your shop'
            }.`,
      timestamp: new Date().toISOString(),
    },
  ])

  const [inputText, setInputText] = useState('')
  const [loading, setLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages, loading])

  // Suggested questions from Master Prompt
  const suggestedQuestions = [
    {
      bn: 'আজ কোন পণ্য কিনতে হবে?',
      en: 'Which products should I purchase today?',
    },
    {
      bn: 'কোন পণ্যগুলোর মেয়াদ শেষ হওয়ার ঝুঁকি আছে?',
      en: 'Which products are at risk of expiry?',
    },
    {
      bn: 'কোন পণ্যের মজুদ বেশি?',
      en: 'Which products have excess stock?',
    },
    {
      bn: 'কীভাবে পণ্যের অপচয় কমাতে পারি?',
      en: 'How can I reduce wastage?',
    },
    {
      bn: 'সামনে কোন উৎসবের জন্য প্রস্তুতি নেওয়া উচিত?',
      en: 'What should I prepare for the upcoming festival?',
    },
  ]

  // Local Offline Rule-Based Engine
  const generateOfflineReply = (query: string): string => {
    const q = query.toLowerCase()
    const isBn = lang === 'bn' || /[অ-হ]/.test(query)

    // 1. Purchase query
    if (q.includes('কিনতে') || q.includes('ক্রয়') || q.includes('purchase') || q.includes('buy') || q.includes('order')) {
      const area = currentShop?.areaType || 'student'
      const reorders = products
        .map((p) => {
          const pBatches = batches.filter((b) => b.productId === p.id && !b.deleted)
          const currentStock = pBatches.reduce((acc, b) => acc + b.quantity, 0)
          const pSales = sales.filter((s) => s.productId === p.id && !s.deleted)
          return calcPurchaseSuggestion({
            product: p,
            currentStock,
            recentSales: pSales,
            areaType: area,
            planningDays: 7,
            safetyStockDays: 2,
          })
        })
        .filter((s) => s.suggestedOrder > 0)
        .sort((a, b) => b.suggestedOrder - a.suggestedOrder)
        .slice(0, 3)

      if (reorders.length === 0) {
        return isBn
          ? 'আলহামদুলিল্লাহ, আপনার বর্তমান বিক্রির হারের তুলনায় সব পণ্যের পর্যাপ্ত মজুদ আছে। আগামী ৭ দিনে নতুন কোনো জরুরি ক্রয়ের প্রয়োজন নেই।'
          : 'All products currently have sufficient stock based on recent sales rates. No urgent orders needed for the next 7 days.'
      }

      const listStr = reorders
        .map(
          (r, idx) =>
            `${idx + 1}. **${getProductName(r, lang)}**: ${formatNum(r.suggestedOrder)} ${
              isBn ? 'একক অর্ডার করুন' : 'units needed'
            } (${isBn ? 'মজুদ আছে' : 'stock'}: ${formatNum(r.currentStock)})`
        )
        .join('\n')

      return isBn
        ? `আপনার বিক্রির গড় এবং এলাকার চাহিদার ভিত্তিতে এই পণ্যগুলো দ্রুত কেনা উচিত:\n\n${listStr}\n\n*বিস্তারিত জানতে 'ক্রয় পরামর্শ' পেজ দেখুন।*`
        : `Based on your recent sales rates and area multipliers, you should order these products:\n\n${listStr}\n\n*Check the Purchase page for full details.*`
    }

    // 2. Expiry query
    if (q.includes('মেয়াদ') || q.includes('ঝুঁকি') || q.includes('expire') || q.includes('expiry') || q.includes('waste')) {
      const prodMap = new Map(products.map((p) => [p.id, p]))
      const atRisk = batches
        .filter((b) => !b.deleted)
        .map((b) => {
          const p = prodMap.get(b.productId) || {
            id: b.productId,
            shopId: b.shopId,
            name: 'Unknown',
            category: 'other' as const,
            costPrice: 0,
            sellingPrice: 0,
            unit: 'unit',
            updatedAt: b.updatedAt,
            deleted: false,
          }
          const prodSales = sales.filter((s) => s.productId === b.productId)
          return calculateBatchRisk({ batch: b, product: p, recentSales: prodSales })
        })
        .filter((b) => b.risk === 'expired' || b.risk === 'high' || b.risk === 'medium')
        .slice(0, 4)

      if (atRisk.length === 0) {
        return isBn
          ? 'আপনার কোনো ব্যাচের মেয়াদ এই মুহূর্তে শেষ বা গুরুতর ঝুঁকিতে নেই।'
          : 'None of your batches are currently expired or at critical expiry risk.'
      }

      const listStr = atRisk
        .map((b, idx) => {
          const riskText =
            b.risk === 'expired'
              ? isBn
                ? 'মেয়াদোত্তীর্ণ (অবিলম্বে সরান)'
                : 'Expired (Remove now)'
              : `${formatNum(b.daysRemaining)} ${isBn ? 'দিন বাকি' : 'days left'}`
          return `${idx + 1}. **${getProductName(b, lang)}**: ${formatNum(b.remainingQty)} ${isBn ? 'টি অবশিষ্ট' : 'remaining'} — ${riskText}`
        })
        .join('\n')

      return isBn
        ? `নিম্নলিখিত পণ্যগুলোর মেয়াদের দিকে লক্ষ্য রাখুন:\n\n${listStr}\n\n*মনে রাখবেন: মেয়াদোত্তীর্ণ পণ্য কখনোই ছাড় দিয়ে বিক্রি করবেন না!*`
        : `Please review these expiring items:\n\n${listStr}\n\n*Remember: Never sell expired items!*`
    }

    // 3. Excess stock query
    if (q.includes('মজুদ বেশি') || q.includes('অতিরিক্ত') || q.includes('excess') || q.includes('overstock')) {
      const highStock = products
        .map((p) => {
          const pBatches = batches.filter((b) => b.productId === p.id && !b.deleted)
          const currentStock = pBatches.reduce((acc, b) => acc + b.quantity, 0)
          return { product: p, currentStock }
        })
        .sort((a, b) => b.currentStock - a.currentStock)
        .slice(0, 3)

      const listStr = highStock
        .map((h, i) => `${i + 1}. **${h.product.name}**: ${formatNum(h.currentStock)} ${h.product.unit}`)
        .join('\n')

      return isBn
        ? `এই পণ্যগুলোর মজুদ সবচেয়ে বেশি:\n\n${listStr}\n\nএগুলোর নতুন ব্যাচ কেনার আগে বর্তমান মজুদ শেষ হতে দিন।`
        : `These items currently hold the highest inventory:\n\n${listStr}\n\nAllow existing stock to clear before placing new orders.`
    }

    // 4. Festival query
    if (q.includes('উৎসব') || q.includes('ঈদ') || q.includes('পূজা') || q.includes('festival') || q.includes('season')) {
      const festivals = getUpcomingFestivals(90)
      if (festivals.length === 0) {
        return isBn
          ? 'আগামী ৯০ দিনের মধ্যে কোনো বড় উৎসবের সূচি নেই। স্বাভাবিক নিয়মে বিক্রি চালিয়ে যান।'
          : 'No major festivals are scheduled within the next 90 days.'
      }

      const nextF = festivals[0]
      const name = isBn ? nextF.nameBn : nextF.name
      const tips = isBn ? nextF.tipsBn.join(', ') : nextF.tips.join(', ')

      return isBn
        ? `সামনে আসছে **${name}** (আর মাত্র ${formatNum(nextF.daysUntil)} দিন বাকি)।\n\n- প্রত্যাশিত চাহিদা বৃদ্ধি: **+${Math.round(
            (nextF.expectedDemandMultiplier - 1) * 100
          )}%**\n- সুপারিশ: ${tips}`
        : `Upcoming: **${name}** in ${formatNum(nextF.daysUntil)} days.\n\n- Expected demand boost: **+${Math.round(
            (nextF.expectedDemandMultiplier - 1) * 100
          )}%**\n- Suggestions: ${tips}`
    }

    // 5. Default advice
    return isBn
      ? `আপনার প্রশ্নের জন্য ধন্যবাদ। অফলাইন মোডে আমি ক্রয় পরামর্শ, মেয়াদোত্তীর্ণের সতর্কতা, অতিরিক্ত মজুদ এবং উৎসবের প্রস্তুতি নিয়ে সরাসরি উত্তর দিতে পারি। উপরের যেকোনো একটি প্রশ্ন বেছে নিতে পারেন।`
      : `Thank you for asking. In offline mode, I provide direct local guidance on purchases, expiry risks, excess inventory, and festival preparation.`
  }

  // Submit Handler
  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputText).trim()
    if (!text || loading) return

    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: new Date().toISOString(),
    }

    setMessages((prev) => [...prev, userMsg])
    setInputText('')
    setLoading(true)

    // Check if we should call backend or use local fallback
    if (isOnline) {
      try {
        const response = await api.assistant(shopId, text, {
          totalProducts: products.length,
          totalBatches: batches.length,
        })

        const botMsg: ChatMessage = {
          id: `b-${Date.now()}`,
          role: 'assistant',
          content: response.reply,
          timestamp: new Date().toISOString(),
        }
        setMessages((prev) => [...prev, botMsg])
      } catch (err) {
        // Fallback to offline rule-based response
        const fallback = generateOfflineReply(text)
        const botMsg: ChatMessage = {
          id: `b-${Date.now()}`,
          role: 'assistant',
          content: `${fallback}\n\n*(অফলাইন ইঞ্জিন দ্বারা বিশ্লেষিত)*`,
          timestamp: new Date().toISOString(),
        }
        setMessages((prev) => [...prev, botMsg])
      } finally {
        setLoading(false)
      }
    } else {
      // Direct local rule-based response
      setTimeout(() => {
        const reply = generateOfflineReply(text)
        const botMsg: ChatMessage = {
          id: `b-${Date.now()}`,
          role: 'assistant',
          content: `${reply}\n\n*(অফলাইন বিশ্লেষণ)*`,
          timestamp: new Date().toISOString(),
        }
        setMessages((prev) => [...prev, botMsg])
        setLoading(false)
      }, 350)
    }
  }

  return (
    <div className="h-[calc(100vh-12rem)] md:h-[calc(100vh-9rem)] flex flex-col space-y-3">
      {/* Top Banner */}
      <div className="flex items-center justify-between px-3 py-2 bg-purple-500/10 dark:bg-purple-950/20 rounded-2xl border border-purple-200 dark:border-purple-900/40">
        <div className="flex items-center gap-2.5">
          <SoftIcon tone="purple" icon={Bot} size="sm" />
          <div>
            <span className="font-bold text-sm text-brand-brown dark:text-brand-cream block leading-tight">
              {t.assistant.chatTitle}
            </span>
            <span className="text-[10px] text-purple-700 dark:text-purple-300 font-semibold">
              AI সহকারী • Gemini + Local Offline
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 text-xs">
          {isOnline ? (
            <span className="flex items-center gap-1 text-green-700 dark:text-green-400 font-semibold">
              <Wifi className="w-3.5 h-3.5" />
              <span>{t.dashboard.online} (Gemini AI)</span>
            </span>
          ) : (
            <span className="flex items-center gap-1 text-amber-700 dark:text-amber-400 font-semibold">
              <WifiOff className="w-3.5 h-3.5" />
              <span>{t.dashboard.offline} (Local Engine)</span>
            </span>
          )}
        </div>
      </div>

      {/* Suggested Questions Pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
        {suggestedQuestions.map((q, idx) => {
          const qText = lang === 'bn' ? q.bn : q.en
          return (
            <button
              key={idx}
              type="button"
              onClick={() => handleSendMessage(qText)}
              className="text-xs px-3 py-1.5 rounded-full bg-white dark:bg-[#1f130a] border border-brand-yellow hover:bg-brand-yellow hover:text-brand-brown text-brand-brown dark:text-brand-cream font-medium whitespace-nowrap transition-colors shadow-sm"
            >
              {qText}
            </button>
          )
        })}
      </div>

      {/* Messages Scroll Area */}
      <Card className="flex-1 overflow-y-auto p-4 space-y-4 bg-white/70 dark:bg-[#1a0f07]/80">
        {messages.map((msg) => {
          const isUser = msg.role === 'user'

          return (
            <div
              key={msg.id}
              className={`flex items-start gap-2.5 ${isUser ? 'justify-end' : 'justify-start'}`}
            >
              {!isUser && (
                <div className="w-8 h-8 rounded-xl bg-brand-yellow flex items-center justify-center text-brand-brown font-bold flex-shrink-0 shadow-sm">
                  <Bot className="w-4 h-4" />
                </div>
              )}

              <div
                className={`max-w-[85%] sm:max-w-[75%] rounded-2xl p-3.5 text-sm shadow-sm ${
                  isUser
                    ? 'bg-brand-yellow text-brand-brown rounded-tr-none font-medium'
                    : 'bg-white dark:bg-[#28180d] text-brand-brown dark:text-brand-cream border border-[#F0D080]/40 rounded-tl-none'
                }`}
              >
                <div className="whitespace-pre-line leading-relaxed">{msg.content}</div>
                <div
                  className={`text-[10px] mt-1.5 ${
                    isUser
                      ? 'text-brand-brown/60 text-right'
                      : 'text-brand-brown/50 dark:text-brand-cream/50'
                  }`}
                >
                  {format(new Date(msg.timestamp), 'hh:mm a')}
                </div>
              </div>

              {isUser && (
                <div className="w-8 h-8 rounded-xl bg-brand-orange flex items-center justify-center text-white font-bold flex-shrink-0 shadow-sm">
                  <User className="w-4 h-4" />
                </div>
              )}
            </div>
          )
        })}

        {/* Loading Indicator */}
        {loading && (
          <div className="flex items-center gap-2 p-3 rounded-2xl bg-white dark:bg-[#28180d] border border-purple-200 dark:border-purple-900/40 w-fit">
            <span className="text-xs text-brand-brown/70 dark:text-brand-cream/70 font-medium">
              {t.assistant.thinking}
            </span>
            <ThinkingDots />
          </div>
        )}

        <div ref={messagesEndRef} />
      </Card>

      {/* Input Form Bar */}
      <form
        onSubmit={(e) => {
          e.preventDefault()
          handleSendMessage()
        }}
        className="flex items-center gap-2 pt-1"
      >
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder={t.assistant.typeMessage}
          disabled={loading}
          className="flex-1 px-4 py-3 rounded-2xl border border-[#F0D080] dark:border-[#4D2A00] bg-white dark:bg-[#1a0f07] text-sm text-brand-brown dark:text-brand-cream focus:outline-none focus:ring-2 focus:ring-brand-yellow shadow-sm"
        />

        <Button
          type="submit"
          disabled={!inputText.trim() || loading}
          className="h-12 px-5 bg-brand-yellow hover:bg-brand-orange text-brand-brown rounded-2xl flex items-center justify-center shadow-sm"
        >
          <Send className="w-4 h-4" />
        </Button>
      </form>
    </div>
  )
}

