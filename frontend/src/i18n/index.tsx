// i18n context, hook and provider for Haat-Bazaar
import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'
import { en } from './en'
import { bn } from './bn'

export type Language = 'bn' | 'en'
export type Dictionary = typeof en

const dicts: Record<Language, Dictionary> = { en, bn }

interface LanguageContextValue {
  lang: Language
  t: Dictionary
  setLang: (l: Language) => void
  formatNum: (n: number | string) => string
  formatCurrency: (n: number) => string
}

export const LanguageContext = createContext<LanguageContextValue | null>(null)

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Language>(() => {
    const stored = localStorage.getItem('hb-lang')
    return stored === 'en' || stored === 'bn' ? stored : 'bn'
  })

  const setLang = (l: Language) => {
    setLangState(l)
    localStorage.setItem('hb-lang', l)
    document.documentElement.lang = l
  }

  useEffect(() => {
    document.documentElement.lang = lang
  }, [lang])

  const formatNum = (n: number | string): string => {
    if (lang === 'bn') {
      return n.toString().replace(/[0-9]/g, (digit) => '০১২৩৪৫৬৭৮৯'[+digit])
    }
    return n.toString()
  }

  const formatCurrency = (n: number): string => `৳${formatNum(Math.round(n))}`

  const value: LanguageContextValue = {
    lang,
    t: dicts[lang],
    setLang,
    formatNum,
    formatCurrency,
  }

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
}

export function useLang(): LanguageContextValue {
  const ctx = useContext(LanguageContext)
  if (!ctx) throw new Error('useLang must be used inside LanguageProvider')
  return ctx
}
