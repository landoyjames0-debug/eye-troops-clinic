import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  CalendarDays,
  Download,
  Pencil,
  Plus,
  Receipt,
  Trash2,
  TrendingDown,
  TrendingUp,
  Wallet,
} from 'lucide-react'
import { PageHeader, SectionTitle } from '@/components/layout/page-header'
import { Card, Table, TBody, TD, TH, THead, TR } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { SearchInput } from '@/components/ui/search-input'
import { Pagination } from '@/components/ui/pagination'
import { EmptyState, ErrorNote, Skeleton, SkeletonRows } from '@/components/ui/feedback'
import { ExpenseDialog } from '@/components/expenses/expense-dialog'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { Select } from '@/components/Select'
import { useAsync } from '@/hooks/use-async'
import { useDebouncedSearchParam } from '@/hooks/use-debounced-search-param'
import { useConfirm } from '@/hooks/use-confirm'
import { useResultDialog } from '@/hooks/use-result-dialog'
import { useSupabaseHealth } from '@/hooks/use-supabase-health'
import { getMonthlySeries } from '@/services/dashboard.service'
import {
  deleteExpense,
  getEarliestExpenseDate,
  listAllExpenses,
  listExpenses,
  totalExpenses,
} from '@/services/expenses.service'
import {
  getEarliestPaymentDate,
  listPaymentExportRows,
  listPayments,
} from '@/services/payments.service'
import { paymentMethodOf, paymentNoteOf, TABLE_PAGE_SIZE } from '@/lib/constants'
import { addDays, monthBounds, toAmount, toDateKey, yearBounds } from '@/utils/dates'
import { formatPeso, formatPesoShort, formatDate, formatDateShort, MONTH_LABELS } from '@/utils/format'
import { AppError } from '@/utils/errors'
import { downloadCsv, toCsv } from '@/utils/csv'
import { cn } from '@/lib/utils'
import { SUMMARY_STALE_TIME, invalidateClinicQueries } from '@/lib/query-client'
import { useAuth } from '@/hooks/use-auth'

const PERIOD_RANGES = [
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'This week' },
  { value: 'this-month', label: 'This month' },
  { value: 'quarter', label: 'This quarter' },
  { value: 'this-year', label: 'This year' },
]

const MONTH_OPTIONS = [
  { value: 'all', label: 'All' },
  ...MONTH_LABELS.map((label, index) => ({ value: String(index), label: label.slice(0, 3) })),
]

const PERCENT_FORMATTER = new Intl.NumberFormat('en-PH', {
  style: 'percent',
  signDisplay: 'always',
  maximumFractionDigits: 1,
})

function quarterBounds(date) {
  const quarterStartMonth = Math.floor(date.getMonth() / 3) * 3
  const from = new Date(date.getFullYear(), quarterStartMonth, 1)
  return { from: toDateKey(from), to: toDateKey(date) }
}

function getPeriodBounds(range, year, month, customFrom, customTo, today) {
  const todayKey = toDateKey(today)
  if (range === 'today') return { from: todayKey, to: todayKey }
  if (range === 'week') {
    const monday = new Date(today)
    monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7))
    return { from: toDateKey(monday), to: todayKey }
  }
  if (range === 'this-month') {
    return { from: monthBounds(today.getFullYear(), today.getMonth()).from, to: todayKey }
  }
  if (range === 'quarter') return quarterBounds(today)
  if (range === 'this-year') return { from: `${today.getFullYear()}-01-01`, to: todayKey }
  if (range === 'custom') return { from: customFrom || todayKey, to: customTo || customFrom || todayKey }
  if (month !== 'all') return monthBounds(year, Number(month))
  return yearBounds(year)
}

function getPreviousPeriodBounds(range, year, month, bounds, today) {
  if (range === 'year') {
    return month === 'all'
      ? yearBounds(year - 1)
      : monthBounds(Number(month) === 0 ? year - 1 : year, (Number(month) + 11) % 12)
  }
  if (range === 'this-year') {
    const previousYear = today.getFullYear() - 1
    const lastDay = new Date(previousYear, today.getMonth() + 1, 0).getDate()
    const previousEnd = new Date(previousYear, today.getMonth(), Math.min(today.getDate(), lastDay))
    return { from: `${previousYear}-01-01`, to: toDateKey(previousEnd) }
  }
  if (range === 'this-month') {
    const previousMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1)
    const lastDay = new Date(previousMonth.getFullYear(), previousMonth.getMonth() + 1, 0).getDate()
    const previousEnd = new Date(
      previousMonth.getFullYear(),
      previousMonth.getMonth(),
      Math.min(today.getDate(), lastDay),
    )
    return { from: toDateKey(previousMonth), to: toDateKey(previousEnd) }
  }
  if (range === 'quarter') {
    const previousQuarter = new Date(today.getFullYear(), today.getMonth() - 3, 1)
    const elapsedDays = Math.max(
      Math.round((new Date(`${bounds.to}T00:00:00`) - new Date(`${bounds.from}T00:00:00`)) / 86_400_000),
      0,
    )
    const quarterEnd = new Date(previousQuarter.getFullYear(), previousQuarter.getMonth() + 3, 0)
    const previousEnd = addDays(
      previousQuarter,
      Math.min(elapsedDays, quarterEnd.getDate() - 1),
    )
    return { from: toDateKey(previousQuarter), to: toDateKey(previousEnd) }
  }

  const fromDate = new Date(`${bounds.from}T00:00:00`)
  const toDate = new Date(`${bounds.to}T00:00:00`)
  if (range === 'today') {
    const previousDay = addDays(fromDate, -1)
    const previous = toDateKey(previousDay)
    return { from: previous, to: previous }
  }

  const duration = Math.max(Math.round((toDate - fromDate) / 86_400_000) + 1, 1)
  const previousTo = addDays(fromDate, -1)
  const previousFrom = addDays(previousTo, -(duration - 1))
  return { from: toDateKey(previousFrom), to: toDateKey(previousTo) }
}

function describePeriod(range, year, month, bounds) {
  if (range === 'year' && month === 'all') {
    return `Showing January to December ${year}`
  }
  if (range === 'year') return `Showing ${MONTH_LABELS[Number(month)]} ${year}`
  if (range === 'custom') return `Showing ${formatDate(bounds.from)} to ${formatDate(bounds.to)}`
  return `Showing ${formatDate(bounds.from)} to ${formatDate(bounds.to)}`
}

