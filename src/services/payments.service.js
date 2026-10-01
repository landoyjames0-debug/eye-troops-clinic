import { paymentMethodOf } from '@/lib/constants'
import { supabase, unwrap } from '@/lib/supabase'
import { toAppError } from '@/utils/errors'
import { toAmount, toDateKey } from '@/utils/dates'

/**
 * Every payment is an immutable record. Nothing here updates or deletes an
 * existing row — corrections are made by adding a new entry.
 */
/**
 * A new order with money against it is a deposit; reaching the full amount
 * settles it. The label is written into the payment note for the record.
 */
export function paymentTypeFor(total, paid) {
  if (!(paid > 0)) return 'Unpaid'
  return paid >= total ? 'Paid in Full' : 'Deposit'
}

export async function createPayment(input) {
  const amount = toAmount(input.amount)
  if (!(amount > 0)) {
    throw toAppError(new Error('amount must be positive'), 'savePayment')
  }

  const payload = {
    order_id: input.order_id,
    amount,
    payment_date: input.payment_date,
    notes: input.notes.trim() || null,
  }

  try {
    return unwrap(await supabase.from('payments').insert(payload).select('*').single())
  } catch (caught) {
    throw toAppError(caught, 'savePayment')
  }
}

export async function listPayments(from, to) {
  try {
    let query = supabase.from('payments').select('*').eq('status', 'COMPLETED')
    if (from) query = query.gte('payment_date', from)
    if (to) query = query.lte('payment_date', to)
    return unwrap(await query.order('payment_date', { ascending: false }))
  } catch (caught) {
    throw toAppError(caught, 'loadPayments')
  }
}

/**
 * Voids a payment rather than deleting it. The row stays in the ledger so the
 * order's history remains auditable; it simply stops counting toward sales.
 */
export async function voidPayment(paymentId) {
  const stamp = new Date().toISOString()

  try {
    return unwrap(
      await supabase
        .from('payments')
        .update({ status: 'VOIDED', voided_at: stamp })
        .eq('id', paymentId)
        .select('*')
        .single(),
    )
  } catch (caught) {
    throw toAppError(caught, 'voidPayment')
  }
}

/** "Collected today" in the clinic's local timezone. */
export async function collectedOn(date = toDateKey()) {
  const rows = await listPayments(date, date)
  return toAmount(rows.reduce((sum, row) => sum + Number(row.amount), 0))
}

/**
 * Today's takings grouped by payment method, so the front desk can reconcile the
 * cash drawer against the ledger at closing time.
 */
export async function collectionsByMethod(date = toDateKey()) {
  const rows = await listPayments(date, date)
  const byMethod = new Map()

  for (const payment of rows) {
    const key = paymentMethodOf(payment) ?? 'Unspecified'
    byMethod.set(key, toAmount((byMethod.get(key) ?? 0) + Number(payment.amount)))
  }

  return [...byMethod.entries()]
    .map(([method, amount]) => ({ method, amount }))
    .sort((a, b) => b.amount - a.amount)
}
