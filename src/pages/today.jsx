import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  ArrowUpRight,
  Banknote,
  CalendarCheck,
  CalendarPlus,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Clock,
  Copy,
  PackageCheck,
  Phone,
  PhoneCall,
  PiggyBank,
  PlusCircle,
  Receipt,
  TrendingDown,
  TrendingUp,
  Wallet,
  Activity,
  CreditCard,
  Plus,
} from 'lucide-react'
import { PageHeader, SectionTitle, StatTile, Avatar } from '@/components/layout/page-header'
import { Card, Table, TBody, TD, TH, THead, TR } from '@/components/ui/card'
import { Badge, StatusBadge } from '@/components/ui/badge'
import { EmptyState, ErrorNote, Skeleton } from '@/components/ui/feedback'
import { Button } from '@/components/ui/button'
import { Select, Textarea } from '@/components/ui/input'
import { DatePicker } from '@/components/DatePicker'
import { useAuth } from '@/hooks/use-auth'
import { useAsync } from '@/hooks/use-async'
import { useConfirm } from '@/hooks/use-confirm'
import { useResultDialog } from '@/hooks/use-result-dialog'
import { listPatientRoster } from '@/services/patients.service'
import { createFollowup, getFollowupCounts, listFollowups, markDone, snooze } from '@/lib/followups'
import { invalidateClinicQueries } from '@/lib/query-client'
import { prefetchRouteWithDebounce, cancelRoutePrefetch } from '@/lib/prefetch'
import {
  getDashboardSummary,
  getPickupsDue,
  getTodayActivity,
} from '@/services/dashboard.service'
import { collectionsByMethod } from '@/services/payments.service'
import { toAmount, toDateKey } from '@/utils/dates'
import { formatDateShort, formatLongDate, formatPeso, formatTime } from '@/utils/format'
import { AppError } from '@/utils/errors'
import { cn } from '@/lib/utils'

/* ── constants ─────────────────────────────────────────────────── */

/** Resolved once so the header date stays stable across re-renders. */
const TODAY_LABEL = formatLongDate(new Date())
/** Current month label for KPI context labels. */
const CURRENT_MONTH = new Date()
  .toLocaleDateString('en-PH', { month: 'long', year: 'numeric' })
  .toUpperCase()

/** A finished order sitting this long is the one that needs a phone call. */
const OVERDUE_AFTER_DAYS = 7

/** Rows per page for pagination. */
const ACTIVITY_PAGE_SIZE = 3
const PICKUPS_PAGE_SIZE = 2

const FOLLOWUP_FILTERS = [
  { value: 'all', label: 'All', countKey: 'all' },
  { value: 'overdue', label: 'Overdue', countKey: 'overdue' },
  { value: 'today', label: 'Today', countKey: 'today' },
  { value: 'this-week', label: 'This week', countKey: 'thisWeek' },
]

const FOLLOWUP_REASONS = [
  { value: 'review', label: 'Review' },
  { value: 'checkup', label: 'Check-up' },
  { value: 'pickup', label: 'Pickup' },
  { value: 'balance', label: 'Balance' },
  { value: 'other', label: 'Other' },
]

/* ── helpers ───────────────────────────────────────────────────── */

function daysSince(value) {
  if (!value) return 0
  return Math.floor((Date.now() - Date.parse(value)) / 86_400_000)
}

