// Bengali numerals and currency formatting utilities

const BENGALI_DIGITS = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯']

export function toBengaliDigits(num: number | string): string {
  if (num === null || num === undefined) return '০'
  return String(num).replace(/\d/g, (d) => BENGALI_DIGITS[parseInt(d, 10)])
}

export function formatBengaliCurrency(amount: number, showSign: boolean = true): string {
  const rounded = Math.round(amount)
  const formatted = rounded.toLocaleString('en-US')
  const bengaliNum = formatted.replace(/\d/g, (d) => BENGALI_DIGITS[parseInt(d, 10)])
  return showSign ? `৳${bengaliNum}` : bengaliNum
}

export function toEnglishDigits(str: string): string {
  return str.replace(/[০-৯]/g, (d) => String(BENGALI_DIGITS.indexOf(d)))
}
