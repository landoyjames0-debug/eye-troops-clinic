import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  AlertCircle,
  Banknote,
  Ban,
  Check,
  Package,
  PackageSearch,
  Pencil,
  Plus,
  Printer,
  Wallet,
} from 'lucide-react'
import { PageHeader, Avatar } from '@/components/layout/page-header'
import { Card, Table, TBody, TD, TH, THead, TR } from '@/components/ui/card'
import { Badge, StatusBadge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Pagination } from '@/components/ui/pagination'
import { EmptyState, ErrorNote, Skeleton, SkeletonRows } from '@/components/ui/feedback'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { Select } from '@/components/Select'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { AddPaymentDialog } from '@/components/orders/add-payment-dialog'
import { EditOrderDialog } from '@/components/orders/edit-order-dialog'
import { PrescriptionTable } from '@/components/visits/prescription-table'
import { useAuth } from '@/hooks/use-auth'
import { useAsync } from '@/hooks/use-async'
import { useDebouncedSearchParam } from '@/hooks/use-debounced-search-param'
import { useResultDialog } from '@/hooks/use-result-dialog'
import { useSupabaseHealth } from '@/hooks/use-supabase-health'
import {
  cancelOrder,
  getOrderStatusHistory,
  isCompletedPayment,
  listOrders,
  updateOrderStatus,
} from '@/services/orders.service'
import { voidPayment } from '@/services/payments.service'
import { invalidateClinicQueries } from '@/lib/query-client'
import { getPrescriptionForVisit } from '@/services/visits.service'
import {
  ORDER_STATUSES,
  ORDER_STATUS_META,
  ORDER_STATUS_FILTERS,
  TABLE_PAGE_SIZE,
} from '@/lib/constants'
import { paymentMethodOf, paymentNoteOf } from '@/lib/constants'
import { printOrderReceipt } from '@/utils/receipt'
import { formatDate, formatTime, formatPeso } from '@/utils/format'
import { statusLabel } from '@/utils/strings'
import { AppError } from '@/utils/errors'
import { cn } from '@/lib/utils'
import { SearchInput } from '@/components/ui/search-input'

const PAYMENT_FILTER_OPTIONS = [
  { value: 'ALL', label: 'All' },
  { value: 'OUTSTANDING', label: 'Outstanding' },
  { value: 'PAID', label: 'Paid' },
  { value: 'OVERDUE', label: 'Overdue' },
]

const STATUS_FILTER_OPTIONS = [
  { value: 'ALL', label: 'All' },
  ...ORDER_STATUS_FILTERS.map((meta) => ({
    value: meta.value,
    label: meta.value === 'READY_FOR_PICKUP' ? 'Ready' : meta.label,
  })),
]

const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest' },
  { value: 'oldest', label: 'Oldest' },
  { value: 'highest-balance', label: 'Highest balance' },
  { value: 'oldest-unpaid', label: 'Oldest unpaid' },
]

const OVERDUE_AFTER_DAYS = 30
const MODULE_NOW = Date.now()

const STATUS_TONES = {
  ORDERED: {
    slug: 'ordered',
    label: 'Ordered',
    chip: 'border-[var(--color-status-ordered)] bg-[var(--color-status-ordered-bg)] text-[var(--color-status-ordered)]',
  },
  IN_LAB: {
    slug: 'in-lab',
    label: 'In Lab',
    chip: 'border-[var(--color-status-in-lab)] bg-[var(--color-status-in-lab-bg)] text-[var(--color-status-in-lab)]',
  },
  READY_FOR_PICKUP: {
    slug: 'ready',
    label: 'Ready',
    chip: 'border-[var(--color-status-ready)] bg-[var(--color-status-ready-bg)] text-[var(--color-status-ready)]',
  },
  CLAIMED: {
    slug: 'claimed',
    label: 'Claimed',
    chip: 'border-[var(--color-status-claimed)] bg-[var(--color-status-claimed-bg)] text-[var(--color-status-claimed)]',
  },
  CANCELLED: {
    slug: 'cancelled',
    label: 'Cancelled',
    chip: 'border-[var(--color-status-cancelled)] bg-[var(--color-status-cancelled-bg)] text-[var(--color-status-cancelled)]',
  },
}

function paymentMatches(order, filter) {
  if (filter === 'OUTSTANDING') {
    return order.balance > 0 && !['CANCELLED', 'CLAIMED'].includes(order.status)
  }
  if (filter === 'PAID') return order.balance <= 0
  if (filter === 'OVERDUE') {
    const age = MODULE_NOW - Date.parse(`${order.order_date}T00:00:00`)
    return order.balance > 0 && order.status !== 'CANCELLED' && age >= OVERDUE_AFTER_DAYS * 86_400_000
  }
  return true
}

function dateMatches(order, from, to) {
  if (from && order.order_date < from) return false
  if (to && order.order_date > to) return false
  return true
}

