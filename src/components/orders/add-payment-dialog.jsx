import { useState, useMemo, useRef } from 'react'
import { Banknote } from 'lucide-react'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input, Select, Textarea } from '@/components/ui/input'
import { ErrorNote } from '@/components/ui/feedback'
import { useConfirm } from '@/hooks/use-confirm'
import { useResultDialog } from '@/hooks/use-result-dialog'
import { useSupabaseHealth } from '@/hooks/use-supabase-health'
import { createPayment } from '@/services/payments.service'
import { toDateKey } from '@/utils/dates'
import { formatPeso } from '@/utils/format'
import { PAYMENT_METHODS } from '@/lib/constants'

const blankForm = () => ({
  amount: '',
  payment_date: toDateKey(),
  method: 'Cash',
  notes: '',
})

function formEquals(a, b) {
  return (
    a.amount === b.amount &&
    a.payment_date === b.payment_date &&
    a.method === b.method &&
    a.notes === b.notes
  )
}

/**
 * Records one payment against an order. Payments are never edited or deleted —
 * a correction is a new entry — so this modal only ever inserts.
 */
export function AddPaymentDialog({ order, onClose, onSaved }) {
  const confirm = useConfirm()
  const resultDialog = useResultDialog()
  const { isOnline } = useSupabaseHealth()
  const [initialForm] = useState(blankForm)
  const [form, setForm] = useState(blankForm)
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const paymentIdempotencyKey = useRef(null)
  paymentIdempotencyKey.current ??= crypto.randomUUID()

  const hasUnsavedChanges = useMemo(
    () => !formEquals(form, initialForm),
    [form, initialForm]
  )

  const recordPayment = async () => {
    const amount = Number(form.amount)
    setSaving(true)
    try {
      await createPayment({
        order_id: order.id,
        amount,
        payment_date: form.payment_date,
        notes: [form.method, form.notes].filter(Boolean).join(' · '),
        idempotency_key: paymentIdempotencyKey.current,
      })
      resultDialog.success({
        title: 'Payment recorded',
        message: `${formatPeso(amount)} was recorded for ${order.order_number}.`,
      })
      onSaved()
      onClose()
    } catch (caught) {
      resultDialog.error({
        title: 'Could not save the payment',
        message: caught?.message ?? 'Please check your connection and try again.',
        details: caught?.cause?.message,
        retryLabel: 'Try again',
        onRetry: recordPayment,
      })
    } finally {
      setSaving(false)
    }
  }

  const handleClose = () => {
    if (saving) return
    if (hasUnsavedChanges) {
      void confirm({
        title: 'Discard unsaved payment?',
        message: `Leave ${order.order_number} without recording this payment?`,
        confirmLabel: 'Discard payment',
        cancelLabel: 'Keep editing',
        variant: 'default',
        onConfirm: onClose,
        errorMessage: 'Could not close the payment form. Please try again.',
      })
      return
    }
    onClose()
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (!isOnline) return
    if (!order) return

    const amount = Number(form.amount)
    const nextErrors = {}
    if (!form.amount.trim() || Number.isNaN(amount)) {
      nextErrors.amount = 'Enter the amount received.'
    } else if (amount <= 0) {
      nextErrors.amount = 'Amount must be greater than zero.'
    } else if (amount > order.balance) {
      nextErrors.amount = `Amount exceeds the remaining balance of ${formatPeso(order.balance)}.`
    }
    if (!form.payment_date) nextErrors.payment_date = 'Payment date is required.'

    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return

    void confirm({
      title: 'Record payment?',
      message: `Record ${formatPeso(amount)} for ${order.order_number}? This updates the outstanding balance.`,
      confirmLabel: 'Record payment',
      variant: 'default',
      onConfirm: recordPayment,
      errorMessage: 'Could not save the payment. Please try again.',
    })
  }

  if (!order) return null

  const entered = Number(form.amount) || 0
  const settled = order.balance > 0 && entered > 0 && entered <= order.balance
  const balanceAfter = Math.max(order.balance - entered, 0)

  return (
    <Dialog
      open
      onOpenChange={handleClose}
    >
      <DialogContent
        title="Record Payment"
        description={`Record a payment for ${order.order_number} and update the outstanding balance.`}
        size="md"
        footer={
          <>
            <Button type="button" variant="outline" onClick={handleClose} disabled={saving}>
              Cancel
            </Button>
            <Button
              type="submit"
              form="add-payment-form"
              loading={saving}
              loadingText="Recording"
              disabled={!isOnline}
            >
              <Banknote className="size-4" aria-hidden="true" />
              Record Payment
            </Button>
          </>
        }
      >
        <form id="add-payment-form" onSubmit={handleSubmit} className="space-y-4" noValidate>
          {errors._general && <ErrorNote message={errors._general} />}

          {/* Order summary header */}
          <dl className="space-y-2.5 rounded-control border border-champagne bg-ivory px-4 py-3.5">
            <div className="flex items-baseline justify-between gap-4">
              <dt className="text-[13px] text-warmgray">Order #</dt>
              <dd className="tabular text-[13px] font-medium text-espresso">{order.order_number}</dd>
            </div>
            <div className="flex items-baseline justify-between gap-4">
              <dt className="text-[13px] text-warmgray">Patient</dt>
              <dd className="tabular text-[13px] text-espresso">{order.patient_name}</dd>
            </div>
            <div className="flex items-baseline justify-between gap-4">
              <dt className="text-[13px] text-warmgray">Order total</dt>
              <dd className="tabular text-[13px] text-espresso">{formatPeso(order.total_amount)}</dd>
            </div>
            <div className="flex items-baseline justify-between gap-4">
              <dt className="text-[13px] text-warmgray">Previously paid</dt>
              <dd className="tabular text-[13px] text-espresso">{formatPeso(order.paid)}</dd>
            </div>
            <div className="flex items-baseline justify-between gap-4 border-t border-champagne pt-2.5">
              <dt className="text-[13px] font-medium text-espresso">Current balance</dt>
              <dd className="tabular text-[15px] font-semibold text-error">{formatPeso(order.balance)}</dd>
            </div>
          </dl>

          <Input
            id="amount"
            label="Amount received *"
            inputMode="decimal"
            placeholder="0.00"
            leading="₱"
            value={form.amount}
            onChange={(event) => setForm((prev) => ({ ...prev, amount: event.target.value }))}
            error={errors.amount}
            hint={settled ? `Balance after: ${formatPeso(balanceAfter)}` : `Remaining: ${formatPeso(order.balance)}`}
            required
          />

          {/* Live ledger so the cashier can see the effect before committing. */}
          {settled && (
            <dl className="space-y-2.5 rounded-control border border-champagne bg-ivory px-4 py-3.5">
              <div className="flex items-baseline justify-between gap-4">
                <dt className="text-[13px] text-warmgray">Remaining balance</dt>
                <dd className="tabular text-[13px] text-espresso">
                  {formatPeso(order.balance)}
                </dd>
              </div>
              <div className="flex items-baseline justify-between gap-4">
                <dt className="text-[13px] text-warmgray">This payment</dt>
                <dd className="tabular text-[13px] text-espresso">−{formatPeso(entered)}</dd>
              </div>
              <div className="flex items-baseline justify-between gap-4 border-t border-champagne pt-2.5">
                <dt className="text-[13px] font-medium text-espresso">Balance after</dt>
                <dd
                  className={
                    balanceAfter > 0
                      ? 'tabular text-sm font-semibold text-error'
                      : 'tabular text-sm font-semibold text-success'
                  }
                >
                  {balanceAfter > 0 ? formatPeso(balanceAfter) : 'Settled in full'}
                </dd>
              </div>
            </dl>
          )}

          <div className="grid grid-cols-2 items-end gap-4">
            <Input
              id="payment_date"
              label="Payment date *"
              type="date"
              value={form.payment_date}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, payment_date: event.target.value }))
              }
              error={errors.payment_date}
              required
            />

            <Select
              id="method"
              label="Payment method *"
              value={form.method}
              options={PAYMENT_METHODS}
              onChange={(value) => setForm((prev) => ({ ...prev, method: value }))}
              required
            />
          </div>

          <Textarea
            id="payment_notes"
            label="Notes"
            placeholder="Deposit, balance on pickup, full payment…"
            value={form.notes}
            onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))}
          />
        </form>
      </DialogContent>
    </Dialog>
  )
}