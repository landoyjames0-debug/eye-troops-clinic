import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import {
  AlertCircle,
  Banknote,
  Ban,
  Check,
  Loader2,
  Package,
  PackageSearch,
  Pencil,
  Plus,
  Printer,
  Search,
  Wallet,
  X,
} from 'lucide-react'
import { PageHeader, Avatar } from '@/components/layout/page-header'
import { Card, Table, TBody, TD, TH, THead, TR } from '@/components/ui/card'
import { Badge, StatusBadge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Pagination } from '@/components/ui/pagination'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { EmptyState, ErrorNote, Skeleton, SkeletonRows } from '@/components/ui/feedback'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { ChoiceGroup } from '@/components/ui/choice-group'
import { AddPaymentDialog } from '@/components/orders/add-payment-dialog'
import { EditOrderDialog } from '@/components/orders/edit-order-dialog'
import { PrescriptionTable } from '@/components/visits/prescription-table'
import { useAsync } from '@/hooks/use-async'
import {
  cancelOrder,
  getOrderStatusHistory,
  isCompletedPayment,
  listOrders,
  updateOrderStatus,
} from '@/services/orders.service'
import { voidPayment } from '@/services/payments.service'
import { listPatients } from '@/services/patients.service'
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

const SEARCH_DEBOUNCE_MS = 300

const PAYMENT_FILTER_OPTIONS = [
  { value: 'ALL', label: 'All' },
  { value: 'OUTSTANDING', label: 'Outstanding' },
  { value: 'PAID', label: 'Paid' },
]

const STATUS_FILTER_OPTIONS = [
  { value: 'ALL', label: 'All' },
  ...ORDER_STATUS_FILTERS.map((meta) => ({
    value: meta.value,
    label: meta.value === 'READY_FOR_PICKUP' ? 'Ready' : meta.label,
  })),
]

