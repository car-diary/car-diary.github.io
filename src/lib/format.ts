import { format, parseISO } from 'date-fns'

export const formatCurrency = (value: number) =>
  new Intl.NumberFormat('ko-KR', {
    style: 'currency',
    currency: 'KRW',
    maximumFractionDigits: 0,
  }).format(value || 0)

export const formatNumber = (value: number) =>
  new Intl.NumberFormat('ko-KR').format(value || 0)

export const formatKilometers = (value: number) => `${formatNumber(value)} km`

export const formatBytes = (value: number) => {
  if (value < 1024) return `${value} B`
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`
  if (value < 1024 * 1024 * 1024) {
    return `${(value / (1024 * 1024)).toFixed(1)} MB`
  }
  return `${(value / (1024 * 1024 * 1024)).toFixed(1)} GB`
}

export const formatShortDate = (value: string | null) => {
  if (!value) return '-'
  return format(parseISO(value), 'yyyy.MM.dd')
}

export const formatMonthLabel = (value: string) =>
  format(parseISO(`${value}-01`), 'MM월')

export const formatPercent = (value: number) => `${value.toFixed(1)}%`