function sortOrders(rows, sort) {
  return [...rows].sort((left, right) => {
    const dateOrder = Date.parse(right.order_date) - Date.parse(left.order_date)
    if (sort === 'oldest') return -dateOrder
    if (sort === 'highest-balance') return right.balance - left.balance || dateOrder
    if (sort === 'oldest-unpaid') {
      const leftUnpaid = left.balance > 0 && left.status !== 'CANCELLED'
      const rightUnpaid = right.balance > 0 && right.status !== 'CANCELLED'
      if (leftUnpaid !== rightUnpaid) return leftUnpaid ? -1 : 1
      return Date.parse(left.order_date) - Date.parse(right.order_date)
    }
    return dateOrder
  })
}

function OrderStatusBadge({ status }) {
  const tone = STATUS_TONES[status] ?? STATUS_TONES.ORDERED
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap', tone.chip)}>
      <span className="size-1.5 rounded-full bg-current" aria-hidden="true" />
      {tone.label}
    </span>
  )
}

function FilterChips({ label, options, selected, onChange, getCount, getTone, busy = false }) {
  return (
    <div className={cn('min-w-0 transition-opacity duration-150', busy && 'opacity-60')}>
      <span className="sr-only">{label}</span>
      <div
        role="group"
        aria-label={`${label} filters`}
        className="flex min-w-0 flex-nowrap gap-1.5 overflow-x-auto pb-1 scrollbar-none [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
      >
        {options.map((option) => {
          const active = selected === option.value
          const tone = getTone?.(option.value)
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={active}
              onClick={() => onChange(option.value)}
              className={cn(
                'inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-md border px-2.5 py-1 text-[12px] font-semibold transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:ring-offset-surface',
                tone
                  ? tone.chip
                  : active
                    ? 'border-gold bg-gold-light text-gold-dark'
                    : 'border-champagne bg-surface text-warmgray hover:border-gold/55 hover:text-espresso',
                active && 'ring-1 ring-current/20',
              )}
            >
              {option.label} <span className="tabular opacity-80">({getCount(option.value)})</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function MiniStat({ icon: Icon, label, value, tone = 'neutral', active = false, onClick }) {
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

  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-3 rounded-card border bg-surface px-4 py-3 text-left shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:shadow-raised',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:ring-offset-surface',
        active ? 'border-gold bg-gold-light/35 shadow-raised' : 'border-champagne/60 hover:border-gold/55',
      )}
    >
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
      </div>
    </button>
  )
}

/**
 * Ordered → In Lab → Ready for Pickup → Claimed. Each step is clickable so the
 * drawer doubles as the control for advancing an order.
 */
function StatusProgress({ status, onChange, busy }) {
  const currentIndex = ORDER_STATUSES.indexOf(status)

  return (
    <ol className="flex items-center">
      {ORDER_STATUS_META.map((meta, index) => {
        const done = index < currentIndex
        const current = index === currentIndex
        return (
          <li key={meta.value} className={cn('flex items-center', index > 0 && 'flex-1')}>
            {index > 0 && (
              <span
                className={cn(
                  'mx-1.5 h-px flex-1',
                  index <= currentIndex ? 'bg-gold' : 'bg-champagne',
                )}
                aria-hidden="true"
              />
            )}
            <button
              type="button"
              disabled={busy}
              onClick={() => onChange(meta.value)}
              aria-current={current ? 'step' : undefined}
              title={meta.description}
              className={cn(
                'flex size-7 shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold transition-colors',
                'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold',
                'disabled:opacity-60',
                done && 'border-success bg-success text-white',
                current && 'border-gold bg-gold text-white',
                !done && !current && 'border-champagne bg-white text-warmgray hover:bg-gold-light',
              )}
            >
              {done ? <Check className="size-3.5" aria-hidden="true" /> : index + 1}
              <span className="sr-only">{meta.label}</span>
            </button>
          </li>
        )
      })}
    </ol>
  )
}

function StepLabels({ status }) {
  const currentIndex = ORDER_STATUSES.indexOf(status)
  return (
    <div className="mt-2 flex justify-between gap-1">
      {ORDER_STATUS_META.map((meta, index) => (
        <span
          key={meta.value}
          className={cn(
            'flex-1 text-center text-[10px] leading-tight',
            index === currentIndex ? 'font-semibold text-espresso' : 'text-warmgray',
          )}
        >
          {meta.label}
        </span>
      ))}
    </div>
  )
}

function DrawerLabel({ children }) {
  return (
    <h3 className="text-[11px] font-semibold tracking-wider text-warmgray uppercase">{children}</h3>
  )
}

export default function OrdersPage() {
  const { userId } = useAuth()
  const resultDialog = useResultDialog()
  const { isOnline } = useSupabaseHealth()
  const [searchParams, setSearchParams] = useSearchParams()
  const { search, setSearch, deferredSearch, searchPending } = useDebouncedSearchParam()
  const requestedStatus = searchParams.get('status') ?? 'ALL'
  const rawStatus = requestedStatus.toLowerCase() === 'ready' ? 'READY_FOR_PICKUP' : requestedStatus
  const status = STATUS_FILTER_OPTIONS.some((option) => option.value === rawStatus) ? rawStatus : 'ALL'
  const rawPayment = (searchParams.get('payment') ?? 'ALL').toUpperCase()
  const paymentFilter = PAYMENT_FILTER_OPTIONS.some((option) => option.value === rawPayment)
  ? rawPayment
  : 'ALL'
  const dateFrom = searchParams.get('from') ?? ''
  const dateTo = searchParams.get('to') ?? ''
  const rawSort = searchParams.get('sort') ?? 'newest'
  const sort = SORT_OPTIONS.some((option) => option.value === rawSort) ? rawSort : 'newest'
  const [selectedId, setSelectedId] = useState(null)
  const [payFor, setPayFor] = useState(null)
  const [savingStatus, setSavingStatus] = useState(false)
  const [editingOrder, setEditingOrder] = useState(null)
  const [confirmCancel, setConfirmCancel] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [voiding, setVoiding] = useState(null)
  const [voidingBusy, setVoidingBusy] = useState(false)
  const [page, setPage] = useState(1)

  const orders = useAsync(
    () => listOrders(deferredSearch, 'ALL', 'ALL'),
    [deferredSearch],
    'loadOrders',
    { key: 'orders-list' },
  )

  const requestedOrderId = searchParams.get('order')
  useEffect(() => {
    if (requestedOrderId) setSelectedId(requestedOrderId)
  }, [requestedOrderId])

  const selected = orders.data?.find((row) => row.id === selectedId) ?? null
  const dateOrders = useMemo(
    () => (orders.data ?? []).filter((order) => dateMatches(order, dateFrom, dateTo)),
    [dateFrom, dateTo, orders.data],
  )

  const statusCounts = useMemo(
    () => Object.fromEntries(
      STATUS_FILTER_OPTIONS.map((option) => [
        option.value,
        dateOrders.filter((order) =>
          (option.value === 'ALL' || order.status === option.value) &&
          paymentMatches(order, paymentFilter),
        ).length,
      ]),
    ),
    [dateOrders, paymentFilter],
  )

  const paymentCounts = useMemo(
    () => Object.fromEntries(
      PAYMENT_FILTER_OPTIONS.map((option) => [
        option.value,
        dateOrders.filter((order) =>
          (status === 'ALL' || order.status === status) &&
          paymentMatches(order, option.value),
        ).length,
      ]),
    ),
    [dateOrders, status],
  )

  const filteredOrders = useMemo(
    () => sortOrders(
      dateOrders.filter((order) =>
        (status === 'ALL' || order.status === status) && paymentMatches(order, paymentFilter),
      ),
      sort,
    ),
    [dateOrders, paymentFilter, sort, status],
  )

  const total = filteredOrders.length
  const pageCount = Math.max(Math.ceil(total / TABLE_PAGE_SIZE), 1)
  const currentPage = Math.min(page, pageCount)
  const pageRows = filteredOrders.slice(
    (currentPage - 1) * TABLE_PAGE_SIZE,
    currentPage * TABLE_PAGE_SIZE,
  )

  const outstandingCount = useMemo(
    () => filteredOrders.filter(
      (order) => order.balance > 0 && order.status !== 'CANCELLED',
    ).length,
    [filteredOrders],
  )

  const totalOutstanding = useMemo(
    () => filteredOrders.reduce(
      (sum, order) =>
        ['CANCELLED', 'CLAIMED'].includes(order.status) ? sum : sum + Math.max(order.balance, 0),
      0,
    ),
    [filteredOrders],
  )

  const filtersActive =
    Boolean(search.trim()) || status !== 'ALL' || paymentFilter !== 'ALL' ||
    Boolean(dateFrom || dateTo) || sort !== 'newest'

  const searchBusy = searchPending || orders.loading

  useEffect(() => {
    setPage(1)
  }, [deferredSearch, status, paymentFilter, dateFrom, dateTo, sort])

  const updateQuery = (key, value, defaultValue) => {
    const next = new URLSearchParams(searchParams)
    if (!value || value === defaultValue) next.delete(key)
    else next.set(key, value)
    setSearchParams(next, { replace: true })
  }

  const clearSearch = () => {
    setSearch('')
  }

  const clearFilters = () => {
    clearSearch()
    const next = new URLSearchParams(searchParams)
    for (const key of ['search', 'status', 'payment', 'from', 'to', 'sort']) next.delete(key)
    setSearchParams(next, { replace: true })
  }

  const updateStatusAction = async (order, next) => {
    setSavingStatus(true)
    try {
      await updateOrderStatus(order.id, next)
      resultDialog.success({
        title: 'Order status updated',
        message: `${order.order_number} is now ${statusLabel(next)}.`,
      })
      invalidateClinicQueries(userId, 'loadOrders', 'dashboard-summary', 'today-activity', 'today-pickups')
      orders.reload()
    } catch (caught) {
      resultDialog.error({
        title: 'Could not update the order status',
        message: caught instanceof AppError ? caught.message : 'Please check your connection and try again.',
        details: caught?.cause?.message ?? caught?.message,
        retryLabel: 'Try again',
        onRetry: () => updateStatusAction(order, next),
      })
    } finally {
      setSavingStatus(false)
    }
  }

  const handleStatusChange = updateStatusAction

  const cancelOrderAction = async () => {
    if (!selected) return
    setCancelling(true)
    try {
      await cancelOrder(selected.id)
      resultDialog.success({
        title: 'Order cancelled',
        message: `${selected.order_number} was cancelled. Its payments remain on record.`,
      })
      setConfirmCancel(false)
      invalidateClinicQueries(userId, 'loadOrders', 'dashboard-summary', 'today-activity', 'today-pickups')
      orders.reload()
    } catch (caught) {
      resultDialog.error({
        title: 'Could not cancel the order',
        message: caught instanceof AppError ? caught.message : 'Please check your connection and try again.',
        details: caught?.cause?.message ?? caught?.message,
        retryLabel: 'Try again',
        onRetry: cancelOrderAction,
      })
    } finally {
      setCancelling(false)
    }
  }

  const handleCancel = cancelOrderAction

  const voidPaymentAction = async () => {
    if (!voiding) return
    setVoidingBusy(true)
    try {
      await voidPayment(voiding.id)
      resultDialog.success({
        title: 'Payment voided',
        message: `The payment for ${voiding.order_number} no longer counts as paid.`,
      })
      setVoiding(null)
      invalidateClinicQueries(userId, 'loadOrders', 'dashboard-summary', 'today-activity', 'today-pickups', 'loadPayments', 'today-collections')
      orders.reload()
    } catch (caught) {
      resultDialog.error({
        title: 'Could not void the payment',
        message: caught instanceof AppError ? caught.message : 'Please check your connection and try again.',
        details: caught?.cause?.message ?? caught?.message,
        retryLabel: 'Try again',
        onRetry: voidPaymentAction,
      })
    } finally {
      setVoidingBusy(false)
    }
  }

  const handleVoid = voidPaymentAction

  const printReceipt = () => {
    if (!selected) return
    // Falls back to the name already on the row if the roster has not loaded.
    const printed = printOrderReceipt(
      selected,
      selected.patient ?? { full_name: selected.patient_name, cp_number: selected.patient_phone },
    )
    if (!printed) {
      resultDialog.error({
        title: 'Could not open the receipt',
        message: 'Allow pop-ups for this site, then try again.',
        retryLabel: 'Try again',
        onRetry: printReceipt,
      })
    }
  }

  const handlePrint = printReceipt

  return (
    <>
      <PageHeader
        title="Orders & Balances"
        description="Track order status, payments, and outstanding balances."
        action={
          <Button asChild size="sm">
            <Link to="/new-visit">
              <Plus className="size-4" aria-hidden="true" />
              New visit
            </Link>
          </Button>
        }
      />

      <div className="flex flex-col gap-6">
      {orders.data && !orders.error && (
        <div className={cn('grid gap-3 today-animate sm:grid-cols-3 transition-opacity duration-150', searchBusy && 'opacity-60')} style={{ animationDelay: '0ms' }}>
          <MiniStat
            icon={Package}
            label="Orders in view"
            value={total}
            tone="neutral"
            active={status === 'ALL' && paymentFilter === 'ALL'}
            onClick={() => {
              const next = new URLSearchParams(searchParams)
              next.delete('status')
              next.delete('payment')
              setSearchParams(next, { replace: true })
            }}
          />
          <MiniStat
            icon={AlertCircle}
            label="With balance due"
            value={outstandingCount}
            tone={outstandingCount > 0 ? 'error' : 'success'}
            active={paymentFilter === 'OUTSTANDING'}
            onClick={() => updateQuery('payment', 'OUTSTANDING', 'ALL')}
          />
          <MiniStat
            icon={Wallet}
            label="Total outstanding"
            value={formatPeso(totalOutstanding)}
            tone={totalOutstanding > 0 ? 'warning' : 'success'}
            active={paymentFilter === 'OUTSTANDING'}
            onClick={() => updateQuery('payment', 'OUTSTANDING', 'ALL')}
          />
        </div>
      )}

      <Card className="overflow-hidden today-animate" style={{ animationDelay: '60ms' }}>
        <div className="space-y-2.5 border-b border-champagne px-5 py-3.5">
          <div className="flex flex-wrap items-center gap-2.5">
            <SearchInput
              value={search}
              onChange={setSearch}
              loading={searchBusy}
              className="min-w-48 flex-1 sm:max-w-sm"
                placeholder="Search order number, patient, or CP number"
              ariaLabel="Search order number, patient name, or CP number"
            />

            {orders.data && !orders.error && (
              <span className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-gold-light/70 px-2 py-0.5 text-[11px] font-semibold text-gold-dark">
                <PackageSearch className="size-3.5" strokeWidth={2} aria-hidden="true" />
                Showing {total} of {orders.data?.length ?? 0} orders
              </span>
            )}

            {filtersActive && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={clearFilters}
                className="h-8 shrink-0 px-2 text-[12px] text-warmgray"
              >
                Clear filters
              </Button>
            )}
          </div>

          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)_auto] lg:items-end">
            <FilterChips
              label="Payment"
              options={PAYMENT_FILTER_OPTIONS}
              selected={paymentFilter}
              onChange={(value) => updateQuery('payment', value, 'ALL')}
              getCount={(value) => paymentCounts[value] ?? 0}
              busy={searchBusy}
              getTone={(value) => value === 'OVERDUE' ? {
                chip: 'border-[var(--color-status-cancelled)] bg-[var(--color-status-cancelled-bg)] text-[var(--color-status-cancelled)]',
              } : null}
            />
            <FilterChips
              label="Status"
              options={STATUS_FILTER_OPTIONS}
              selected={status}
              onChange={(value) => updateQuery('status', value, 'ALL')}
              getCount={(value) => statusCounts[value] ?? 0}
              getTone={(value) => STATUS_TONES[value]}
              busy={searchBusy}
            />
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-semibold tracking-wide text-warmgray uppercase">Sort</span>
              <Select
                value={sort}
                onChange={(event, nextVal) => {
                  const selectedVal = nextVal ?? event?.target?.value
                  if (selectedVal) updateQuery('sort', selectedVal, 'newest')
                }}
                aria-label="Sort orders"
                options={SORT_OPTIONS}
                className="h-9 min-h-9 min-w-40 px-2.5 text-[12px] font-medium"
              />
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
            <label className="grid gap-1 text-[11px] font-semibold tracking-wide text-warmgray uppercase">
              From
              <input
                type="date"
                value={dateFrom}
                max={dateTo || undefined}
                onChange={(event) => updateQuery('from', event.target.value)}
                aria-label="Orders from date"
                className="h-9 min-w-0 rounded-control border border-champagne bg-surface px-2.5 text-[12px] font-medium normal-case tracking-normal text-espresso focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
              />
            </label>
            <label className="grid gap-1 text-[11px] font-semibold tracking-wide text-warmgray uppercase">
              To
              <input
                type="date"
                value={dateTo}
                min={dateFrom || undefined}
                onChange={(event) => updateQuery('to', event.target.value)}
                aria-label="Orders to date"
                className="h-9 min-w-0 rounded-control border border-champagne bg-surface px-2.5 text-[12px] font-medium normal-case tracking-normal text-espresso focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
              />
            </label>
            <span className="hidden text-[11px] text-warmgray sm:block">Order date range</span>
          </div>
        </div>

        <div
          aria-busy={searchBusy || orders.loading || undefined}
          className={cn(
            'transition-opacity duration-150',
            (searchBusy || orders.loading) && orders.data && 'opacity-60',
          )}
        >
        {orders.error ? (
          <div className="p-5">
            <ErrorNote message={orders.error} />
          </div>
        ) : orders.showSkeleton && !orders.data ? (
          <Table>
            <SkeletonRows rows={6} columns={8} />
          </Table>
        ) : !orders.data ? (
          <div className="min-h-72" />
        ) : total > 0 ? (
          <>
            <Table>
            <THead>
              <tr>
                <TH className="w-36">Order Number</TH>
                <TH className="hidden w-32 lg:table-cell">Order Date</TH>
                <TH>Patient</TH>
                <TH className="w-36">Status</TH>
                <TH className="w-32 text-right">Total</TH>
                <TH className="hidden w-32 text-right md:table-cell">Paid</TH>
                <TH className="w-32 text-right">Balance</TH>
                <TH className="w-24" />
              </tr>
            </THead>
            <TBody>
              {pageRows.map((order, idx) => (
                <TR
                  key={order.id}
                  className={cn(
                    'order-row cursor-pointer',
                    `order-row--${STATUS_TONES[order.status]?.slug ?? 'ordered'}`,
                    idx % 2 === 0 ? 'bg-surface' : 'bg-ivory/40',
                  )}
                  onClick={() => setSelectedId(order.id)}
                >
                  <TD>
                    <span className="tabular rounded-md bg-ivory px-2 py-0.5 text-[12px] font-semibold text-espresso ring-1 ring-champagne/70 ring-inset">
                      {order.order_number}
                    </span>
                  </TD>
                  <TD className="tabular hidden text-[13px] text-warmgray lg:table-cell">
                    {formatDate(order.order_date)}
                  </TD>
                  <TD>
                    <div className="flex items-center gap-3">
                      <Avatar name={order.patient_name} />
                      <span className="truncate text-sm font-medium text-espresso">
                        {order.patient_name}
                      </span>
                    </div>
                  </TD>
                  <TD>
                    <OrderStatusBadge status={order.status} />
                  </TD>
                  <TD className="tabular text-right text-[13px]">
                    {formatPeso(order.total_amount)}
                  </TD>
                  <TD className="tabular hidden text-right text-[13px] text-success md:table-cell">
                    {formatPeso(order.paid)}
                  </TD>
                  <TD className="text-right">
                    {order.balance <= 0 ? (
                      <Badge variant="success">Paid</Badge>
                    ) : (
                      <span className="tabular text-[13px] font-semibold text-error">
                        {formatPeso(order.balance)}
                      </span>
                    )}
                  </TD>
                  <TD onClick={(event) => event.stopPropagation()}>
                    {order.balance > 0 && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setPayFor(order)}
                        aria-label={`Record payment for ${order.order_number}`}
                      >
                        <Banknote className="size-4" aria-hidden="true" />
                        Pay
                      </Button>
                    )}
                  </TD>
                </TR>
              ))}
            </TBody>
            </Table>

            <Pagination
              page={currentPage}
              pageCount={pageCount}
              total={total}
              pageSize={TABLE_PAGE_SIZE}
              itemLabel="order"
              ariaLabel="orders pagination"
              onPageChange={setPage}
            />
          </>
        ) : orders.data?.length === 0 && !filtersActive ? (
          <EmptyState
            icon={Package}
            title="No orders yet"
            description="Orders created from a visit will appear here."
            action={
              <Button asChild variant="outline" size="sm">
                <Link to="/new-visit">Record a visit</Link>
              </Button>
            }
          />
        ) : (
          <EmptyState
            icon={PackageSearch}
            title="No matching orders"
            description="Try a different search or loosen the status, payment, or date filters."
            action={
              <Button variant="outline" size="sm" onClick={clearFilters}>
                Clear filters
              </Button>
            }
          />
        )}
        </div>
      </Card>
      </div>

      <OrderDrawer
        order={selected}
        busy={savingStatus || !isOnline}
        isOnline={isOnline}
        onClose={() => setSelectedId(null)}
        onPay={() => {
          if (selected) setPayFor(selected)
        }}
        onStatusChange={(next) => {
          if (selected) void handleStatusChange(selected, next)
        }}
        onEdit={() => {
          if (selected) setEditingOrder(selected)
        }}
        onPrint={handlePrint}
        onCancel={() => setConfirmCancel(true)}
        onVoid={(payment) =>
          setVoiding({ ...payment, order_number: selected?.order_number ?? '' })
        }
      />

      <AddPaymentDialog
        key={payFor?.id ?? 'no-payment'}
        order={payFor}
        onClose={() => setPayFor(null)}
        onSaved={() => {
          invalidateClinicQueries(userId, 'loadOrders', 'dashboard-summary', 'today-activity', 'today-pickups', 'today-collections', 'loadPayments')
          orders.reload()
        }}
      />

      <EditOrderDialog
        key={editingOrder?.id ?? 'no-edit'}
        order={editingOrder}
        onClose={() => setEditingOrder(null)}
        onSaved={() => {
          invalidateClinicQueries(userId, 'loadOrders', 'dashboard-summary', 'today-activity', 'today-pickups')
          orders.reload()
        }}
      />

      <ConfirmDialog
        open={confirmCancel}
        title="Cancel this order?"
        message={`${selected?.order_number ?? 'This order'} will be marked cancelled and stop counting toward outstanding balances. Its payments stay on record.`}
        confirmLabel="Cancel order"
        loading={cancelling}
        confirmDisabled={!isOnline}
        onConfirm={handleCancel}
        onClose={() => setConfirmCancel(false)}
      />

      <ConfirmDialog
        open={Boolean(voiding)}
        title="Void this payment?"
        message={`${formatPeso(voiding?.amount ?? 0)} received on ${formatDate(voiding?.payment_date)} will stop counting toward the amount paid. The entry stays in the ledger.`}
        confirmLabel="Void payment"
        loading={voidingBusy}
        confirmDisabled={!isOnline}
        onConfirm={handleVoid}
        onClose={() => setVoiding(null)}
      />
    </>
  )
}