function buildMonthlyRows(payments, expenses) {
  const months = new Map()
  const getMonth = (date) => {
    const key = String(date).slice(0, 7)
    if (!months.has(key)) {
      const [year, month] = key.split('-').map(Number)
      months.set(key, {
        key,
        label: `${MONTH_LABELS[month - 1].slice(0, 3)} ${year}`,
        sales: 0,
        expenses: 0,
        net: 0,
      })
    }
    return months.get(key)
  }

  for (const payment of payments) {
    getMonth(payment.payment_date).sales += Number(payment.amount)
  }
  for (const expense of expenses) {
    getMonth(expense.expense_date).expenses += Number(expense.amount)
  }

  return [...months.values()]
    .sort((left, right) => left.key.localeCompare(right.key))
    .map((row) => ({
      ...row,
      sales: toAmount(row.sales),
      expenses: toAmount(row.expenses),
      net: toAmount(row.sales - row.expenses),
    }))
}

function percentChange(current, previous) {
  if (previous === 0) return current === 0 ? 0 : null
  return ((current - previous) / Math.abs(previous)) * 100
}

function comparisonDetail(current, previous, direction, loading, error) {
  if (loading) return { text: 'Comparing…', tone: 'neutral' }
  if (error) return { text: 'Comparison unavailable', tone: 'neutral' }

  const change = percentChange(current, previous)
  if (change === null) {
    const tone = direction === 'down'
      ? 'error'
      : direction === 'net' && current < 0 ? 'error' : 'success'
    return { text: 'New vs previous', tone }
  }

  const improved = direction === 'down' ? change <= 0 : change >= 0
  return {
    text: `${PERCENT_FORMATTER.format(change / 100)} vs previous`,
    tone: improved ? 'success' : 'error',
  }
}

function MiniStat({ icon: Icon, label, value, tone = 'neutral', detail, detailTone = 'neutral' }) {
  const tones = {
    neutral: {
      iconBg: 'bg-gradient-to-br from-gold-light to-champagne',
      iconColor: 'text-gold-dark',
      valueColor: 'text-espresso',
    },
    success: {
      iconBg: 'bg-gradient-to-br from-success/15 to-success/5',
      iconColor: 'text-success',
      valueColor: 'text-success',
    },
    warning: {
      iconBg: 'bg-gradient-to-br from-warning/15 to-warning/5',
      iconColor: 'text-warning',
      valueColor: 'text-warning',
    },
    error: {
      iconBg: 'bg-gradient-to-br from-error/15 to-error/5',
      iconColor: 'text-error',
      valueColor: 'text-error',
    },
  }
  const s = tones[tone] || tones.neutral
  const detailClass = {
    success: 'text-success',
    error: 'text-error',
    neutral: 'text-warmgray',
  }[detailTone] ?? 'text-warmgray'

  return (
    <div className="flex items-center gap-3 rounded-xl border border-champagne/60 bg-surface px-4 py-3 shadow-card">
      <span
        className={cn(
          'flex size-10 shrink-0 items-center justify-center rounded-xl',
          s.iconBg,
          s.iconColor,
        )}
      >
        <Icon className="size-5" strokeWidth={1.7} aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <p className={cn('truncate font-display text-xl font-bold tabular', s.valueColor)}>
          {value}
        </p>
        <p className="text-[11px] text-warmgray">{label}</p>
        {detail && <p className={cn('mt-1 text-[10px] font-semibold tabular', detailClass)}>{detail}</p>}
      </div>
    </div>
  )
}

function MiniStatSkeleton() {
  return (
    <div className="flex animate-pulse items-center gap-3 rounded-xl border border-champagne/60 bg-surface px-4 py-3">
      <Skeleton className="size-10 rounded-xl" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-6 w-24" />
        <Skeleton className="h-3 w-32" />
      </div>
    </div>
  )
}

function formatCsvNumber(value) {
  return value == null || value === '' ? '' : Number(value)
}

function matchesSearch(search, values) {
  const term = search.trim().toLowerCase()
  if (!term) return true
  return values.some((value) => String(value ?? '').toLowerCase().includes(term))
}

function paymentSearchValues(payment) {
  return [
    payment.payment_date,
    payment.amount,
    payment.notes,
    paymentMethodOf(payment),
    paymentNoteOf(payment),
    payment.customer,
    payment.order_number,
    payment.description,
  ]
}

function expenseSearchValues(expense) {
  return [expense.expense_date, expense.category, expense.description, expense.amount]
}

const SALES_COLUMNS = [
  { key: 'date', header: 'Date' },
  { key: 'customer', header: 'Customer' },
  { key: 'itemType', header: 'Item Type' },
  { key: 'description', header: 'Description' },
  { key: 'quantity', header: 'Quantity' },
  { key: 'unitPrice', header: 'Unit Price' },
  { key: 'total', header: 'Total', format: formatCsvNumber },
  { key: 'paymentMethod', header: 'Payment Method' },
  { key: 'notes', header: 'Notes' },
]

const EXPENSE_COLUMNS = [
  { key: 'date', header: 'Date' },
  { key: 'category', header: 'Category' },
  { key: 'vendor', header: 'Vendor' },
  { key: 'description', header: 'Description' },
  { key: 'amount', header: 'Amount', format: formatCsvNumber },
  { key: 'paymentMethod', header: 'Payment Method' },
  { key: 'notes', header: 'Notes' },
]

const SUMMARY_COLUMNS = [
  { key: 'type', header: 'Type' },
  { key: 'period', header: 'Period' },
  { key: 'totalSales', header: 'Total Sales', format: formatCsvNumber },
  { key: 'totalExpenses', header: 'Total Expenses', format: formatCsvNumber },
  { key: 'netProfit', header: 'Net Profit', format: formatCsvNumber },
  { key: 'category', header: 'Expense Category' },
  { key: 'categoryTotal', header: 'Category Total', format: formatCsvNumber },
]

