import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import {
  CalendarDays,
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
import { ChoiceGroup } from '@/components/ui/choice-group'
import { Pagination } from '@/components/ui/pagination'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { EmptyState, ErrorNote, Skeleton, SkeletonRows } from '@/components/ui/feedback'
import { ExpenseDialog } from '@/components/expenses/expense-dialog'
import { useAsync } from '@/hooks/use-async'
import { getMonthlySeries } from '@/services/dashboard.service'
import { deleteExpense, listExpenses, totalExpenses } from '@/services/expenses.service'
import { listPayments } from '@/services/payments.service'
import { paymentMethodOf, paymentNoteOf, TABLE_PAGE_SIZE } from '@/lib/constants'
import { toAmount, toDateKey, yearBounds } from '@/utils/dates'
import { formatPeso, formatPesoShort, formatDateShort } from '@/utils/format'
import { AppError } from '@/utils/errors'
import { cn } from '@/lib/utils'

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

export default function SalesExpensesPage() {
  const [today] = useState(() => new Date())
  const [year, setYear] = useState(() => today.getFullYear())
  const [expenseOpen, setExpenseOpen] = useState(false)
  const [editingExpense, setEditingExpense] = useState(null)
  const [deletingExpense, setDeletingExpense] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [paymentPage, setPaymentPage] = useState(1)
  const [expensePage, setExpensePage] = useState(1)

  const bounds = yearBounds(year)

  const yearOptions = useMemo(
    () =>
      Array.from({ length: 4 }, (_, index) => {
        const value = today.getFullYear() - index
        return { value: String(value), label: String(value) }
      }),
    [today],
  )

  const series = useAsync(() => getMonthlySeries(year), [year], 'loadSummary')
  const payments = useAsync(
    () => listPayments(bounds.from, bounds.to),
    [bounds.from, bounds.to],
    'loadPayments',
  )
  const expenses = useAsync(
    () => listExpenses(bounds.from, bounds.to),
    [bounds.from, bounds.to],
    'loadExpenses',
  )

  const paymentRows = useMemo(() => {
    const rows = payments.data ?? []
    return [...rows].sort((a, b) => Date.parse(b.payment_date) - Date.parse(a.payment_date))
  }, [payments.data])

  const expenseRows = useMemo(() => {
    const rows = expenses.data ?? []
    return [...rows].sort((a, b) => Date.parse(b.expense_date) - Date.parse(a.expense_date))
  }, [expenses.data])

  const isCurrentYear = year === today.getFullYear()
  const currentMonthIndex = today.getMonth()

  /** KPI totals come straight from ledger rows so they match the tables below. */
  const yearSales = useMemo(
    () => toAmount(paymentRows.reduce((sum, row) => sum + Number(row.amount), 0)),
    [paymentRows],
  )
  const yearExpensesTotal = useMemo(
    () => (expenses.data ? totalExpenses(expenses.data) : 0),
    [expenses.data],
  )
  const monthlyTotals = useMemo(() => {
    const rows = series.data ?? []
    const sales = toAmount(rows.reduce((sum, row) => sum + Number(row.sales), 0))
    const expenses = toAmount(rows.reduce((sum, row) => sum + Number(row.expenses), 0))

    return { sales, expenses, net: toAmount(sales - expenses) }
  }, [series.data])
  const net = toAmount(yearSales - yearExpensesTotal)
  const expenseCount = expenseRows.length
  const paymentCount = paymentRows.length

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

  const kpiLoading = payments.loading || expenses.loading

  useEffect(() => {
    setPaymentPage(1)
    setExpensePage(1)
  }, [year])

  const reloadAll = () => {
    expenses.reload()
    payments.reload()
    series.reload()
  }

  const handleDelete = async () => {
    if (!deletingExpense) return
    setDeleting(true)
    try {
      await deleteExpense(deletingExpense.id)
      toast.success('Expense deleted')
      setDeletingExpense(null)
      reloadAll()
    } catch (caught) {
      toast.error('Could not delete the expense', {
        description: caught instanceof AppError ? caught.message : 'Please try again.',
      })
    } finally {
      setDeleting(false)
    }
  }

  return (
    <>
      <PageHeader
        title="Sales & Expenses"
        description="Cash in from payments versus cash out for running the clinic."
        action={
          <Button size="sm" onClick={() => setExpenseOpen(true)}>
            <Plus className="size-4" aria-hidden="true" />
            Add expense
          </Button>
        }
      />

      <div className="flex flex-col gap-6">
        <Card className="overflow-hidden today-animate" style={{ animationDelay: '0ms' }}>
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-champagne px-5 py-3">
            <ChoiceGroup
              id="year"
              label="Year"
              labelPosition="inline"
              size="compact"
              layout="wrap"
              value={String(year)}
              options={yearOptions}
              onChange={(value) => setYear(Number(value))}
            />
            <p className="text-[12px] text-warmgray">
              {paymentCount} payments · {expenseCount} expenses in {year}
            </p>
          </div>

          <div className="grid gap-3 p-4 sm:grid-cols-3">
            {kpiLoading ? (
              Array.from({ length: 3 }, (_, index) => <MiniStatSkeleton key={index} />)
            ) : (
              <>
                <MiniStat
                  icon={TrendingUp}
                  label={`Sales · ${paymentCount} payments`}
                  value={formatPesoShort(yearSales)}
                  tone="success"
                />
                <MiniStat
                  icon={TrendingDown}
                  label={`Expenses · ${expenseCount} entries`}
                  value={formatPesoShort(yearExpensesTotal)}
                  tone="neutral"
                />
                <MiniStat
                  icon={Wallet}
                  label="Net (sales − expenses)"
                  value={formatPesoShort(net)}
                  tone={net >= 0 ? 'success' : 'error'}
                />
              </>
            )}
          </div>
        </Card>

        <section className="min-w-0 today-animate" style={{ animationDelay: '60ms' }}>
          <SectionTitle description="Month-by-month sales, expenses, and net for the selected year.">
            <span className="inline-flex items-center gap-2">
              Monthly breakdown
              <span className="inline-flex items-center gap-1 rounded-md bg-gold-light/70 px-2 py-0.5 text-[11px] font-semibold text-gold-dark">
                <CalendarDays className="size-3.5" strokeWidth={2} aria-hidden="true" />
                {year}
              </span>
            </span>
          </SectionTitle>

          <Card className="monthly-breakdown-card overflow-hidden">
          {series.error ? (
            <div className="p-5">
              <ErrorNote message={series.error} />
            </div>
          ) : series.loading ? (
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
                {series.data?.map((row, idx) => {
                  const isCurrentMonth = isCurrentYear && row.month === currentMonthIndex
                  return (
                  <TR
                    key={row.month}
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
              <tfoot>
                <tr className="year-total-row sticky bottom-0 z-10">
                  <TD className="border-t-2 border-[#C98A1B] bg-[#FBEBD3] py-4 text-sm font-bold text-espresso">
                    Total {year}
                  </TD>
                  <TD className="tabular border-t-2 border-[#C98A1B] bg-[#FBEBD3] py-4 text-right text-[15px] font-bold text-espresso">
                    {formatPeso(monthlyTotals.sales)}
                  </TD>
                  <TD className="tabular border-t-2 border-[#C98A1B] bg-[#FBEBD3] py-4 text-right text-[15px] font-bold text-espresso">
                    {formatPeso(monthlyTotals.expenses)}
                  </TD>
                  <TD className="tabular border-t-2 border-[#C98A1B] bg-[#FBEBD3] py-4 text-right text-[15px] font-bold">
                    <span className={monthlyTotals.net < 0 ? 'text-error' : 'text-success'}>
                      {formatPeso(monthlyTotals.net)}
                    </span>
                  </TD>
                </tr>
              </tfoot>
            </Table>
          )}
        </Card>
        </section>

        <div className="grid items-start gap-6 lg:grid-cols-2">
        <section className="min-w-0 today-animate" style={{ animationDelay: '100ms' }}>
          <SectionTitle description="Every payment received in the selected year.">
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

          <Card className="overflow-hidden">
            {payments.error ? (
              <div className="p-5">
                <ErrorNote message={payments.error} />
              </div>
            ) : payments.loading ? (
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
                title="No payments in this year"
                description="Payments recorded against orders will show here for the selected year."
              />
            )}
          </Card>
        </section>

        <section className="min-w-0 today-animate" style={{ animationDelay: '140ms' }}>
          <SectionTitle description="Clinic costs recorded in the selected year.">
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

          <Card className="overflow-hidden">
            {expenses.error ? (
              <div className="p-5">
                <ErrorNote message={expenses.error} />
              </div>
            ) : expenses.loading ? (
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
                title="No expenses in this year"
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
      />
    </>
  )
}
