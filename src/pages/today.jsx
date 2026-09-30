import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Banknote,
  CalendarCheck,
  ChevronLeft,
  ChevronRight,
  Clock,
  PackageCheck,
  Phone,
  PiggyBank,
  PlusCircle,
  Receipt,
  TrendingDown,
  TrendingUp,
  Wallet,
  Activity,
  CreditCard,
} from 'lucide-react'
import { PageHeader, SectionTitle, StatTile, Avatar } from '@/components/layout/page-header'
import { Card, Table, TBody, TD, TH, THead, TR } from '@/components/ui/card'
import { Badge, StatusBadge } from '@/components/ui/badge'
import { EmptyState, Skeleton } from '@/components/ui/feedback'
import { Button } from '@/components/ui/button'
import { useAsync } from '@/hooks/use-async'
import { getDashboardSummary, getPickupsDue, getTodayActivity } from '@/services/dashboard.service'
import { collectionsByMethod } from '@/services/payments.service'
import { toAmount } from '@/utils/dates'
import { formatDateShort, formatLongDate, formatPeso, formatTime } from '@/utils/format'

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
          onClick={() => onPageChange(currentPage - 1)}
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
              onClick={() => onPageChange(page)}
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
          onClick={() => onPageChange(currentPage + 1)}
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
    <div className="rounded-[var(--radius-card)] border border-champagne bg-surface p-5 shadow-card min-h-[160px] animate-pulse">
      <Skeleton className="h-3 w-24" />
      <Skeleton className="mt-3.5 h-7 w-32" />
    </div>
  )
}

/* ── pickup card (replaces cramped table row) ──────────────────── */

function PickupCard({ patient, orderNumber, readyDate, balance, status, overdue, waitingDays }) {
  return (
    <div className="flex items-start gap-3.5 rounded-xl px-4 py-4 transition-colors hover:bg-gold-light/30">
      <Avatar name={patient} className="size-9 text-[11px] mt-0.5" />
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[13.5px] font-semibold text-espresso truncate">{patient}</p>
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
    </div>
  )
}

/* ── collection bar for the "by method" section ────────────────── */

function CollectionBar({ method, amount, maxAmount }) {
  const pct = maxAmount > 0 ? (amount / maxAmount) * 100 : 0
  return (
    <div className="group flex items-center gap-4 rounded-lg px-4 py-3.5 transition-colors hover:bg-gold-light/40">
      <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-gold-light to-gold/15 text-gold-dark">
        <CreditCard className="size-4" strokeWidth={1.7} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="mb-1.5 flex items-baseline justify-between gap-3">
          <span className="text-[13px] font-semibold text-espresso">{method}</span>
          <span className="tabular text-[13px] font-bold text-gold-dark">{formatPeso(amount)}</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-champagne/50">
          <div
            className="h-full rounded-full bg-gradient-to-r from-gold to-gold-dark transition-all duration-700 ease-out"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════════
   TODAY PAGE
   ══════════════════════════════════════════════════════════════════ */

export default function TodayPage() {
  const summary = useAsync(() => getDashboardSummary(), [], 'loadSummary')
  const activity = useAsync(() => getTodayActivity(), [], 'loadSummary')
  const pickups = useAsync(() => getPickupsDue(), [], 'loadOrders')
  const collections = useAsync(() => collectionsByMethod(), [], 'loadPayments')

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
        {summary.loading ? (
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
            />
            <StatTile
              contextLabel={currentMonth}
              label="Sales This Month"
              value={formatPeso(data?.salesThisMonth ?? 0)}
              icon={TrendingUp}
              tone="success"
              description="Current month"
            />
            <StatTile
              contextLabel={currentMonth}
              label="Expenses This Month"
              value={formatPeso(data?.expensesThisMonth ?? 0)}
              icon={TrendingDown}
              description="Current month"
            />
            <StatTile
              contextLabel={currentMonth}
              label="Month-End Net"
              value={formatPeso(net)}
              icon={Banknote}
              tone={net >= 0 ? 'success' : 'error'}
              description="Sales minus expenses"
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
        {summary.loading ? (
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
            {activity.loading ? (
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
                    {paginatedActivity.map((row, idx) => (
                      <TR key={row.id} className={idx % 2 === 0 ? 'bg-surface' : 'bg-ivory/40'}>
                        <TD>
                          <div className="flex items-center gap-2.5">
                            <Avatar name={row.patient} className="size-7 text-[10px]" />
                            <span className="font-medium">{row.patient}</span>
                          </div>
                        </TD>
                        <TD className="text-[13px] text-warmgray">{row.transaction}</TD>
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
                    ))}
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
            {pickups.loading ? (
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
      </div>

      <section className="today-animate" style={{ animationDelay: '240ms' }}>
        <SectionTitle description="Reconcile the drawer against the ledger at closing time.">
          Collected today by method
        </SectionTitle>

        <Card className="overflow-hidden">
          {collections.loading ? (
            <div className="space-y-3.5 p-5">
              {Array.from({ length: 3 }, (_, index) => (
                <Skeleton key={index} className="h-4 w-full" />
              ))}
            </div>
          ) : collectionRows.length > 0 ? (
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
              <div className="flex flex-col items-center justify-center gap-1 bg-gradient-to-br from-gold-light/60 to-gold/10 px-10 py-8 lg:min-w-[200px]">
                <span className="text-[10px] font-semibold tracking-[0.15em] text-gold-dark uppercase">
                  Total Collected
                </span>
                <span className="tabular font-display text-3xl font-bold text-gold-dark">
                  {formatPeso(collectedTotal)}
                </span>
                <span className="mt-1 text-[11px] text-warmgray">across all methods</span>
              </div>
            </div>
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