export default function SalesExpensesPage() {
  const { user } = useAuth()
  const confirm = useConfirm()
  const resultDialog = useResultDialog()
  const { isOnline } = useSupabaseHealth()
  const [searchParams, setSearchParams] = useSearchParams()
  const { search, setSearch, deferredSearch, searchPending } = useDebouncedSearchParam()
  const [today] = useState(() => new Date())
  const currentYear = today.getFullYear()
  const requestedYear = Number(searchParams.get('year'))
  const selectedMonth = searchParams.get('month') ?? 'all'
  const requestedRange = searchParams.get('range') ?? 'year'
  const selectedRange = requestedRange === 'month' ? 'this-month' : requestedRange
  const tab = searchParams.get('tab')
  const customFrom = searchParams.get('from') ?? ''
  const customTo = searchParams.get('to') ?? ''
  const compareEnabled = searchParams.get('compare') === '1'
  const [expenseOpen, setExpenseOpen] = useState(false)
  const [editingExpense, setEditingExpense] = useState(null)
  const [deletingExpense, setDeletingExpense] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [exporting, setExporting] = useState('')
  const [paymentPage, setPaymentPage] = useState(1)
  const [expensePage, setExpensePage] = useState(1)

  const earliestDates = useAsync(
    () => Promise.all([getEarliestPaymentDate(), getEarliestExpenseDate()]),
    [],
    'loadSummary',
    { key: 'finance-earliest-dates', staleTime: SUMMARY_STALE_TIME },
  )

  const earliestYear = Math.min(
    ...((earliestDates.data ?? [])
      .filter(Boolean)
      .map((value) => Number(String(value).slice(0, 4)))),
    currentYear,
  )
  const yearNumbers = Array.from(
    { length: Math.max(currentYear - earliestYear + 1, 1) },
    (_, index) => currentYear - index,
  )
  const year = yearNumbers.includes(requestedYear) ? requestedYear : currentYear
  const month = /^([0-9]|1[01])$/.test(selectedMonth) ? selectedMonth : 'all'
  const range = [
    'year',
    ...PERIOD_RANGES.map((option) => option.value),
    'custom',
  ].includes(selectedRange) ? selectedRange : 'year'
  const yearChips = yearNumbers.slice(0, 5)
  const olderYears = yearNumbers.slice(5)

  const bounds = useMemo(
    () => getPeriodBounds(range, year, month, customFrom, customTo, today),
    [range, year, month, customFrom, customTo, today],
  )

  const previousBounds = useMemo(
    () => getPreviousPeriodBounds(range, year, month, bounds, today),
    [range, year, month, bounds, today],
  )

  const series = useAsync(() => getMonthlySeries(year), [year], 'loadSummary', {
    key: 'finance-monthly-series',
    staleTime: SUMMARY_STALE_TIME,
    persist: true,
  })
  const monthsWithData = useMemo(
    () => new Set(
      (series.data ?? [])
        .filter((row) => row.sales > 0 || row.expenses > 0)
        .map((row) => String(row.month)),
    ),
    [series.data],
  )
  const payments = useAsync(
    () => listPayments(bounds.from, bounds.to),
    [bounds.from, bounds.to],
    'loadPayments',
    { key: 'finance-payments' },
  )
  const expenses = useAsync(
    () => listExpenses(bounds.from, bounds.to),
    [bounds.from, bounds.to],
    'loadExpenses',
    { key: 'finance-expenses' },
  )
  const previousPeriod = useAsync(
    () => compareEnabled
      ? Promise.all([
          listPayments(previousBounds.from, previousBounds.to),
          listExpenses(previousBounds.from, previousBounds.to),
        ]).then(([previousPayments, previousExpenses]) => ({ previousPayments, previousExpenses }))
      : Promise.resolve({ previousPayments: [], previousExpenses: [] }),
    [compareEnabled, previousBounds.from, previousBounds.to],
    'loadSummary',
    { key: 'finance-previous-period' },
  )

  const allPaymentRows = useMemo(() => {
    const rows = payments.data ?? []
    return [...rows].sort((a, b) => Date.parse(b.payment_date) - Date.parse(a.payment_date))
  }, [payments.data])

  const paymentRows = useMemo(
    () => allPaymentRows.filter((row) => matchesSearch(deferredSearch, paymentSearchValues(row))),
    [allPaymentRows, deferredSearch],
  )

  const allExpenseRows = useMemo(() => {
    const rows = expenses.data ?? []
    return [...rows].sort((a, b) => Date.parse(b.expense_date) - Date.parse(a.expense_date))
  }, [expenses.data])

  const expenseRows = useMemo(
    () => allExpenseRows.filter((row) => matchesSearch(deferredSearch, expenseSearchValues(row))),
    [allExpenseRows, deferredSearch],
  )

  const isCurrentYear = year === today.getFullYear()
  const currentMonthIndex = today.getMonth()

  /** KPI totals come straight from the period ledgers shown below. */
  const periodSales = useMemo(
    () => toAmount(paymentRows.reduce((sum, row) => sum + Number(row.amount), 0)),
    [paymentRows],
  )
  const periodExpensesTotal = useMemo(
    () => totalExpenses(expenseRows),
    [expenseRows],
  )
  const monthlyRows = useMemo(
    () => buildMonthlyRows(paymentRows, expenseRows),
    [paymentRows, expenseRows],
  )
  const monthlyTotals = useMemo(() => {
    const rows = monthlyRows
    const sales = toAmount(rows.reduce((sum, row) => sum + Number(row.sales), 0))
    const expenses = toAmount(rows.reduce((sum, row) => sum + Number(row.expenses), 0))

    return { sales, expenses, net: toAmount(sales - expenses) }
  }, [monthlyRows])
  const net = toAmount(periodSales - periodExpensesTotal)
  const expenseCount = expenseRows.length
  const paymentCount = paymentRows.length
  const periodHasRecords = paymentCount + expenseCount > 0
  const activePeriodText = describePeriod(range, year, month, bounds)

  const previousPaymentRows = (previousPeriod.data?.previousPayments ?? []).filter((row) =>
    matchesSearch(deferredSearch, paymentSearchValues(row)),
  )
  const previousExpenseRows = (previousPeriod.data?.previousExpenses ?? []).filter((row) =>
    matchesSearch(deferredSearch, expenseSearchValues(row)),
  )
  const previousSales = toAmount(
    previousPaymentRows.reduce((sum, row) => sum + Number(row.amount), 0),
  )
  const previousExpenses = totalExpenses(previousExpenseRows)
  const previousNet = toAmount(previousSales - previousExpenses)
  const comparison = [
    { label: 'Cash in', current: periodSales, previous: previousSales },
    { label: 'Cash out', current: periodExpensesTotal, previous: previousExpenses },
    { label: 'Net', current: net, previous: previousNet },
  ]
  const comparisonDetails = [
    comparisonDetail(comparison[0].current, comparison[0].previous, 'up', previousPeriod.loading, previousPeriod.error),
    comparisonDetail(comparison[1].current, comparison[1].previous, 'down', previousPeriod.loading, previousPeriod.error),
    comparisonDetail(comparison[2].current, comparison[2].previous, 'net', previousPeriod.loading, previousPeriod.error),
  ]

  const paymentPageCount = Math.max(Math.ceil(paymentRows.length / TABLE_PAGE_SIZE), 1)
  const currentPaymentPage = Math.min(paymentPage, paymentPageCount)
  const visiblePayments = paymentRows.slice(
    (currentPaymentPage - 1) * TABLE_PAGE_SIZE,
    currentPaymentPage * TABLE_PAGE_SIZE,
  )

  const expensePageCount = Math.max(Math.ceil(expenseRows.length / TABLE_PAGE_SIZE), 1)
  const currentExpensePage = Math.min(expensePage, expensePageCount)
  const visibleExpenses = expenseRows.slice(
    (currentExpensePage - 1) * TABLE_PAGE_SIZE,
    currentExpensePage * TABLE_PAGE_SIZE,
  )

  const kpiLoading =
    (payments.showSkeleton || expenses.showSkeleton) &&
    (!payments.data || !expenses.data)
  const searchBusy = searchPending || kpiLoading

  useEffect(() => {
    setPaymentPage(1)
    setExpensePage(1)
  }, [bounds.from, bounds.to, deferredSearch])

  const updatePeriodQuery = (updates) => {
    const next = new URLSearchParams(searchParams)
    const nextYear = updates.year ?? year
    const nextMonth = updates.month ?? month
    const nextRange = updates.range ?? range
    next.set('year', String(nextYear))
    next.set('month', nextMonth)
    next.set('range', nextRange)

    for (const key of ['from', 'to']) {
      const value = updates[key] ?? (nextRange === 'custom' ? searchParams.get(key) : '')
      if (value) next.set(key, value)
      else next.delete(key)
    }
    setSearchParams(next, { replace: true })
  }

  const updateCompare = (enabled) => {
    const next = new URLSearchParams(searchParams)
    if (enabled) next.set('compare', '1')
    else next.delete('compare')
    setSearchParams(next, { replace: true })
  }

  useEffect(() => {
    const targetId = tab === 'expenses'
      ? 'expense-ledger'
      : tab === 'summary'
        ? 'finance-summary'
        : null
    if (targetId) document.getElementById(targetId)?.scrollIntoView({ block: 'start' })
  }, [tab])

  const reloadAll = () => {
    invalidateClinicQueries(
      user?.id,
      'finance-expenses',
      'finance-payments',
      'finance-monthly-series',
      'dashboard-summary',
    )
    expenses.reload()
    payments.reload()
    series.reload()
    previousPeriod.reload()
  }

  const exportCsv = async (kind) => {
    if (exporting || !isOnline) return
    setExporting(kind)

    try {
      let rows
      let columns
      let filename
      let exportedRows = 0

      if (kind === 'sales') {
        const paymentsForExport = (await listPaymentExportRows(bounds.from, bounds.to))
          .filter((payment) => matchesSearch(deferredSearch, paymentSearchValues(payment)))
        exportedRows = paymentsForExport.length
        rows = paymentsForExport.map((payment) => ({
          date: payment.payment_date,
          customer: payment.customer,
          itemType: payment.item_type,
          description: payment.description,
          quantity: '',
          unitPrice: '',
          total: payment.amount,
          paymentMethod: paymentMethodOf(payment) ?? '',
          notes: paymentNoteOf(payment) ?? '',
        }))
        const total = toAmount(rows.reduce((sum, row) => sum + Number(row.total), 0))
        rows.push({
          date: '',
          customer: '',
          itemType: '',
          description: 'TOTAL',
          quantity: '',
          unitPrice: '',
          total,
          paymentMethod: '',
          notes: '',
        })
        columns = SALES_COLUMNS
        filename = `eye-troops-sales_${bounds.from}_to_${bounds.to}.csv`
      } else if (kind === 'expenses') {
        const expensesForExport = (await listAllExpenses(bounds.from, bounds.to))
          .filter((expense) => matchesSearch(deferredSearch, expenseSearchValues(expense)))
        exportedRows = expensesForExport.length
        rows = expensesForExport.map((expense) => ({
          date: expense.expense_date,
          category: expense.category,
          vendor: '',
          description: expense.description ?? '',
          amount: expense.amount,
          paymentMethod: '',
          notes: '',
        }))
        const total = toAmount(rows.reduce((sum, row) => sum + Number(row.amount), 0))
        rows.push({
          date: '',
          category: 'TOTAL',
          vendor: '',
          description: '',
          amount: total,
          paymentMethod: '',
          notes: '',
        })
        columns = EXPENSE_COLUMNS
        filename = `eye-troops-expenses_${bounds.from}_to_${bounds.to}.csv`
      } else {
        const [allPaymentsForExport, allExpensesForExport] = await Promise.all([
          listPaymentExportRows(bounds.from, bounds.to),
          listAllExpenses(bounds.from, bounds.to),
        ])
        const paymentsForExport = allPaymentsForExport
          .filter((payment) => matchesSearch(deferredSearch, paymentSearchValues(payment)))
        const expensesForExport = allExpensesForExport
          .filter((expense) => matchesSearch(deferredSearch, expenseSearchValues(expense)))
        const totalSales = toAmount(
          paymentsForExport.reduce((sum, payment) => sum + Number(payment.amount), 0),
        )
        const totalExpenseAmount = totalExpenses(expensesForExport)
        const categoryTotals = new Map()
        for (const expense of expensesForExport) {
          categoryTotals.set(
            expense.category,
            toAmount((categoryTotals.get(expense.category) ?? 0) + Number(expense.amount)),
          )
        }
        rows = [
          {
            type: 'SUMMARY',
            period: `${bounds.from} to ${bounds.to}`,
            totalSales,
            totalExpenses: totalExpenseAmount,
            netProfit: toAmount(totalSales - totalExpenseAmount),
            category: '',
            categoryTotal: '',
          },
          ...[...categoryTotals.entries()]
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([category, categoryTotal]) => ({
              type: 'CATEGORY',
              period: `${bounds.from} to ${bounds.to}`,
              totalSales: '',
              totalExpenses: '',
              netProfit: '',
              category,
              categoryTotal,
            })),
          {
            type: 'TOTAL',
            period: `${bounds.from} to ${bounds.to}`,
            totalSales,
            totalExpenses: totalExpenseAmount,
            netProfit: toAmount(totalSales - totalExpenseAmount),
            category: 'TOTAL',
            categoryTotal: totalExpenseAmount,
          },
        ]
        exportedRows = paymentsForExport.length + expensesForExport.length === 0
          ? 0
          : rows.length - 1
        columns = SUMMARY_COLUMNS
        filename = `eye-troops-finance-summary_${bounds.from}_to_${bounds.to}.csv`
      }

      if (exportedRows === 0) {
        resultDialog.success({
          title: 'Nothing to export',
          message: 'Nothing to export for the selected filters.',
          primaryLabel: 'Close',
        })
        return
      }

      if (exportedRows > 5000) {
        const approved = await confirm({
          title: 'Large export',
          message: `Export ${exportedRows.toLocaleString()} rows? This may take a moment.`,
          confirmLabel: 'Export CSV',
          cancelLabel: 'Cancel',
        })
        if (!approved) return
      }

      downloadCsv(filename, toCsv(rows, columns))
      resultDialog.success({
        title: 'Export complete',
        message: `Export complete. ${exportedRows.toLocaleString()} rows saved to your downloads.`,
        primaryLabel: 'Done',
        autoCloseMs: 6000,
      })
    } catch (caught) {
      resultDialog.error({
        title: 'Could not export CSV',
        message: caught instanceof AppError ? caught.message : 'Please check your connection and try again.',
        details: caught?.cause?.message ?? caught?.message,
        retryLabel: 'Try again',
        onRetry: () => exportCsv(kind),
      })
    } finally {
      setExporting('')
    }
  }

  const deleteExpenseAction = async () => {
    if (!deletingExpense) return
    setDeleting(true)
    try {
      await deleteExpense(deletingExpense.id)
      resultDialog.success({
        title: 'Expense deleted',
        message: `${deletingExpense.category} expense was deleted successfully.`,
      })
      setDeletingExpense(null)
      reloadAll()
    } catch (caught) {
      resultDialog.error({
        title: 'Could not delete the expense',
        message: caught instanceof AppError ? caught.message : 'Please check your connection and try again.',
        details: caught?.cause?.message ?? caught?.message,
        retryLabel: 'Try again',
        onRetry: deleteExpenseAction,
      })
    } finally {
      setDeleting(false)
    }
  }

  const handleDelete = deleteExpenseAction

  return (
    <>
      <PageHeader
        title="Sales & Expenses"
        description="Cash in from payments versus cash out for running the clinic."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" onClick={() => setExpenseOpen(true)}>
              <Plus className="size-4" aria-hidden="true" />
              Add expense
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              loading={exporting === 'expenses'}
              loadingText="Exporting..."
              disabled={!isOnline || Boolean(exporting) || expenses.loading || Boolean(expenses.error) || expenseRows.length === 0}
              onClick={() => void exportCsv('expenses')}
              aria-label="Export expenses CSV"
            >
              <Download className="size-4" aria-hidden="true" />
              Export CSV
            </Button>
          </div>
        }
      />

      <div className="flex flex-col gap-6">
        <Card className="sticky top-16 z-30 overflow-visible today-animate md:top-0" style={{ animationDelay: '0ms' }}>
          <div className="space-y-3 border-b border-champagne bg-surface/95 px-4 py-3 backdrop-blur sm:px-5">
            <div className="flex flex-wrap items-center gap-2">
              <div
                role="group"
                aria-label="Year filters"
                className="flex min-w-0 flex-1 flex-nowrap gap-1.5 overflow-x-auto pb-1 scrollbar-none [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
              >
                {yearChips.map((value) => {
                  const active = range === 'year' && year === value
                  return (
                    <button
                      key={value}
                      type="button"
                      aria-pressed={active}
                      onClick={() => updatePeriodQuery({ year: value, month: 'all', range: 'year' })}
                      className={cn(
                        'inline-flex min-h-9 shrink-0 items-center rounded-md border px-3 py-1 text-[12px] font-semibold transition-colors',
                        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:ring-offset-surface',
                        active
                          ? 'border-gold bg-gold-light text-gold-dark ring-1 ring-current/20'
                          : 'border-champagne bg-surface text-warmgray hover:border-gold/55 hover:text-espresso',
                      )}
                    >
                      {value}
                    </button>
                  )
                })}
              </div>
              {olderYears.length > 0 && (
                <div className="min-w-24">
                  <Select
                    id="older-years"
                    aria-label="More years"
                    placeholder="More"
                    value={olderYears.includes(year) && range === 'year' ? String(year) : ''}
                    options={olderYears.map((val) => ({ value: String(val), label: String(val) }))}
                    onChange={(event, nextVal) => {
                      const selectedVal = nextVal ?? event?.target?.value
                      if (selectedVal) {
                        updatePeriodQuery({
                          year: Number(selectedVal),
                          month: 'all',
                          range: 'year',
                        })
                      }
                    }}
                    className="h-9 min-h-9 px-2.5 text-[12px] font-semibold"
                  />
                </div>
              )}
            </div>

            <div
              role="group"
              aria-label="Month filters"
              className="flex flex-nowrap gap-1.5 overflow-x-auto pb-1 scrollbar-none [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
            >
              {MONTH_OPTIONS.map((option) => {
                const future = option.value !== 'all' && year === currentYear && Number(option.value) > currentMonthIndex
                const active = range === 'year' && month === option.value
                const hasData = option.value !== 'all' && monthsWithData.has(option.value)
                return (
                  <button
                    key={option.value}
                    type="button"
                    disabled={future}
                    aria-pressed={active}
                    aria-label={`${option.label}${hasData ? ', has records' : ''}`}
                    onClick={() => updatePeriodQuery({ year, month: option.value, range: 'year' })}
                    className={cn(
                      'inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-md border px-2.5 py-1 text-[12px] font-semibold transition-colors',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:ring-offset-surface',
                      active
                        ? 'border-gold bg-gold-light text-gold-dark ring-1 ring-current/20'
                        : 'border-champagne bg-surface text-warmgray hover:border-gold/55 hover:text-espresso',
                      future && 'cursor-not-allowed opacity-40 hover:border-champagne hover:text-warmgray',
                    )}
                  >
                    {option.label}
                    {hasData && <span className="size-1.5 rounded-full bg-gold" aria-hidden="true" />}
                  </button>
                )
              })}
            </div>

            <div
              role="group"
              aria-label="Quick date ranges"
              className="flex flex-nowrap gap-1.5 overflow-x-auto pb-1 scrollbar-none [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
            >
              {[...PERIOD_RANGES, { value: 'custom', label: 'Custom date range' }].map((option) => (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={range === option.value}
                  onClick={() => option.value === 'custom'
                    ? updatePeriodQuery({
                        year: currentYear,
                        month: 'all',
                        range: 'custom',
                        from: toDateKey(today),
                        to: toDateKey(today),
                      })
                    : updatePeriodQuery({ year: currentYear, month: 'all', range: option.value })}
                  className={cn(
                    'inline-flex min-h-9 shrink-0 items-center rounded-md border px-2.5 py-1 text-[12px] font-semibold transition-colors',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:ring-offset-surface',
                    range === option.value
                      ? 'border-gold bg-gold-light text-gold-dark ring-1 ring-current/20'
                      : 'border-champagne bg-surface text-warmgray hover:border-gold/55 hover:text-espresso',
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>

            {range === 'custom' && (
              <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                <label className="grid gap-1 text-[11px] font-semibold text-warmgray">
                  From
                  <input
                    type="date"
                    value={customFrom}
                    max={customTo || undefined}
                    onChange={(event) => updatePeriodQuery({
                      range: 'custom',
                      from: event.target.value,
                      to: customTo && customTo >= event.target.value ? customTo : event.target.value,
                    })}
                    aria-label="Custom period start date"
                    className="h-9 rounded-control border border-champagne bg-surface px-2.5 text-[12px] text-espresso focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
                  />
                </label>
                <label className="grid gap-1 text-[11px] font-semibold text-warmgray">
                  To
                  <input
                    type="date"
                    value={customTo}
                    min={customFrom || undefined}
                    onChange={(event) => updatePeriodQuery({ range: 'custom', to: event.target.value })}
                    aria-label="Custom period end date"
                    className="h-9 rounded-control border border-champagne bg-surface px-2.5 text-[12px] text-espresso focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
                  />
                </label>
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-2">
              <SearchInput
                value={search}
                onChange={setSearch}
                loading={searchBusy}
                className="sm:max-w-xs"
                placeholder="Search this period"
                ariaLabel="Search payments and expenses"
              />
              <p className="text-[12px] font-medium text-espresso" aria-live="polite">
                {activePeriodText}
              </p>
              <button
                type="button"
                role="switch"
                aria-checked={compareEnabled}
                aria-label="Compare with previous period"
                onClick={() => updateCompare(!compareEnabled)}
                className="inline-flex min-h-9 items-center gap-2 rounded-control px-1 text-[12px] font-medium text-warmgray focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
              >
                <span className={cn(
                  'relative inline-block h-5 w-9 shrink-0 overflow-hidden rounded-full border transition-colors duration-200',
                  compareEnabled ? 'border-gold bg-gold' : 'border-champagne bg-ivory dark:bg-surface',
                )}>
                  <span className={cn(
                    'absolute top-[3px] left-[3px] size-3 rounded-full bg-surface shadow-sm transition-transform duration-200',
                    compareEnabled ? 'translate-x-4' : 'translate-x-0',
                  )} />
                </span>
                Compare with previous period
              </button>
            </div>
          </div>

        </Card>

        <Card className={cn('overflow-hidden today-animate transition-opacity duration-150', searchPending && 'opacity-60')}>
          <div className="grid gap-3 p-4 sm:grid-cols-3">
            {kpiLoading ? (
              Array.from({ length: 3 }, (_, index) => <MiniStatSkeleton key={index} />)
            ) : (
              <>
                <MiniStat
                  icon={TrendingUp}
                  label={`Cash in · ${paymentCount} payments`}
                  value={formatPesoShort(periodSales)}
                  tone="success"
                  detail={compareEnabled ? comparisonDetails[0].text : undefined}
                  detailTone={comparisonDetails[0].tone}
                />
                <MiniStat
                  icon={TrendingDown}
                  label={`Cash out · ${expenseCount} entries`}
                  value={formatPesoShort(periodExpensesTotal)}
                  tone="neutral"
                  detail={compareEnabled ? comparisonDetails[1].text : undefined}
                  detailTone={comparisonDetails[1].tone}
                />
                <MiniStat
                  icon={Wallet}
                  label="Net (sales − expenses)"
                  value={formatPesoShort(net)}
                  tone={net >= 0 ? 'success' : 'error'}
                  detail={compareEnabled ? comparisonDetails[2].text : undefined}
                  detailTone={comparisonDetails[2].tone}
                />
              </>
            )}
          </div>
          {!kpiLoading && !periodHasRecords && (
            <div className="border-t border-champagne/70">
              <EmptyState
                icon={Receipt}
                title={deferredSearch
                  ? 'No matching records'
                  : `No records for ${range === 'year' && month === 'all' ? year : 'this period'}`}
                description={deferredSearch
                  ? 'Try a different search term.'
                  : 'There are no payments or expenses in this selected period.'}
              />
            </div>
          )}
        </Card>

        <section
          id="finance-summary"
          className={cn('min-w-0 today-animate scroll-mt-16 md:scroll-mt-4', tab === 'summary' && 'rounded-card ring-2 ring-gold ring-offset-2 ring-offset-ivory')}
          style={{ animationDelay: '60ms' }}
        >
          <SectionTitle
            description="Sales, expenses, and net for each month in the selected period."
            action={(
              <div className="flex flex-col items-end gap-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  loading={exporting === 'summary'}
                  loadingText="Exporting..."
                  disabled={!isOnline || Boolean(exporting) || payments.loading || expenses.loading || Boolean(payments.error || expenses.error) || paymentCount + expenseCount === 0}
                  onClick={() => void exportCsv('summary')}
                  aria-label="Export finance summary CSV"
                >
                  <Download className="size-4" aria-hidden="true" />
                  Export CSV
                </Button>
                {!payments.loading && !expenses.loading && !payments.error && !expenses.error && paymentCount + expenseCount === 0 && (
                  <span className="text-xs text-warmgray" role="status">
                    Nothing to export for the selected filters.
                  </span>
                )}
              </div>
            )}
          >
            <span className="inline-flex items-center gap-2">
              Monthly breakdown
              <span className="inline-flex items-center gap-1 rounded-md bg-gold-light/70 px-2 py-0.5 text-[11px] font-semibold text-gold-dark">
                <CalendarDays className="size-3.5" strokeWidth={2} aria-hidden="true" />
                {range === 'year' && month === 'all' ? year : 'Period'}
              </span>
            </span>
          </SectionTitle>

          <Card className={cn('monthly-breakdown-card overflow-hidden transition-opacity duration-150', searchPending && 'opacity-60')}>
          {payments.error || expenses.error ? (
            <div className="p-5">
              <ErrorNote message={payments.error ?? expenses.error} />
            </div>
          ) : ((payments.showSkeleton && !payments.data) || (expenses.showSkeleton && !expenses.data)) ? (
            <Table>
              <SkeletonRows rows={6} columns={4} />
            </Table>
          ) : (
            <Table>
              <THead>
                <tr>
                  <TH>Month</TH>
                  <TH className="text-right">Sales</TH>
                  <TH className="text-right">Expenses</TH>
                  <TH className="text-right">Net</TH>
                </tr>
              </THead>
              <TBody>
                {monthlyRows.map((row, idx) => {
                  const isCurrentMonth = isCurrentYear && row.key === `${year}-${String(currentMonthIndex + 1).padStart(2, '0')}`
                  return (
                  <TR
                    key={row.key}
                    className={cn(
                      idx % 2 === 0 ? 'bg-surface' : 'bg-ivory/40',
                      isCurrentMonth && 'ring-1 ring-inset ring-gold/35',
                    )}
                  >
                    <TD className="font-medium text-espresso">
                      {row.label}
                      {isCurrentMonth && (
                        <span className="ml-2 text-[10px] font-semibold tracking-wide text-gold-dark uppercase">
                          Current
                        </span>
                      )}
                    </TD>
                    <TD className="tabular text-right text-[13px]">{formatPeso(row.sales)}</TD>
                    <TD className="tabular text-right text-[13px] text-warmgray">
                      {formatPeso(row.expenses)}
                    </TD>
                    <TD className="tabular text-right text-[13px]">
                      <span
                        className={cn(
                          'font-semibold',
                          row.net < 0 ? 'text-error' : 'text-espresso',
                        )}
                      >
                        {formatPeso(row.net)}
                      </span>
                    </TD>
                  </TR>
                  )
                })}
              </TBody>
              {monthlyRows.length > 0 && <tfoot>
                <tr className="year-total-row sticky bottom-0 z-10">
                  <TD className="border-t-2 border-gold bg-gold-light py-4 text-sm font-bold text-espresso">
                    Period total
                  </TD>
                  <TD className="tabular border-t-2 border-gold bg-gold-light py-4 text-right text-[15px] font-bold text-espresso">
                    {formatPeso(monthlyTotals.sales)}
                  </TD>
                  <TD className="tabular border-t-2 border-gold bg-gold-light py-4 text-right text-[15px] font-bold text-espresso">
                    {formatPeso(monthlyTotals.expenses)}
                  </TD>
                  <TD className="tabular border-t-2 border-gold bg-gold-light py-4 text-right text-[15px] font-bold">
                    <span className={monthlyTotals.net < 0 ? 'text-error' : 'text-success'}>
                      {formatPeso(monthlyTotals.net)}
                    </span>
                  </TD>
                </tr>
              </tfoot>}
            </Table>
          )}
        </Card>
        </section>

        <div className="grid items-start gap-6 lg:grid-cols-2">
        <section className="min-w-0 today-animate" style={{ animationDelay: '100ms' }}>
          <SectionTitle
            description="Every payment received in the selected period."
            action={(
              <div className="flex flex-col items-end gap-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  loading={exporting === 'sales'}
                  loadingText="Exporting..."
                  disabled={!isOnline || Boolean(exporting) || payments.loading || Boolean(payments.error) || paymentCount === 0}
                  onClick={() => void exportCsv('sales')}
                  aria-label="Export sales CSV"
                >
                  <Download className="size-4" aria-hidden="true" />
                  Export CSV
                </Button>
                {!payments.loading && !payments.error && paymentCount === 0 && (
                  <span className="text-xs text-warmgray" role="status">
                    Nothing to export for the selected filters.
                  </span>
                )}
              </div>
            )}
          >
            <span className="inline-flex items-center gap-2.5">
              Payments received
              {!payments.loading && (
                <span className="inline-flex items-center gap-1.5 rounded-md bg-gold-light/70 px-2 py-0.5 text-[11px] font-semibold text-gold-dark">
                  <Receipt className="size-3.5" strokeWidth={2} aria-hidden="true" />
                  {paymentCount}
                </span>
              )}
            </span>
          </SectionTitle>

          <Card className={cn('overflow-hidden transition-opacity duration-150', searchPending && 'opacity-60')}>
            {payments.error ? (
              <div className="p-5">
                <ErrorNote message={payments.error} />
              </div>
            ) : payments.showSkeleton && !payments.data ? (
              <Table>
                <SkeletonRows rows={4} columns={3} />
              </Table>
            ) : paymentRows.length > 0 ? (
              <>
                <Table>
                  <THead>
                    <tr>
                      <TH className="w-28">Date</TH>
                      <TH>Method / reference</TH>
                      <TH className="w-32 text-right">Amount</TH>
                    </tr>
                  </THead>
                  <TBody>
                    {visiblePayments.map((payment, idx) => (
                      <TR
                        key={payment.id}
                        className={idx % 2 === 0 ? 'bg-surface' : 'bg-ivory/40'}
                      >
                        <TD className="tabular text-[13px] text-warmgray">
                          {formatDateShort(payment.payment_date)}
                        </TD>
                        <TD className="min-w-0 text-[13px] text-warmgray">
                          <span className="font-medium text-espresso">
                            {paymentMethodOf(payment) ?? 'Payment'}
                          </span>
                          {paymentNoteOf(payment) && (
                            <span className="text-warmgray/80">
                              {' · '}
                              {paymentNoteOf(payment)}
                            </span>
                          )}
                        </TD>
                        <TD className="tabular text-right text-[13px] font-semibold text-success">
                          {formatPeso(payment.amount)}
                        </TD>
                      </TR>
                    ))}
                  </TBody>
                </Table>

                <Pagination
                  page={currentPaymentPage}
                  pageCount={paymentPageCount}
                  total={paymentRows.length}
                  pageSize={TABLE_PAGE_SIZE}
                  itemLabel="payment"
                  ariaLabel="payments pagination"
                  onPageChange={setPaymentPage}
                />
              </>
            ) : (
              <EmptyState
                icon={TrendingUp}
                title={deferredSearch ? 'No matching payments' : `No payments in ${range === 'year' && month === 'all' ? year : 'this period'}`}
                description={deferredSearch ? 'Try a different search term.' : 'Payments recorded against orders will show here for the selected period.'}
              />
            )}
          </Card>
        </section>

        <section
          id="expense-ledger"
          className={cn('min-w-0 today-animate scroll-mt-16 md:scroll-mt-4', tab === 'expenses' && 'rounded-card ring-2 ring-gold ring-offset-2 ring-offset-ivory')}
          style={{ animationDelay: '140ms' }}
        >
          <SectionTitle
            description="Clinic costs recorded in the selected period."
            action={(
              !expenses.loading && !expenses.error && expenseCount === 0 && (
                <span className="text-xs text-warmgray" role="status">
                  Nothing to export for the selected filters.
                </span>
              )
            )}
          >
            <span className="inline-flex items-center gap-2.5">
              Expenses
              {!expenses.loading && (
                <span className="inline-flex items-center gap-1.5 rounded-md bg-gold-light/70 px-2 py-0.5 text-[11px] font-semibold text-gold-dark">
                  <TrendingDown className="size-3.5" strokeWidth={2} aria-hidden="true" />
                  {expenseCount}
                </span>
              )}
            </span>
          </SectionTitle>

          <Card className={cn('overflow-hidden transition-opacity duration-150', searchPending && 'opacity-60')}>
            {expenses.error ? (
              <div className="p-5">
                <ErrorNote message={expenses.error} />
              </div>
            ) : expenses.showSkeleton && !expenses.data ? (
              <Table>
                <SkeletonRows rows={4} columns={4} />
              </Table>
            ) : expenseRows.length > 0 ? (
              <>
                <Table>
                  <THead>
                    <tr>
                      <TH className="w-28">Date</TH>
                      <TH>Category</TH>
                      <TH className="w-28 text-right">Amount</TH>
                      <TH className="w-24 text-right">Actions</TH>
                    </tr>
                  </THead>
                  <TBody>
                    {visibleExpenses.map((expense, idx) => (
                      <TR
                        key={expense.id}
                        className={idx % 2 === 0 ? 'bg-surface' : 'bg-ivory/40'}
                      >
                        <TD className="tabular text-[13px] text-warmgray">
                          {formatDateShort(expense.expense_date)}
                        </TD>
                        <TD className="min-w-0">
                          <p className="text-sm font-medium text-espresso">{expense.category}</p>
                          {expense.description && (
                            <p className="truncate text-xs text-warmgray">{expense.description}</p>
                          )}
                        </TD>
                        <TD className="tabular text-right text-[13px] font-semibold text-espresso">
                          {formatPeso(expense.amount)}
                        </TD>
                        <TD>
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setEditingExpense(expense)}
                              aria-label={`Edit ${expense.category} expense`}
                              className="size-9"
                            >
                              <Pencil className="size-4" aria-hidden="true" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setDeletingExpense(expense)}
                              aria-label={`Delete ${expense.category} expense`}
                              className="size-9 text-error hover:bg-error/5 hover:text-error"
                            >
                              <Trash2 className="size-4" aria-hidden="true" />
                            </Button>
                          </div>
                        </TD>
                      </TR>
                    ))}
                  </TBody>
                </Table>

                <Pagination
                  page={currentExpensePage}
                  pageCount={expensePageCount}
                  total={expenseRows.length}
                  pageSize={TABLE_PAGE_SIZE}
                  itemLabel="expense"
                  ariaLabel="expenses pagination"
                  onPageChange={setExpensePage}
                />
              </>
            ) : (
              <EmptyState
                icon={TrendingDown}
                title={deferredSearch ? 'No matching expenses' : `No expenses in ${range === 'year' && month === 'all' ? year : 'this period'}`}
                description="Record rent, utilities, and other clinic costs."
                action={
                  <Button variant="outline" size="sm" onClick={() => setExpenseOpen(true)}>
                    <Plus className="size-4" aria-hidden="true" />
                    Add expense
                  </Button>
                }
              />
            )}
          </Card>
        </section>
        </div>
      </div>

      <ExpenseDialog
        key={editingExpense?.id ?? 'new-expense'}
        open={expenseOpen || Boolean(editingExpense)}
        expense={editingExpense}
        defaultDate={toDateKey(today)}
        onClose={() => {
          setExpenseOpen(false)
          setEditingExpense(null)
        }}
        onSaved={reloadAll}
      />

      <ConfirmDialog
        open={Boolean(deletingExpense)}
        title="Delete this expense?"
        message={`${deletingExpense?.category ?? 'This expense'} of ${formatPeso(deletingExpense?.amount ?? 0)} will be permanently removed from the yearly totals.`}
        confirmLabel="Delete expense"
        loading={deleting}
        onConfirm={handleDelete}
        onClose={() => setDeletingExpense(null)}
        confirmDisabled={!isOnline}
      />
    </>
  )
}
