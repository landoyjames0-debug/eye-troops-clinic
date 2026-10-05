import { CURRENCY_CODE } from '@/lib/constants'

/** Philippine Peso. Format: ₱1,500.00 */
const peso = new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: CURRENCY_CODE,
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const pesoWhole = new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: CURRENCY_CODE,
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
})

const plain = new Intl.NumberFormat('en-PH')

/** "Jan 14, 2026" */
const mediumDate = new Intl.DateTimeFormat('en-PH', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
})

/** "Jan 14" */
const shortDate = new Intl.DateTimeFormat('en-PH', {
  month: 'short',
  day: 'numeric',
})

/** "9:42 AM" */
const timeOfDay = new Intl.DateTimeFormat('en-PH', {
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
})

const longDate = new Intl.DateTimeFormat('en-PH', {
  weekday: 'long',
  month: 'long',
  day: 'numeric',
  year: 'numeric',
})

const monthYear = new Intl.DateTimeFormat('en-PH', { month: 'long', year: 'numeric' })

function toDate(value) {
  if (!value) return null
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

export function formatPeso(value) {
  return peso.format(Number.isFinite(value) ? value : 0)
}

/** Compact form for dashboard tiles: ₱8,500 */
export function formatPesoShort(value) {
  return pesoWhole.format(Number.isFinite(value) ? value : 0)
}

export function formatNumber(value) {
  return plain.format(Number.isFinite(value) ? value : 0)
}

export function formatDate(value) {
  const date = toDate(value)
  return date ? mediumDate.format(date) : '—'
}

export function formatDateShort(value) {
  const date = toDate(value)
  return date ? shortDate.format(date) : '—'
}

export function formatTime(value) {
  const date = toDate(value)
  return date ? timeOfDay.format(date) : '—'
}

export function formatLongDate(value) {
  const date = toDate(value)
  return date ? longDate.format(date) : '—'
}

export function formatMonthYear(value) {
  const date = toDate(value)
  return date ? monthYear.format(date) : '—'
}

export const MONTH_LABELS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]

export function monthLabel(monthIndex) {
  return MONTH_LABELS[monthIndex] ?? ''
}