function getGreeting() {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

function followupDueStatus(dueDate) {
  const today = toDateKey()
  if (dueDate < today) return { label: 'Overdue', variant: 'error' }
  if (dueDate === today) return { label: 'Due today', variant: 'warning' }
  return { label: 'Upcoming', variant: 'neutral' }
}

function followupReasonLabel(reason) {
  return FOLLOWUP_REASONS.find((item) => item.value === reason)?.label ?? 'Other'
}

/* ── reusable pagination component ─────────────────────────────── */

function Pagination({ currentPage, totalPages, onPageChange }) {
  if (totalPages <= 1) return null

  return (
    <div className="flex items-center justify-between border-t border-champagne/60 px-4 py-3">
      <p className="text-[12px] text-warmgray tabular">
        Page {currentPage} of {totalPages}
      </p>
      <div className="flex items-center gap-1">
        <button
          type="button"
          disabled={currentPage <= 1}
          onClick={(e) => { e.stopPropagation(); onPageChange(currentPage - 1) }}
          className="inline-flex size-8 items-center justify-center rounded-lg text-warmgray transition-colors hover:bg-gold-light hover:text-espresso disabled:opacity-40 disabled:pointer-events-none"
          aria-label="Previous page"
        >
          <ChevronLeft className="size-4" strokeWidth={2} />
        </button>

        {Array.from({ length: totalPages }, (_, i) => {
          const page = i + 1
          const isActive = page === currentPage
          return (
            <button
              key={page}
              type="button"
              onClick={(e) => { e.stopPropagation(); onPageChange(page) }}
              className={`inline-flex size-8 items-center justify-center rounded-lg text-[12px] font-semibold tabular transition-all duration-150 ${
                isActive
                  ? 'bg-gold text-white shadow-sm'
                  : 'text-warmgray hover:bg-gold-light hover:text-espresso'
              }`}
            >
              {page}
            </button>
          )
        })}

        <button
          type="button"
          disabled={currentPage >= totalPages}
          onClick={(e) => { e.stopPropagation(); onPageChange(currentPage + 1) }}
          className="inline-flex size-8 items-center justify-center rounded-lg text-warmgray transition-colors hover:bg-gold-light hover:text-espresso disabled:opacity-40 disabled:pointer-events-none"
          aria-label="Next page"
        >
          <ChevronRight className="size-4" strokeWidth={2} />
        </button>
      </div>
    </div>
  )
}

/* ── skeleton placeholder ──────────────────────────────────────── */

function TileSkeleton() {
  return (
    <div className="rounded-card border border-champagne bg-surface p-5 shadow-card min-h-40 animate-pulse">
      <Skeleton className="h-3 w-24" />
      <Skeleton className="mt-3.5 h-7 w-32" />
    </div>
  )
}

/* ── pickup card (replaces cramped table row) ──────────────────── */

function PickupCard({ orderId, patientId, patient, orderNumber, readyDate, balance, status, overdue, waitingDays }) {
  return (
    <article className="group relative flex cursor-pointer items-start gap-3.5 rounded-xl border border-transparent px-4 py-4 transition-all hover:-translate-y-0.5 hover:border-gold/70 hover:bg-gold-light/30 hover:shadow-raised focus-within:border-gold/70 focus-within:bg-gold-light/20 motion-reduce:transition-none">
      <Link
        to={`/orders?order=${encodeURIComponent(orderId)}&status=READY_FOR_PICKUP`}
        aria-label={`View pickup order ${orderNumber} for ${patient}`}
        className="absolute inset-0 z-0 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-inset"
      />
      <Avatar name={patient} className="size-9 text-[11px] mt-0.5" />
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <Link to={`/patients?patient=${encodeURIComponent(patientId)}`} className="relative z-10 inline-block max-w-full truncate text-[13.5px] font-semibold text-espresso underline-offset-2 hover:text-gold-dark hover:underline focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-gold">
              {patient}
            </Link>
            <p className="mt-0.5 text-[12px] text-warmgray tabular">{orderNumber}</p>
          </div>
          <StatusBadge status={status} />
        </div>

        <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1.5">
          <span className="inline-flex items-center gap-1.5 text-[12px]">
            <span className="text-warmgray">Ready:</span>
            <span className={overdue ? 'font-semibold text-error' : 'tabular text-espresso'}>
              {formatDateShort(readyDate)}
            </span>
            {overdue && (
              <Badge variant="error" className="ml-0.5">
                <Phone className="size-3" strokeWidth={2} />
                {waitingDays}d
              </Badge>
            )}
          </span>
          <span className="inline-flex items-center gap-1.5 text-[12px]">
            <span className="text-warmgray">Balance:</span>
            <span className="tabular font-semibold text-espresso">{formatPeso(balance)}</span>
          </span>
        </div>
      </div>
      <ArrowUpRight className="pointer-events-none absolute right-3 bottom-3 size-4 text-gold-dark opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 motion-reduce:transition-none" aria-hidden="true" />
    </article>
  )
}

/* ── collection bar for the "by method" section ────────────────── */

function CollectionBar({ method, amount, maxAmount }) {
  const pct = maxAmount > 0 ? (amount / maxAmount) * 100 : 0
  return (
    <div className="group flex items-center gap-4 rounded-lg px-4 py-3.5 transition-colors hover:bg-gold-light/40">
      <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-linear-to-br from-gold-light to-gold/15 text-gold-dark">
        <CreditCard className="size-4" strokeWidth={1.7} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="mb-1.5 flex items-baseline justify-between gap-3">
          <span className="text-[13px] font-semibold text-espresso">{method}</span>
          <span className="tabular text-[13px] font-bold text-gold-dark">{formatPeso(amount)}</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-champagne/50">
          <div
            className="h-full rounded-full bg-linear-to-r from-gold to-gold-dark transition-all duration-700 ease-out"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    </div>
  )
}

/* ── follow-up row (Phase B) ───────────────────────────────────── */

function FollowupRow({ item, busy, onAction, onCopyPhone }) {
  const [expanded, setExpanded] = useState(false)
  const dueStatus = followupDueStatus(item.due_date)
  const hasPhone = Boolean(item.patient_phone)

  return (
    <article
      className={cn('border-b border-champagne/60 last:border-b-0', busy && 'opacity-60 pointer-events-none')}
      aria-busy={busy || undefined}
    >
      <div className="grid gap-3 px-4 py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
        {/* Patient info */}
        <div className="flex min-w-0 items-start gap-3">
          <Avatar name={item.patient_name} className="mt-0.5 size-9 shrink-0 text-[11px]" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <Link
                to={`/patients?patient=${encodeURIComponent(item.patient_id)}`}
                className="truncate text-[13px] font-semibold text-espresso underline-offset-2 hover:text-gold-dark hover:underline focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-gold"
              >
                {item.patient_name}
              </Link>
              <Badge variant={item.reason === 'pickup' ? 'gold' : 'neutral'}>{followupReasonLabel(item.reason)}</Badge>
              <Badge variant={dueStatus.variant}>{dueStatus.label}</Badge>
            </div>
            <p className="mt-1 text-[12px] text-warmgray">
              Due {formatDateShort(item.due_date)}{item.notes ? ` · ${item.notes}` : ''}
            </p>
          </div>
        </div>

        {/* Action bar */}
        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
          <a
            href={hasPhone ? `tel:${item.patient_phone.replace(/[^\d+]/g, '')}` : undefined}
            aria-label={`Call ${item.patient_name}${hasPhone ? ` at ${item.patient_phone}` : ''}`}
            aria-disabled={!hasPhone || undefined}
            className={cn(
              'inline-flex min-h-11 items-center gap-1.5 rounded-control border border-champagne bg-surface px-3 text-[12px] font-medium text-espresso transition-colors hover:border-gold/60 hover:bg-gold-light/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold motion-reduce:transition-none',
              !hasPhone && 'pointer-events-none opacity-45',
            )}
          >
            <PhoneCall className="size-3.5" aria-hidden="true" /> Call
          </a>

          <Button
            type="button"
            variant="outline"
            size="icon"
            className="min-h-11 min-w-11"
            disabled={!hasPhone}
            aria-label={`Copy ${item.patient_name}'s phone number`}
            title="Copy phone number"
            onClick={() => void onCopyPhone(item.patient_phone, item.patient_name)}
          >
            <Copy className="size-4" aria-hidden="true" />
          </Button>

          <Button asChild type="button" variant="outline" size="sm" className="min-h-11" aria-label={`Schedule follow-up for ${item.patient_name}`}>
            <Link to={`/appointments?patient=${encodeURIComponent(item.patient_id)}&type=Follow%20Up`}>
              <CalendarPlus className="size-4" aria-hidden="true" /> Schedule
            </Link>
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            className="min-h-11"
            loading={busy}
            aria-label={`Mark ${item.patient_name}'s follow-up done`}
            onClick={() => void onAction(item, 'done')}
          >
            <Check className="size-4" aria-hidden="true" /> Done
          </Button>

          <div className="relative min-w-28">
            <Select
              id={`snooze-${item.id}`}
              value=""
              disabled={busy}
              placeholder="Snooze"
              aria-label={`Snooze ${item.patient_name}'s follow-up`}
              options={[
                { value: '1', label: '1 day' },
                { value: '3', label: '3 days' },
                { value: '7', label: '1 week' },
              ]}
              onChange={(e, val) => {
                const snoozeValue = val ?? e?.target?.value
                if (snoozeValue) void onAction(item, 'snooze', Number(snoozeValue))
              }}
              className="h-11 min-h-11 text-[12px]"
            />
          </div>

          {item.notes && (
            <button
              type="button"
              aria-expanded={expanded}
              aria-label={expanded ? 'Hide notes' : 'Show notes'}
              onClick={() => setExpanded((v) => !v)}
              className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-control border border-champagne bg-surface text-warmgray transition-colors hover:border-gold/60 hover:bg-gold-light/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold motion-reduce:transition-none"
            >
              {expanded ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
            </button>
          )}
        </div>
      </div>

      {expanded && item.notes && (
        <div className="border-t border-champagne/40 bg-ivory/40 px-4 py-3">
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-warmgray">Notes</p>
          <p className="text-[13px] text-espresso">{item.notes}</p>
        </div>
      )}
    </article>
  )
}

/* ══════════════════════════════════════════════════════════════════
   TODAY PAGE
   ══════════════════════════════════════════════════════════════════ */

export default function TodayPage() {
  const { userId } = useAuth()
  const confirm = useConfirm()
  const resultDialog = useResultDialog()
  const [searchParams, setSearchParams] = useSearchParams()
  const summary = useAsync(() => getDashboardSummary(), [], 'loadSummary', {
    key: 'dashboard-summary',
    persist: true,
  })
  const activity = useAsync(() => getTodayActivity(), [], 'loadSummary', { key: 'today-activity' })
  const pickups = useAsync(() => getPickupsDue(), [], 'loadOrders', { key: 'today-pickups' })
  const followUpFilter = searchParams.get('followupFilter') ?? 'all'
  const showAllFollowups = searchParams.get('followups') === 'all'
  const followUps = useAsync(
    () => listFollowups({ filter: followUpFilter, limit: showAllFollowups ? null : 5 }),
    [followUpFilter, showAllFollowups],
    'loadFollowups',
    { key: 'today-followups-items' },
  )
  const followUpCounts = useAsync(
    () => getFollowupCounts(),
    [],
    'loadFollowups',
    { key: 'today-followups-counts' },
  )
  const collections = useAsync(() => collectionsByMethod(), [], 'loadPayments', { key: 'today-collections' })
  const [addFollowupOpen, setAddFollowupOpen] = useState(false)
  const [savingFollowup, setSavingFollowup] = useState(false)
  const [followupBusyId, setFollowupBusyId] = useState(null)
  const [followupErrors, setFollowupErrors] = useState({})
  const [followupForm, setFollowupForm] = useState(() => ({
    patient_id: '',
    reason: 'review',
    due_date: toDateKey(),
    notes: '',
  }))
  const followupPatients = useAsync(
    () => listPatientRoster(),
    [addFollowupOpen],
    'loadPatients',
    { key: 'followup-patient-picker', enabled: addFollowupOpen },
  )

  /* ── Pagination state ─────────────────────────────────────────── */
  const [activityPage, setActivityPage] = useState(1)
  const [pickupsPage, setPickupsPage] = useState(1)

  const data = summary.data
  const net = data?.monthNet ?? 0
  const collectionRows = collections.data ?? []
  const collectedTotal = toAmount(collectionRows.reduce((sum, row) => sum + row.amount, 0))
  const maxCollectionAmount = Math.max(...collectionRows.map((r) => r.amount), 0)

  const currentMonth = CURRENT_MONTH
  const greeting = getGreeting()

  /* ── Paginated slices ─────────────────────────────────────────── */
  const allActivity = activity.data ?? []
  const activityTotalPages = Math.max(1, Math.ceil(allActivity.length / ACTIVITY_PAGE_SIZE))
  const paginatedActivity = allActivity.slice(
    (activityPage - 1) * ACTIVITY_PAGE_SIZE,
    activityPage * ACTIVITY_PAGE_SIZE,
  )

  const allPickups = pickups.data ?? []
  const pickupsTotalPages = Math.max(1, Math.ceil(allPickups.length / PICKUPS_PAGE_SIZE))
  const paginatedPickups = allPickups.slice(
    (pickupsPage - 1) * PICKUPS_PAGE_SIZE,
    pickupsPage * PICKUPS_PAGE_SIZE,
  )

  const setFollowUpFilter = (filter) => {
    const next = new URLSearchParams(searchParams)
    if (filter === 'all') next.delete('followupFilter')
    else next.set('followupFilter', filter)
    setSearchParams(next, { replace: true })
  }

  const refreshFollowups = () => {
    invalidateClinicQueries(userId, 'loadFollowups', 'loadSummary')
    followUps.reload()
    followUpCounts.reload()
    summary.reload()
  }

  const persistFollowupAction = async (item, action, days = 0) => {
    setFollowupBusyId(item.id)
    try {
      if (action === 'done') await markDone(item)
      else await snooze(item, days)
      refreshFollowups()
      resultDialog.success({
        title: action === 'done' ? 'Follow-up completed' : 'Follow-up snoozed',
        message: action === 'done'
          ? `${item.patient_name} was marked as completed.`
          : `${item.patient_name}'s follow-up was snoozed for ${days} day${days === 1 ? '' : 's'}.`,
      })
    } catch (caught) {
      resultDialog.error({
        title: action === 'done' ? 'Could not complete the follow-up' : 'Could not snooze the follow-up',
        message: caught instanceof AppError ? caught.message : 'Please check your connection and try again.',
        retryLabel: 'Try again',
        onRetry: () => persistFollowupAction(item, action, days),
      })
    } finally {
      setFollowupBusyId(null)
    }
  }

  const handleFollowupAction = async (item, action, days = 0) => {
    const isDone = action === 'done'
    const approved = await confirm({
      title: isDone ? 'Mark follow-up done?' : 'Snooze follow-up?',
      message: isDone
        ? `Mark ${item.patient_name}'s ${followupReasonLabel(item.reason).toLowerCase()} follow-up as done?`
        : `Snooze ${item.patient_name}'s follow-up for ${days} day${days === 1 ? '' : 's'}?`,
      confirmLabel: isDone ? 'Mark done' : 'Snooze follow-up',
      variant: isDone ? 'default' : 'default',
    })
    if (approved) await persistFollowupAction(item, action, days)
  }

  const persistNewFollowup = async () => {
    setSavingFollowup(true)
    try {
      const patient = followupPatients.data?.find((item) => item.id === followupForm.patient_id)
      await createFollowup(followupForm)
      setFollowupForm({ patient_id: '', reason: 'review', due_date: toDateKey(), notes: '' })
      setFollowupErrors({})
      setAddFollowupOpen(false)
      refreshFollowups()
      resultDialog.success({
        title: 'Follow-up added',
        message: `${patient?.full_name ?? 'The patient'} was added to the follow-up queue.`,
      })
    } catch (caught) {
      resultDialog.error({
        title: 'Could not add follow-up',
        message: caught instanceof AppError ? caught.message : 'Please check the details and try again.',
        retryLabel: 'Try again',
        onRetry: persistNewFollowup,
      })
    } finally {
      setSavingFollowup(false)
    }
  }

  const handleCreateFollowup = async (event) => {
    event.preventDefault()
    const errors = {}
    if (!followupForm.patient_id) errors.patient_id = 'Choose a patient.'
    if (!followupForm.due_date) errors.due_date = 'Choose a due date.'
    setFollowupErrors(errors)
    if (Object.keys(errors).length) return

    const patient = followupPatients.data?.find((item) => item.id === followupForm.patient_id)
    const approved = await confirm({
      title: 'Add this follow-up?',
      message: `Add a ${followupReasonLabel(followupForm.reason).toLowerCase()} follow-up for ${patient?.full_name ?? 'this patient'} due ${formatDateShort(followupForm.due_date)}?`,
      confirmLabel: 'Add follow-up',
    })
    if (approved) await persistNewFollowup()
  }

  const copyPhone = async (phone, patientName) => {
    if (!phone) return
    try {
      await navigator.clipboard.writeText(phone)
      resultDialog.success({ title: 'Phone number copied', message: `${patientName}'s number is ready to paste.`, autoCloseMs: 1800 })
    } catch {
      resultDialog.error({ title: 'Could not copy phone number', message: 'Copying is unavailable in this browser.' })
    }
  }

  return (
    <>
      {/* ── Page header ───────────────────────────────────────── */}
      <PageHeader
        title="Today"
        description={`${greeting}! Here's what is happening at Eye TroOps today.`}
        action={
          <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
            <div className="hidden items-center gap-2 rounded-lg bg-gold-light/50 px-3 py-1.5 sm:flex">
              <Clock className="size-4 text-gold-dark" strokeWidth={1.6} />
              <p className="tabular text-[13px] font-medium text-gold-dark">{TODAY_LABEL}</p>
            </div>
            <Button asChild size="sm">
              <Link to="/new-visit">
                <PlusCircle className="size-4" aria-hidden="true" />
                New Visit
              </Link>
            </Button>
          </div>
        }
      />

      <div className="flex flex-col gap-6">
      <div
        className="grid gap-4 today-animate"
        style={{
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          animationDelay: '0ms',
        }}
      >
        {summary.showSkeleton && !summary.data ? (
          Array.from({ length: 4 }, (_, index) => <TileSkeleton key={index} />)
        ) : (
          <>
            <StatTile
              contextLabel="TODAY"
              label="Collected Today"
              value={formatPeso(data?.collectedToday ?? 0)}
              icon={Wallet}
              tone="gold"
              description="Payments received today"
              to="/sales-expenses?range=today"
              onMouseEnter={() => prefetchRouteWithDebounce('/sales-expenses', userId, 100)}
              onMouseLeave={cancelRoutePrefetch}
              ariaLabel={`View collected today, ${formatPeso(data?.collectedToday ?? 0)}`}
            />
            <StatTile
              contextLabel={currentMonth}
              label="Sales This Month"
              value={formatPeso(data?.salesThisMonth ?? 0)}
              icon={TrendingUp}
              tone="success"
              description="Current month"
              to="/sales-expenses?range=month"
              onMouseEnter={() => prefetchRouteWithDebounce('/sales-expenses', userId, 100)}
              onMouseLeave={cancelRoutePrefetch}
              ariaLabel={`View sales this month, ${formatPeso(data?.salesThisMonth ?? 0)}`}
            />
            <StatTile
              contextLabel={currentMonth}
              label="Expenses This Month"
              value={formatPeso(data?.expensesThisMonth ?? 0)}
              icon={TrendingDown}
              description="Current month"
              to="/sales-expenses?range=month&tab=expenses"
              onMouseEnter={() => prefetchRouteWithDebounce('/sales-expenses', userId, 100)}
              onMouseLeave={cancelRoutePrefetch}
              ariaLabel={`View expenses this month, ${formatPeso(data?.expensesThisMonth ?? 0)}`}
            />
            <StatTile
              contextLabel={currentMonth}
              label="Month-End Net"
              value={formatPeso(net)}
              icon={Banknote}
              tone={net >= 0 ? 'success' : 'error'}
              description="Sales minus expenses"
              to="/sales-expenses?range=month&tab=summary"
              onMouseEnter={() => prefetchRouteWithDebounce('/sales-expenses', userId, 100)}
              onMouseLeave={cancelRoutePrefetch}
              ariaLabel={`View month-end net, ${formatPeso(net)}`}
            />
          </>
        )}
      </div>

      <div
        className="grid gap-4 today-animate"
        style={{
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          animationDelay: '60ms',
        }}
      >
        {summary.showSkeleton && !summary.data ? (
          <>
            <TileSkeleton />
            <TileSkeleton />
          </>
        ) : (
          <>
            <StatTile
              contextLabel="OUTSTANDING"
              label="Unpaid Balances"
              value={formatPeso(data?.unpaidBalances ?? 0)}
              icon={PiggyBank}
              tone="warning"
              description="Outstanding"
              to="/orders?payment=OUTSTANDING"
              onMouseEnter={() => prefetchRouteWithDebounce('/orders', userId, 100)}
              onMouseLeave={cancelRoutePrefetch}
              ariaLabel={`View unpaid balances, ${formatPeso(data?.unpaidBalances ?? 0)}`}
            />
            <StatTile
              contextLabel="OPERATIONS"
              label="Pickups Due"
              value={String(data?.pickupsDue ?? 0)}
              icon={PackageCheck}
              tone={data?.pickupsDue && data.pickupsDue > 0 ? 'warning' : 'neutral'}
              description={
                data?.pickupsDue && data.pickupsDue > 0 ? 'Ready for pickup' : 'No pickups due'
              }
              to="/orders?status=READY_FOR_PICKUP"
              onMouseEnter={() => prefetchRouteWithDebounce('/orders', userId, 100)}
              onMouseLeave={cancelRoutePrefetch}
              ariaLabel={`View pickups due, ${data?.pickupsDue ?? 0}`}
            />
            <StatTile
              contextLabel="FOLLOW-UP"
              label="Follow-ups Due"
              value={followUpCounts.error ? '–' : String(followUpCounts.data?.all ?? data?.followUpsDue ?? 0)}
              icon={CalendarCheck}
              tone={!followUpCounts.error && (followUpCounts.data?.all ?? data?.followUpsDue ?? 0) > 0 ? 'success' : 'neutral'}
              description={
                followUpCounts.error
                  ? 'Could not load'
                  : (followUpCounts.data?.all ?? data?.followUpsDue ?? 0) > 0
                    ? 'Review appointments waiting'
                    : 'No active follow-ups'
              }
              to="/today#follow-up-queue"
              ariaLabel={`View follow-up queue, ${followUpCounts.error ? 'unavailable' : followUpCounts.data?.all ?? data?.followUpsDue ?? 0}`}
            />
          </>
        )}
      </div>

      <div className="grid items-start gap-6 xl:grid-cols-[1.6fr_1fr]">

        {/* ────────────────────────────────────────────────────
            TODAY'S ACTIVITY — paginated table
            ──────────────────────────────────────────────────── */}
        <section className="min-w-0 today-animate" style={{ animationDelay: '120ms' }}>
          <SectionTitle
            description="Recent patient and order activity."
          >
            <span className="inline-flex items-center gap-2.5">
              Today's Activity
              {!activity.loading && (
                <span className="inline-flex items-center gap-1.5 rounded-md bg-gold-light/70 px-2 py-0.5 text-[11px] font-semibold text-gold-dark">
                  <Activity className="size-3" strokeWidth={2.2} />
                  {allActivity.length} {allActivity.length === 1 ? 'entry' : 'entries'}
                </span>
              )}
            </span>
          </SectionTitle>

          <Card className="overflow-hidden">
            {activity.showSkeleton && !activity.data ? (
              <div className="space-y-3.5 p-5">
                {Array.from({ length: 5 }, (_, index) => (
                  <Skeleton key={index} className="h-4 w-full" />
                ))}
              </div>
            ) : allActivity.length > 0 ? (
              <>
                <Table>
                  <THead>
                    <tr>
                      <TH>Patient</TH>
                      <TH>Transaction</TH>
                      <TH className="text-right">Amount</TH>
                      <TH>Status</TH>
                      <TH className="w-20 text-right">Time</TH>
                    </tr>
                  </THead>
                  <TBody>
                    {paginatedActivity.map((row, idx) => {
                      const rowDestination = row.order_id
                        ? `/orders?order=${encodeURIComponent(row.order_id)}`
                        : row.patient_id
                          ? `/patients?patient=${encodeURIComponent(row.patient_id)}`
                          : null
                      return (
                      <TR key={row.id} className={cn(rowDestination && 'relative group cursor-pointer transition-colors hover:bg-gold-light/30', idx % 2 === 0 ? 'bg-surface' : 'bg-ivory/40')}>
                        <TD>
                          <div className="flex items-center gap-2.5">
                            <Avatar name={row.patient} className="size-7 text-[10px]" />
                            {row.patient_id ? (
                              <Link to={`/patients?patient=${encodeURIComponent(row.patient_id)}`} className="relative z-10 truncate font-medium text-espresso underline-offset-2 hover:text-gold-dark hover:underline focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-gold">
                                {row.patient}
                              </Link>
                            ) : <span className="font-medium">{row.patient}</span>}
                          </div>
                        </TD>
                        <TD className="text-[13px] text-warmgray">
                          {rowDestination ? (
                            <Link
                              to={rowDestination}
                              aria-label={`View ${row.transaction} for ${row.patient}`}
                              className="after:absolute after:inset-0 after:z-0 after:content-[''] focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-inset focus-visible:after:ring-gold group-hover:text-gold-dark"
                            >
                              {row.transaction}
                            </Link>
                          ) : row.transaction}
                          {rowDestination && <ArrowUpRight className="pointer-events-none absolute right-3 top-1/2 z-0 size-4 -translate-y-1/2 text-gold-dark opacity-0 transition-opacity group-hover:opacity-100 motion-reduce:transition-none" aria-hidden="true" />}
                        </TD>
                        <TD className="tabular text-right text-[13px] font-medium">
                          {formatPeso(row.amount)}
                        </TD>
                        <TD>
                          <StatusBadge status={row.status} />
                        </TD>
                        <TD className="tabular text-right text-[13px] text-warmgray">
                          {formatTime(row.at)}
                        </TD>
                      </TR>
                      )
                    })}
                  </TBody>
                </Table>

                <Pagination
                  currentPage={activityPage}
                  totalPages={activityTotalPages}
                  onPageChange={setActivityPage}
                />
              </>
            ) : (
              <EmptyState
                icon={CalendarCheck}
                title="No activity yet today"
                description="New visits, payments and status changes will appear here as the day goes on."
              />
            )}
          </Card>
        </section>

        {/* ────────────────────────────────────────────────────
            PICKUPS DUE — paginated card list
            ──────────────────────────────────────────────────── */}
        <section className="min-w-0 today-animate" style={{ animationDelay: '180ms' }}>
          <SectionTitle description="Orders finished and waiting for the patient.">
            Pickups Due
          </SectionTitle>

          <Card className="overflow-hidden">
            {pickups.showSkeleton && !pickups.data ? (
              <div className="space-y-3.5 p-5">
                {Array.from({ length: 3 }, (_, index) => (
                  <Skeleton key={index} className="h-4 w-full" />
                ))}
              </div>
            ) : allPickups.length > 0 ? (
              <>
                <div className="divide-y divide-champagne/50">
                  {paginatedPickups.map((row) => {
                    const waiting = daysSince(row.ready_date)
                    const overdue = waiting >= OVERDUE_AFTER_DAYS
                    return (
                      <PickupCard
                        orderId={row.id}
                        patientId={row.patient_id}
                        key={row.id}
                        patient={row.patient}
                        orderNumber={row.order_number}
                        readyDate={row.ready_date}
                        balance={row.balance}
                        status={row.status}
                        overdue={overdue}
                        waitingDays={waiting}
                      />
                    )
                  })}
                </div>

                <Pagination
                  currentPage={pickupsPage}
                  totalPages={pickupsTotalPages}
                  onPageChange={setPickupsPage}
                />
              </>
            ) : (
              <EmptyState
                icon={Receipt}
                title="Nothing waiting"
                description="Orders marked ready for pickup will be listed here."
              />
            )}
          </Card>
        </section>

        <section id="follow-up-queue" className="min-w-0 scroll-mt-20 today-animate xl:col-span-2" style={{ animationDelay: '210ms' }}>
          <SectionTitle
            description="Patients due for review, check-up, or pickup."
            action={(
              <Button type="button" size="sm" onClick={() => setAddFollowupOpen((open) => !open)}>
                <Plus className="size-4" aria-hidden="true" />
                {addFollowupOpen ? 'Close form' : 'Add follow-up'}
              </Button>
            )}
          >
            Follow-up Queue
          </SectionTitle>

          <Card className="overflow-hidden">
            <div className="flex flex-nowrap gap-2 overflow-x-auto border-b border-champagne px-4 py-3 scrollbar-none [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden" role="group" aria-label="Follow-up filters">
              {FOLLOWUP_FILTERS.map((filter) => (
                <button
                  key={filter.value}
                  type="button"
                  aria-pressed={followUpFilter === filter.value}
                  onClick={() => setFollowUpFilter(filter.value)}
                  className={cn(
                    'inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-control border px-3 text-[12px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:ring-offset-surface motion-reduce:transition-none',
                    followUpFilter === filter.value
                      ? 'border-gold bg-gold-light text-gold-dark'
                      : 'border-champagne bg-surface text-warmgray hover:border-gold/60 hover:text-espresso',
                  )}
                >
                  {filter.label}
                  <span className="tabular" aria-live="polite">
                    ({followUps.loading ? '…' : followUpCounts.data?.[filter.countKey] ?? '–'})
                  </span>
                </button>
              ))}
            </div>

            {addFollowupOpen && (
              <form onSubmit={handleCreateFollowup} className="space-y-3 border-b border-champagne bg-ivory/40 p-4" noValidate>
                <div className="grid min-w-0 gap-3 sm:grid-cols-[minmax(0,1.2fr)_minmax(0,.8fr)_minmax(0,.9fr)]">
                  <Select
                    id="followup-patient"
                    label="Patient"
                    required
                    value={followupForm.patient_id}
                    onChange={(event) => setFollowupForm((form) => ({ ...form, patient_id: event.target.value }))}
                    error={followupErrors.patient_id}
                    disabled={followupPatients.loading || Boolean(followupPatients.error) || savingFollowup}
                    options={[
                      { value: '', label: followupPatients.loading ? 'Loading patients…' : 'Choose a patient' },
                      ...(followupPatients.data ?? []).map((patient) => ({
                        value: patient.id,
                        label: `${patient.full_name}${patient.cp_number ? ` · ${patient.cp_number}` : ''}`,
                      })),
                    ]}
                  />
                  <Select
                    id="followup-reason"
                    label="Reason"
                    value={followupForm.reason}
                    onChange={(event) => setFollowupForm((form) => ({ ...form, reason: event.target.value }))}
                    disabled={savingFollowup}
                    options={FOLLOWUP_REASONS}
                  />
                  <DatePicker
                    id="followup-due-date"
                    label="Due date"
                    required
                    minDate={toDateKey()}
                    value={followupForm.due_date}
                    onChange={(date) => setFollowupForm((form) => ({ ...form, due_date: date }))}
                    error={followupErrors.due_date}
                    disabled={savingFollowup}
                  />
                </div>
                <Textarea
                  id="followup-notes"
                  label="Notes"
                  rows={2}
                  value={followupForm.notes}
                  onChange={(event) => setFollowupForm((form) => ({ ...form, notes: event.target.value }))}
                  disabled={savingFollowup}
                />
                {followupPatients.error && (
                  <div className="flex flex-wrap items-center gap-2">
                    <ErrorNote message={followupPatients.error} className="flex-1" />
                    <Button type="button" variant="outline" size="sm" onClick={followupPatients.reload}>Try again</Button>
                  </div>
                )}
                <div className="flex justify-end">
                  <Button type="submit" loading={savingFollowup} loadingText="Adding" disabled={followupPatients.loading || Boolean(followupPatients.error)}>
                    <Plus className="size-4" aria-hidden="true" /> Add follow-up
                  </Button>
                </div>
              </form>
            )}

            {followUps.error ? (
              <div className="flex flex-wrap items-center gap-3 p-4">
                <ErrorNote message={followUps.error} className="flex-1" />
                <Button type="button" variant="outline" size="sm" onClick={followUps.reload}>
                  Try again
                </Button>
              </div>
            ) : followUps.showSkeleton && !followUps.data ? (
              <div className="space-y-3 p-4" aria-busy="true">
                {Array.from({ length: 5 }, (_, index) => <Skeleton key={index} className="h-20 w-full motion-reduce:animate-none" />)}
              </div>
            ) : followUps.data?.length ? (
              <>
                <div className="divide-y divide-champagne/60" aria-live="polite" aria-label="Follow-up queue">
                  {followUps.data.map((item) => (
                    <FollowupRow
                      key={`${item.is_auto ? 'auto' : 'manual'}-${item.id}`}
                      item={item}
                      busy={followupBusyId === item.id}
                      onAction={handleFollowupAction}
                      onCopyPhone={copyPhone}
                    />
                  ))}
                </div>
                {!showAllFollowups && (followUpCounts.data?.all ?? 0) > (followUps.data?.length ?? 0) && (
                  <div className="border-t border-champagne px-4 py-3">
                    <Link to="/today?followups=all#follow-up-queue" className="inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-gold-dark underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-gold">
                      View all {followUpCounts.data?.all} follow-ups <ArrowUpRight className="size-4" aria-hidden="true" />
                    </Link>
                  </div>
                )}
                {showAllFollowups && (
                  <div className="border-t border-champagne px-4 py-3">
                    <Link to={`/today${followUpFilter === 'all' ? '' : `?followupFilter=${followUpFilter}`}#follow-up-queue`} className="inline-flex min-h-11 items-center text-sm font-semibold text-gold-dark underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-gold">
                      Show five
                    </Link>
                  </div>
                )}
              </>
            ) : (
              <EmptyState
                icon={CalendarCheck}
                title="No follow-ups queued"
                description="Patients who need a review, check-up, or pickup call will appear here."
                action={(
                  <div className="flex flex-wrap justify-center gap-2">
                    <Button type="button" onClick={() => setAddFollowupOpen(true)}>
                      <CalendarPlus className="size-4" aria-hidden="true" /> Schedule a follow-up
                    </Button>
                    <Button asChild type="button" variant="outline">
                      <Link to="/patients">View all patients</Link>
                    </Button>
                  </div>
                )}
              />
            )}
          </Card>
        </section>
      </div>

      <section className="today-animate" style={{ animationDelay: '240ms' }}>
        <SectionTitle description="Reconcile the drawer against the ledger at closing time.">
          Collected today by method
        </SectionTitle>

        <Card className="overflow-hidden">
          {collections.showSkeleton && !collections.data ? (
            <div className="space-y-3.5 p-5">
              {Array.from({ length: 3 }, (_, index) => (
                <Skeleton key={index} className="h-4 w-full" />
              ))}
            </div>
          ) : collectionRows.length > 0 ? (
            <Link
              to="/sales-expenses?range=today"
              aria-label={`View today's collections by method, total ${formatPeso(collectedTotal)}`}
              className="group block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-gold"
            >
              <div className="grid divide-y divide-champagne/50 lg:grid-cols-[1fr_auto] lg:divide-y-0 lg:divide-x lg:divide-champagne/50">
                {/* Bar chart list */}
                <div className="divide-y divide-champagne/30 py-1">
                  {collectionRows.map((row) => (
                    <CollectionBar
                      key={row.method}
                      method={row.method}
                      amount={row.amount}
                      maxAmount={maxCollectionAmount}
                    />
                  ))}
                </div>

                {/* Total summary panel */}
                <div className="relative flex flex-col items-center justify-center gap-1 bg-linear-to-br from-gold-light/60 to-gold/10 px-10 py-8 lg:min-w-50">
                  <span className="text-[10px] font-semibold tracking-[0.15em] text-gold-dark uppercase">
                    Total Collected
                  </span>
                  <span className="tabular font-display text-3xl font-bold text-gold-dark">
                    {formatPeso(collectedTotal)}
                  </span>
                  <span className="mt-1 text-[11px] text-warmgray">across all methods</span>
                  <ArrowUpRight
                    className="absolute right-3 top-3 size-4 text-gold-dark opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100 motion-reduce:transition-none"
                    aria-hidden="true"
                  />
                </div>
              </div>
            </Link>
          ) : (
            <EmptyState
              icon={Banknote}
              title="No payments received yet"
              description="Payments recorded today are grouped here by method."
            />
          )}
        </Card>
      </section>
      </div>
    </>
  )
}