function OrderDrawer({ order, busy, isOnline, onClose, onPay, onStatusChange, onEdit, onPrint, onCancel, onVoid }) {
  // Fully controlled: the parent owns which order is selected.
  const handleOpenChange = (next) => {
    if (!next) onClose()
  }

  const prescription = useAsync(
    () => getPrescriptionForVisit(order?.visit_id ?? null),
    [order?.visit_id],
    'loadVisits',
    { key: 'order-prescription' },
  )

  // Re-reads when the status changes so a freshly logged transition appears
  // without the drawer having to be closed and reopened.
  const history = useAsync(
    () => (order ? getOrderStatusHistory(order.id) : Promise.resolve([])),
    [order?.id, order?.status],
    'loadOrders',
    { key: 'order-status-history' },
  )

  const isCancelled = order?.status === 'CANCELLED'

  // Derive the pickup moment from the status trail rather than trusting a
  // separately-written `claimed_at`, which may not exist on older rows.
  const claimedEntry = history.data?.find((entry) => entry.status === 'CLAIMED')
  const claimedTime = order?.claimed_at ?? claimedEntry?.changed_at
  const claimedBy = order?.claimed_by ?? claimedEntry?.changed_by

  return (
    <Sheet open={Boolean(order)} onOpenChange={handleOpenChange}>
      <SheetContent
        title={order?.order_number ?? 'Order details'}
        description={order?.patient_name}
        footer={
          order && (
            <>
              {order.balance > 0 && !isCancelled && (
                <Button size="sm" onClick={onPay} disabled={!isOnline}>
                  <Banknote className="size-4" aria-hidden="true" />
                  Add payment
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={() => handleOpenChange(false)}>
                Close
              </Button>
            </>
          )
        }
      >
        {order && (
          <div className="space-y-8">
            {/* Balance leads, because it is the reason this drawer gets opened. */}
            <div
              className={cn(
                'rounded-control border px-4 py-3.5',
                order.balance > 0
                  ? 'border-error/25 bg-error/5'
                  : 'border-success/25 bg-success/5',
              )}
            >
              <div className="flex items-baseline justify-between gap-4">
                <p className="text-[11px] font-semibold tracking-wider text-warmgray uppercase">
                  {order.balance > 0 ? 'Balance due' : 'Settled in full'}
                </p>
                <StatusBadge status={order.status} />
              </div>
              <p
                className={cn(
                  'tabular mt-1 font-display text-[28px] leading-none font-bold',
                  order.balance > 0 ? 'text-error' : 'text-success',
                )}
              >
                {order.balance > 0 ? formatPeso(order.balance) : 'Paid'}
              </p>
            </div>

            <section>
              <DrawerLabel>Order</DrawerLabel>
              <dl className="mt-3 grid gap-x-6 sm:grid-cols-2">
                <div className="border-b border-champagne/70 py-2.5">
                  <dt className="text-[11px] tracking-wider text-warmgray uppercase">Patient</dt>
                  <dd className="mt-0.5 text-sm text-espresso">{order.patient_name}</dd>
                </div>
                <div className="border-b border-champagne/70 py-2.5">
                  <dt className="text-[11px] tracking-wider text-warmgray uppercase">Order date</dt>
                  <dd className="tabular mt-0.5 text-sm text-espresso">
                    {formatDate(order.order_date)}
                  </dd>
                </div>
                <div className="py-2.5 sm:col-span-2">
                  <dt className="text-[11px] tracking-wider text-warmgray uppercase">Items</dt>
                  <dd className="mt-0.5 text-sm text-espresso">{order.description ?? '—'}</dd>
                </div>
              </dl>

              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={onEdit}
                  disabled={isCancelled || !isOnline}
                >
                  <Pencil className="size-4" aria-hidden="true" />
                  Edit order
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={onPrint}>
                  <Printer className="size-4" aria-hidden="true" />
                  Print receipt
                </Button>
                {!isCancelled && order.status !== 'CLAIMED' && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={onCancel}
                    disabled={!isOnline}
                    className="text-error hover:border-error/40 hover:bg-error/5 hover:text-error"
                  >
                    <Ban className="size-4" aria-hidden="true" />
                    Cancel order
                  </Button>
                )}
              </div>
            </section>

            <section>
              <DrawerLabel>Prescription</DrawerLabel>
              <div className="mt-2.5 overflow-hidden rounded-control border border-champagne">
                {prescription.loading ? (
                  <div className="p-4">
                    <Skeleton className="h-20 w-full" />
                  </div>
                ) : prescription.data ? (
                  <PrescriptionTable prescription={prescription.data} />
                ) : (
                  <p className="px-4 py-4 text-[13px] text-warmgray">
                    No prescription recorded for this order.
                  </p>
                )}
              </div>
            </section>

            <section>
              <DrawerLabel>Financial summary</DrawerLabel>
              <dl className="mt-3 space-y-2.5">
                <div className="flex justify-between">
                  <dt className="text-[13px] text-warmgray">Order total</dt>
                  <dd className="tabular text-sm text-espresso">
                    {formatPeso(order.total_amount)}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-[13px] text-warmgray">Amount paid</dt>
                  <dd className="tabular text-sm text-espresso">{formatPeso(order.paid)}</dd>
                </div>
                <div className="flex justify-between border-t border-champagne pt-2.5">
                  <dt className="text-[13px] font-medium text-espresso">Balance</dt>
                  <dd
                    className={cn(
                      'tabular text-sm font-semibold',
                      order.balance > 0 ? 'text-error' : 'text-success',
                    )}
                  >
                    {formatPeso(order.balance)}
                  </dd>
                </div>
              </dl>
            </section>

            <section>
              <DrawerLabel>Order status</DrawerLabel>
              <div className="mt-3">
                {isCancelled ? (
                  <p className="text-[13px] text-warmgray">
                    This order was cancelled. It stays on record for reference but no longer counts
                    toward outstanding balances.
                  </p>
                ) : (
                  <>
                    <StatusProgress
                      status={order.status}
                      busy={busy}
                      onChange={(next) => {
                        if (next !== order.status) onStatusChange(next)
                      }}
                    />
                    <StepLabels status={order.status} />
                    <p className="mt-2.5 text-[13px] text-warmgray">
                      {
                        ORDER_STATUS_META.find((meta) => meta.value === order.status)?.description
                      }
                    </p>
                  </>
                )}
              </div>
            </section>

            {order.status === 'CLAIMED' && (
              <section>
                <DrawerLabel>Picked up</DrawerLabel>
                <dl className="mt-3 grid gap-x-6 sm:grid-cols-2">
                  <div className="border-b border-champagne/70 py-2.5 sm:col-span-2">
                    <dt className="text-[11px] tracking-wider text-warmgray uppercase">
                      {claimedTime ? 'Date' : 'Claimed'}
                    </dt>
                    <dd className="mt-0.5 text-sm text-espresso">
                      {claimedTime
                        ? `${formatDate(claimedTime)} at ${formatTime(claimedTime)}`
                        : '—'}
                    </dd>
                  </div>
                  <div className="border-b border-champagne/70 py-2.5 sm:col-span-2">
                    <dt className="text-[11px] tracking-wider text-warmgray uppercase">
                      Collected by
                    </dt>
                    <dd className="mt-0.5 text-sm text-espresso">
                      {order.claimed_by || claimedBy || '—'}
                    </dd>
                  </div>
                </dl>
              </section>
            )}

            <section>
              <DrawerLabel>Status history</DrawerLabel>
              {history.loading ? (
                <div className="mt-2.5">
                  <Skeleton className="h-16 w-full" />
                </div>
              ) : history.data && history.data.length > 0 ? (
                <ol className="mt-2.5 space-y-2">
                  {history.data.map((entry) => (
                    <li
                      key={entry.id}
                      className="flex items-center justify-between gap-3 text-[13px]"
                    >
                      <div className="flex items-center gap-2.5">
                        <StatusBadge status={entry.status} />
                        {entry.changed_by && (
                          <span className="text-warmgray">by {entry.changed_by}</span>
                        )}
                      </div>
                      <span className="tabular text-warmgray">
                        {formatDate(entry.changed_at)} · {formatTime(entry.changed_at)}
                      </span>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="mt-2.5 text-[13px] text-warmgray">
                  No status changes recorded for this order.
                </p>
              )}
            </section>

            <section>
              <DrawerLabel>Payment history</DrawerLabel>
              {order.payments.length === 0 ? (
                <p className="mt-2.5 text-[13px] text-warmgray">No payments recorded.</p>
              ) : (
                <ul className="mt-2.5 divide-y divide-champagne/70">
                  {order.payments.map((payment) => {
                    const voided = !isCompletedPayment(payment)
                    return (
                      <li
                        key={payment.id}
                        className="flex items-center justify-between gap-3 py-2.5 first:pt-0"
                      >
                        <div className="min-w-0">
                          <p className="tabular text-[13px] text-espresso">
                            {formatDate(payment.payment_date)}
                          </p>
                          <p className="truncate text-xs text-warmgray">
                            {[
                              paymentMethodOf(payment),
                              paymentNoteOf(payment),
                            ]
                              .filter(Boolean)
                              .join(' · ') || 'Payment'}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-1.5">
                          <span
                            className={cn(
                              'tabular text-[13px] font-semibold',
                              voided ? 'text-warmgray line-through' : 'text-espresso',
                            )}
                          >
                            {formatPeso(payment.amount)}
                          </span>
                          {voided ? (
                            <StatusBadge status="VOIDED" />
                          ) : !isCancelled ? (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => onVoid(payment)}
                              disabled={!isOnline}
                              aria-label={`Void payment of ${formatPeso(payment.amount)}`}
                              className="text-warmgray hover:text-error"
                            >
                              <Ban className="size-4" aria-hidden="true" />
                            </Button>
                          ) : null}
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )}
            </section>
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}