function MiniStat({ icon: Icon, label, value, tone = 'neutral' }) {
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
    <div className="flex items-center gap-3 rounded-xl border border-champagne/60 bg-surface px-4 py-3 shadow-card transition-all duration-200 hover:shadow-raised">
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
    </div>
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
  const [searchParams, setSearchParams] = useSearchParams()
  const initialSearch = searchParams.get('search') ?? ''

  const [search, setSearch] = useState(initialSearch)
  const [deferredSearch, setDeferredSearch] = useState(initialSearch)
  const [status, setStatus] = useState('ALL')
  const [paymentFilter, setPaymentFilter] = useState('ALL')
  const [selectedId, setSelectedId] = useState(null)
  const [payFor, setPayFor] = useState(null)
  const [savingStatus, setSavingStatus] = useState(false)
  const [editingOrder, setEditingOrder] = useState(null)
  const [confirmCancel, setConfirmCancel] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [voiding, setVoiding] = useState(null)
  const [voidingBusy, setVoidingBusy] = useState(false)
  const [page, setPage] = useState(1)
  const [patientsById, setPatientsById] = useState(new Map())

  const orders = useAsync(
    async () => {
      const rows = await listOrders(deferredSearch, status, paymentFilter)
      const patients = await listPatients()
      const byId = new Map(patients.map((patient) => [patient.id, patient]))
      // Kept in state so the receipt can print the patient's mobile, not just
      // the name the table already shows.
      setPatientsById(byId)
      return rows.map((order) => ({
        ...order,
        patient_name: byId.get(order.patient_id)?.full_name ?? '—',
      }))
    },
    [deferredSearch, status, paymentFilter],
    'loadOrders',
  )

  const selected = orders.data?.find((row) => row.id === selectedId) ?? null
  const total = orders.data?.length ?? 0
  const pageCount = Math.max(Math.ceil(total / TABLE_PAGE_SIZE), 1)
  const currentPage = Math.min(page, pageCount)
  const pageRows = orders.data?.slice(
    (currentPage - 1) * TABLE_PAGE_SIZE,
    currentPage * TABLE_PAGE_SIZE,
  )

  const outstandingCount = useMemo(
    () =>
      (orders.data ?? []).filter(
        (order) => order.balance > 0 && order.status !== 'CANCELLED',
      ).length,
    [orders.data],
  )

  const totalOutstanding = useMemo(
    () =>
      (orders.data ?? []).reduce(
        (sum, order) =>
          order.status === 'CANCELLED' ? sum : sum + Math.max(order.balance, 0),
        0,
      ),
    [orders.data],
  )

  const filtersActive =
    Boolean(deferredSearch.trim()) || status !== 'ALL' || paymentFilter !== 'ALL'

  const searchPending = search.trim() !== deferredSearch.trim()
  const searchBusy =
    searchPending || (orders.loading && Boolean(deferredSearch.trim()))

  useEffect(() => {
    const id = window.setTimeout(() => setDeferredSearch(search), SEARCH_DEBOUNCE_MS)
    return () => window.clearTimeout(id)
  }, [search])

  useEffect(() => {
    setPage(1)
  }, [deferredSearch, status, paymentFilter])

  useEffect(() => {
    const trimmed = deferredSearch.trim()
    const inUrl = (searchParams.get('search') ?? '').trim()
    if (trimmed === inUrl) return
    const next = new URLSearchParams(searchParams)
    if (trimmed) next.set('search', trimmed)
    else next.delete('search')
    setSearchParams(next, { replace: true })
  }, [deferredSearch, searchParams, setSearchParams])

  const applySearchNow = () => {
    setDeferredSearch(search)
  }

  const clearSearch = () => {
    setSearch('')
    setDeferredSearch('')
  }

  const clearFilters = () => {
    clearSearch()
    setStatus('ALL')
    setPaymentFilter('ALL')
  }

  const handleStatusChange = async (order, next) => {
    setSavingStatus(true)
    try {
      await updateOrderStatus(order.id, next)
      toast.success('Status updated', { description: `${order.order_number} → ${statusLabel(next)}` })
      orders.reload()
    } catch (caught) {
      toast.error('Could not update the status', {
        description: caught instanceof AppError ? caught.message : 'Please try again.',
      })
    } finally {
      setSavingStatus(false)
    }
  }

  const handleCancel = async () => {
    if (!selected) return
    setCancelling(true)
    try {
      await cancelOrder(selected.id)
      toast.success('Order cancelled', {
        description: `${selected.order_number} was cancelled. Its payments stay on record.`,
      })
      setConfirmCancel(false)
      orders.reload()
    } catch (caught) {
      toast.error('Could not cancel the order', {
        description: caught instanceof AppError ? caught.message : 'Please try again.',
      })
    } finally {
      setCancelling(false)
    }
  }

  const handleVoid = async () => {
    if (!voiding) return
    setVoidingBusy(true)
    try {
      await voidPayment(voiding.id)
      toast.success('Payment voided', {
        description: `${voiding.order_number} — the amount no longer counts as paid.`,
      })
      setVoiding(null)
      orders.reload()
    } catch (caught) {
      toast.error('Could not void the payment', {
        description: caught instanceof AppError ? caught.message : 'Please try again.',
      })
    } finally {
      setVoidingBusy(false)
    }
  }

  const handlePrint = () => {
    if (!selected) return
    // Falls back to the name already on the row if the roster has not loaded.
    const printed = printOrderReceipt(
      selected,
      patientsById.get(selected.patient_id) ?? { full_name: selected.patient_name },
    )
    if (!printed) {
      toast.error('Could not open the receipt', {
        description: 'Allow pop-ups for this site, then try again.',
      })
    }
  }

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
      {!orders.loading && !orders.error && (
        <div className="grid gap-3 today-animate sm:grid-cols-3" style={{ animationDelay: '0ms' }}>
          <MiniStat icon={Package} label="Orders in view" value={total} tone="neutral" />
          <MiniStat
            icon={AlertCircle}
            label="With balance due"
            value={outstandingCount}
            tone={outstandingCount > 0 ? 'error' : 'success'}
          />
          <MiniStat
            icon={Wallet}
            label="Total outstanding"
            value={formatPeso(totalOutstanding)}
            tone={totalOutstanding > 0 ? 'warning' : 'success'}
          />
        </div>
      )}

      <Card className="overflow-hidden today-animate" style={{ animationDelay: '60ms' }}>
        <div className="space-y-2.5 border-b border-champagne px-5 py-3.5">
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="relative min-w-[12rem] flex-1 sm:max-w-sm">
              {searchBusy ? (
                <Loader2
                  className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 animate-spin text-gold"
                  aria-hidden="true"
                />
              ) : (
                <Search
                  className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-warmgray"
                  aria-hidden="true"
                />
              )}
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault()
                    applySearchNow()
                  }
                  if (event.key === 'Escape') {
                    event.preventDefault()
                    clearSearch()
                  }
                }}
                placeholder="Search order number or patient name"
                aria-label="Search order number or patient name"
                aria-busy={searchBusy}
                className="h-10 w-full rounded-[var(--radius-control)] border border-champagne bg-ivory/50 pr-10 pl-10 text-sm text-espresso transition-all duration-200 placeholder:text-warmgray/55 focus:border-gold focus:bg-white focus:ring-2 focus:ring-gold/20 focus:outline-none"
              />
              {search.length > 0 && (
                <button
                  type="button"
                  onClick={clearSearch}
                  className="absolute top-1/2 right-2.5 flex size-7 -translate-y-1/2 items-center justify-center rounded-md text-warmgray transition-colors hover:bg-champagne/60 hover:text-espresso focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/30"
                  aria-label="Clear search"
                >
                  <X className="size-4" aria-hidden="true" />
                </button>
              )}
            </div>

            {!orders.loading && !orders.error && (
              <span className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-gold-light/70 px-2 py-0.5 text-[11px] font-semibold text-gold-dark">
                <PackageSearch className="size-3.5" strokeWidth={2} aria-hidden="true" />
                {total} {total === 1 ? 'order' : 'orders'}
                {filtersActive ? ' · filtered' : ''}
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
                Clear
              </Button>
            )}
          </div>

          <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:gap-4">
            <ChoiceGroup
              id="payment-filter"
              label="Payment"
              labelPosition="inline"
              size="compact"
              layout="wrap"
              value={paymentFilter}
              options={PAYMENT_FILTER_OPTIONS}
              onChange={setPaymentFilter}
              className="lg:w-auto lg:shrink-0"
            />
            <span className="hidden h-5 w-px shrink-0 bg-champagne lg:block" aria-hidden="true" />
            <ChoiceGroup
              id="status-filter"
              label="Status"
              labelPosition="inline"
              size="compact"
              layout="scroll"
              value={status}
              options={STATUS_FILTER_OPTIONS}
              onChange={setStatus}
              className="min-w-0 flex-1"
            />
          </div>
        </div>

        {orders.error ? (
          <div className="p-5">
            <ErrorNote message={orders.error} />
          </div>
        ) : orders.loading ? (
          <Table>
            <SkeletonRows rows={6} columns={8} />
          </Table>
        ) : orders.data && orders.data.length > 0 ? (
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
                    'cursor-pointer',
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
                    <StatusBadge status={order.status} />
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
        ) : (
          <EmptyState
            icon={filtersActive ? PackageSearch : Package}
            title={filtersActive ? 'No matching orders' : 'No orders yet'}
            description={
              filtersActive
                ? 'Try a different search or loosen the status and payment filters.'
                : 'Orders created from a visit will appear here.'
            }
            action={
              filtersActive ? (
                <Button variant="outline" size="sm" onClick={clearFilters}>
                  Clear filters
                </Button>
              ) : (
                <Button asChild variant="outline" size="sm">
                  <Link to="/new-visit">Record a visit</Link>
                </Button>
              )
            }
          />
        )}
      </Card>
      </div>

      <OrderDrawer
        order={selected}
        busy={savingStatus}
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
        onSaved={orders.reload}
      />

      <EditOrderDialog
        key={editingOrder?.id ?? 'no-edit'}
        order={editingOrder}
        onClose={() => setEditingOrder(null)}
        onSaved={orders.reload}
      />

      <ConfirmDialog
        open={confirmCancel}
        title="Cancel this order?"
        message={`${selected?.order_number ?? 'This order'} will be marked cancelled and stop counting toward outstanding balances. Its payments stay on record.`}
        confirmLabel="Cancel order"
        loading={cancelling}
        onConfirm={handleCancel}
        onClose={() => setConfirmCancel(false)}
      />

      <ConfirmDialog
        open={Boolean(voiding)}
        title="Void this payment?"
        message={`${formatPeso(voiding?.amount ?? 0)} received on ${formatDate(voiding?.payment_date)} will stop counting toward the amount paid. The entry stays in the ledger.`}
        confirmLabel="Void payment"
        loading={voidingBusy}
        onConfirm={handleVoid}
        onClose={() => setVoiding(null)}
      />
    </>
  )
}

function OrderDrawer({ order, busy, onClose, onPay, onStatusChange, onEdit, onPrint, onCancel, onVoid }) {
  // Fully controlled: the parent owns which order is selected.
  const handleOpenChange = (next) => {
    if (!next) onClose()
  }

  const prescription = useAsync(
    () => getPrescriptionForVisit(order?.visit_id ?? null),
    [order?.visit_id],
    'loadVisits',
  )

  // Re-reads when the status changes so a freshly logged transition appears
  // without the drawer having to be closed and reopened.
  const history = useAsync(
    () => (order ? getOrderStatusHistory(order.id) : Promise.resolve([])),
    [order?.id, order?.status],
    'loadOrders',
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
                <Button size="sm" onClick={onPay}>
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
                'rounded-[var(--radius-control)] border px-4 py-3.5',
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
                  disabled={isCancelled}
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
              <div className="mt-2.5 overflow-hidden rounded-[var(--radius-control)] border border-champagne">
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
