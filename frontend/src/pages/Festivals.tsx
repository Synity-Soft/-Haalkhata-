// Festival and seasonal demand preparation timeline
import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  Calendar,
  Sparkles,
  TrendingUp,
  Clock,
  ArrowRight,
  CheckCircle2,
  Package,
} from 'lucide-react'
import { useLang } from '@/i18n'
import { getUpcomingFestivals } from '@/engines/festival'
import { Card, DemoBadge, EmptyState, ProductIcon } from '@/components/ui'
import { Stagger } from '@/components/motion'

export default function Festivals() {
  const { t, lang, formatNum } = useLang()

  const festivals = useMemo(() => getUpcomingFestivals(180), [])

  const nextFestival = festivals[0] || null

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold text-brand-brown dark:text-brand-cream">
              {t.festivals.upcomingFestivals}
            </h1>
          </div>
          <p className="text-sm text-brand-brown/70 dark:text-brand-cream/70 mt-1">
            {lang === 'bn'
              ? 'আসন্ন উৎসব ও মৌসুমে চাহিদার পূর্বাভাসের ভিত্তিতে আগাম ইনভেন্টরি প্রস্তুতি'
              : 'Prepare inventory in advance based on seasonal and festival demand surges'}
          </p>
        </div>
      </div>

      {/* Featured Next Festival Banner */}
      {nextFestival && (
        <Card className="p-6 bg-gradient-to-r from-brand-yellow/30 via-brand-cream/50 to-brand-yellow/20 border-brand-yellow shadow-sm">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand-yellow font-bold text-xs text-brand-brown mb-2 shadow-sm">
                <Sparkles className="w-3.5 h-3.5" />
                <span>{lang === 'bn' ? 'পরবর্তী প্রধান উৎসব' : 'Next Major Festival'}</span>
              </div>

              <h2 className="text-2xl sm:text-3xl font-extrabold text-brand-brown dark:text-brand-cream">
                {lang === 'bn' ? nextFestival.nameBn : nextFestival.name}
              </h2>

              <p className="text-sm text-brand-brown/80 dark:text-brand-cream/80 mt-1 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-brand-orange" />
                <span>{nextFestival.date}</span>
                <span>•</span>
                <span className="font-bold text-brand-orange">
                  {formatNum(nextFestival.daysUntil)} {lang === 'bn' ? 'দিন বাকি' : 'days left'}
                </span>
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
              <div className="p-3 rounded-2xl bg-white/80 dark:bg-[#1a0f07] border border-brand-yellow/60 text-center">
                <span className="text-xs text-brand-brown/70 dark:text-brand-cream/70 block">
                  {lang === 'bn' ? 'প্রত্যাশিত চাহিদা' : 'Demand Boost'}
                </span>
                <span className="text-xl font-extrabold text-brand-orange">
                  +{Math.round((nextFestival.expectedDemandMultiplier - 1) * 100)}%
                </span>
              </div>

              <Link
                to="/purchase"
                className="px-5 py-3 rounded-xl bg-brand-yellow hover:bg-brand-orange text-brand-brown font-bold text-sm shadow-sm transition-all active:scale-95 flex items-center gap-2"
              >
                <span>{lang === 'bn' ? 'ক্রয় প্রস্তুতি নিন' : 'Prepare Stock'}</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </Card>
      )}

      {/* Festivals Timeline List */}
      {festivals.length === 0 ? (
        <EmptyState
          icon={Calendar}
          title={lang === 'bn' ? 'কোনো আসন্ন উৎসব নেই' : 'No upcoming festivals'}
          description={
            lang === 'bn'
              ? 'আগামী কয়েক মাসে কোনো বড় জাতীয় বা ধর্মীয় উৎসবের সময়সূচি নেই।'
              : 'No major festival peaks identified for the next few months.'
          }
        />
      ) : (
        <div className="space-y-4">
          <h3 className="font-bold text-base text-brand-brown dark:text-brand-cream flex items-center gap-2">
            <Clock className="w-4 h-4 text-brand-orange" />
            <span>{lang === 'bn' ? 'আসন্ন উৎসব ক্যালেন্ডার' : 'Upcoming Festival Calendar'}</span>
          </h3>

          <Stagger className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {festivals.map((fest, idx) => {
              const boostPercent = Math.round((fest.expectedDemandMultiplier - 1) * 100)
              const tipsList = lang === 'bn' ? fest.tipsBn : fest.tips

              return (
                <Card key={idx} className="p-5 flex flex-col justify-between space-y-4">
                  <div>
                    {/* Top: Name & Countdown */}
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h4 className="font-bold text-lg text-brand-brown dark:text-brand-cream">
                          {lang === 'bn' ? fest.nameBn : fest.name}
                        </h4>
                        <div className="flex items-center gap-2 text-xs text-brand-brown/60 dark:text-brand-cream/60 mt-1">
                          <Calendar className="w-3.5 h-3.5" />
                          <span>{fest.date}</span>
                        </div>
                      </div>

                      <span className="px-3 py-1 rounded-full bg-brand-yellow/30 border border-brand-yellow text-brand-brown dark:text-brand-cream text-xs font-bold whitespace-nowrap">
                        {formatNum(fest.daysUntil)} {lang === 'bn' ? 'দিন বাকি' : 'days left'}
                      </span>
                    </div>

                    {/* Preparation & Category Tags */}
                    <div className="mt-4 space-y-2">
                      <div className="flex items-center gap-2 text-xs font-medium text-brand-brown/80 dark:text-brand-cream/80">
                        <TrendingUp className="w-4 h-4 text-green-600" />
                        <span>
                          {lang === 'bn'
                            ? `চাহিদা বৃদ্ধি: +${formatNum(boostPercent)}%`
                            : `Expected Demand Boost: +${boostPercent}%`}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 flex-wrap pt-1">
                        <span className="text-xs text-brand-brown/60 dark:text-brand-cream/60">
                          {lang === 'bn' ? 'প্রয়োজনীয় বিভাগ:' : 'Key Categories:'}
                        </span>
                        {fest.categories.map((cat) => (
                          <span
                            key={cat}
                            className="px-2 py-0.5 rounded-lg bg-brand-cream dark:bg-[#38200f] text-xs font-medium text-brand-brown dark:text-brand-cream flex items-center gap-1"
                          >
                            <ProductIcon category={cat as any} size={16} />
                            <span>{t.categories[cat] || cat}</span>
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Actionable Tips */}
                    <div className="mt-3.5 pt-3 border-t border-[#F0D080]/30 space-y-1.5">
                      <span className="text-xs font-bold text-brand-orange uppercase block">
                        {t.festivals.tips || (lang === 'bn' ? 'প্রস্তুতির পরামর্শ' : 'Preparation Tips')}
                      </span>
                      <ul className="text-xs text-brand-brown/80 dark:text-brand-cream/80 space-y-1">
                        {tipsList.map((tip, tIdx) => (
                          <li key={tIdx} className="flex items-start gap-1.5">
                            <span className="text-brand-orange font-bold">•</span>
                            <span>{tip}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  {/* Footer */}
                  <div className="pt-2 text-xs text-brand-brown/60 dark:text-brand-cream/60 italic flex items-center justify-between">
                    <span>
                      {lang === 'bn'
                        ? `${formatNum(fest.preparationDays)} দিন আগে থেকে মজুদ শুরু করুন`
                        : `Start preparation ${fest.preparationDays} days ahead`}
                    </span>
                    <Link
                      to="/purchase"
                      className="font-bold text-brand-orange hover:underline flex items-center gap-1"
                    >
                      <span>{t.navigation.purchase}</span>
                      <ArrowRight className="w-3 h-3" />
                    </Link>
                  </div>
                </Card>
              )
            })}
          </Stagger>
        </div>
      )}
    </div>
  )
}

