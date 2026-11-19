// Design tokens & action pairs for Haat-Bazar ERP
// কাজের জুটি: বিক্রি=হলুদ, কেনা=নীল, বাকি=সবুজ, মেয়াদ=লাল, AI সহায়ক=বেগুনি

export const THEME_COLORS = {
  cream: '#FBF4E4',
  yellow: '#F4A900',
  darkBrown: '#4A2E0F',
  heroDark: '#2E1B07',
  woodShelf: '#B98A3E',

  // কাজের জুটি (Action pairs)
  sale: {
    key: 'sale',
    tone: 'yellow',
    labelBn: 'বিক্রি',
    labelEn: 'Sale',
    hex: '#F4A900',
    hoverHex: '#E09B00',
    bg: 'bg-[#F4A900]',
    bgLight: 'bg-[#F4A900]/15',
    border: 'border-[#F4A900]',
    text: 'text-[#4A2E0F]',
    accentText: 'text-[#D97706]',
    gradient: 'from-[#F4A900] to-[#E09B00]',
  },
  purchase: {
    key: 'purchase',
    tone: 'blue',
    labelBn: 'কেনা',
    labelEn: 'Purchase',
    hex: '#2563EB',
    hoverHex: '#1D4ED8',
    bg: 'bg-[#2563EB]',
    bgLight: 'bg-[#2563EB]/15',
    border: 'border-[#2563EB]',
    text: 'text-[#1D4ED8]',
    accentText: 'text-[#2563EB]',
    gradient: 'from-[#3B82F6] to-[#1D4ED8]',
  },
  credit: {
    key: 'credit',
    tone: 'green',
    labelBn: 'বাকি',
    labelEn: 'Credit',
    hex: '#16A34A',
    hoverHex: '#15803D',
    bg: 'bg-[#16A34A]',
    bgLight: 'bg-[#16A34A]/15',
    border: 'border-[#16A34A]',
    text: 'text-[#15803D]',
    accentText: 'text-[#16A34A]',
    gradient: 'from-[#22C55E] to-[#15803D]',
  },
  expiry: {
    key: 'expiry',
    tone: 'red',
    labelBn: 'মেয়াদ',
    labelEn: 'Expiry',
    hex: '#DC2626',
    hoverHex: '#B91C1C',
    bg: 'bg-[#DC2626]',
    bgLight: 'bg-[#DC2626]/15',
    border: 'border-[#DC2626]',
    text: 'text-[#B91C1C]',
    accentText: 'text-[#DC2626]',
    gradient: 'from-[#EF4444] to-[#B91C1C]',
  },
  assistant: {
    key: 'assistant',
    tone: 'purple',
    labelBn: 'AI সহায়ক',
    labelEn: 'AI Assistant',
    hex: '#9333EA',
    hoverHex: '#7E22CE',
    bg: 'bg-[#9333EA]',
    bgLight: 'bg-[#9333EA]/15',
    border: 'border-[#9333EA]',
    text: 'text-[#7E22CE]',
    accentText: 'text-[#9333EA]',
    gradient: 'from-[#A855F7] to-[#7E22CE]',
  },
} as const

export type ActionTone = 'yellow' | 'blue' | 'green' | 'red' | 'purple' | 'sale' | 'purchase' | 'credit' | 'expiry' | 'assistant'

export function getActionStyle(tone: ActionTone) {
  switch (tone) {
    case 'yellow':
    case 'sale':
      return THEME_COLORS.sale
    case 'blue':
    case 'purchase':
      return THEME_COLORS.purchase
    case 'green':
    case 'credit':
      return THEME_COLORS.credit
    case 'red':
    case 'expiry':
      return THEME_COLORS.expiry
    case 'purple':
    case 'assistant':
      return THEME_COLORS.assistant
    default:
      return THEME_COLORS.sale
  }
}
