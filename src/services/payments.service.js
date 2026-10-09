import { paymentMethodOf } from '@/lib/constants'
import { supabase, unwrap } from '@/lib/supabase'
import { toAppError } from '@/utils/errors'
import { toAmount, toDateKey } from '@/utils/dates'

const EXPORT_BATCH_SIZE = 1000
const LOOKUP_BATCH_SIZE = 500

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
  if (!input.idempotency_key) {
    throw toAppError(new Error('payment idempotency key is required'), 'savePayment')
  }

  const payload = {
    p_order_id: input.order_id,
    p_amount: amount,
    p_payment_date: input.payment_date,
    p_notes: input.notes?.trim() || null,
    p_idempotency_key: input.idempotency_key,
  }

  try {
    return unwrap(await supabase.rpc('record_order_payment', payload).single())
  } catch (caught) {
    throw toAppError(caught, 'savePayment')
  }
}

export async function listPayments(from, to) {
  try {
    let query = supabase
      .from('payments')
      .select('id, order_id, amount, payment_date, notes, status, voided_at, created_at')
      .eq('status', 'COMPLETED')
    if (from) query = query.gte('payment_date', from)
    if (to) query = query.lte('payment_date', to)
    return unwrap(await query.order('payment_date', { ascending: false }))
  } catch (caught) {
    throw toAppError(caught, 'loadPayments')
  }
}

export async function getEarliestPaymentDate() {
  try {
    const { data, error } = await supabase
      .from('payments')
      .select('payment_date')
      .eq('status', 'COMPLETED')
      .order('payment_date', { ascending: true })
      .limit(1)
      .maybeSingle()
    if (error) throw error
    return data?.payment_date ?? null
  } catch (caught) {
    throw toAppError(caught, 'loadPayments')
  }
}

export async function listPaymentExportRows(from, to) {
  try {
    const payments = []
    for (let offset = 0; ; offset += EXPORT_BATCH_SIZE) {
      let query = supabase.from('payments').select('*').eq('status', 'COMPLETED')
      if (from) query = query.gte('payment_date', from)
      if (to) query = query.lte('payment_date', to)

      const batch = unwrap(
        await query
          .order('payment_date', { ascending: false })
          .range(offset, offset + EXPORT_BATCH_SIZE - 1),
      )
      payments.push(...batch)
      if (batch.length < EXPORT_BATCH_SIZE) break
    }

    const orderIds = [...new Set(payments.map((payment) => payment.order_id))]
    const orders = []
    for (let offset = 0; offset < orderIds.length; offset += LOOKUP_BATCH_SIZE) {
      const ids = orderIds.slice(offset, offset + LOOKUP_BATCH_SIZE)
      orders.push(
        ...unwrap(
          await supabase
            .from('orders')
            .select('id, order_number, description, patient_id')
            .in('id', ids),
        ),
      )
    }

    const patientIds = [...new Set(orders.map((order) => order.patient_id))]
    const patients = []
    for (let offset = 0; offset < patientIds.length; offset += LOOKUP_BATCH_SIZE) {
      const ids = patientIds.slice(offset, offset + LOOKUP_BATCH_SIZE)
      patients.push(
        ...unwrap(
          await supabase.from('patients').select('id, full_name').in('id', ids),
        ),
      )
    }

    const orderById = new Map(orders.map((order) => [order.id, order]))
    const patientById = new Map(patients.map((patient) => [patient.id, patient]))
    return payments.map((payment) => {
      const order = orderById.get(payment.order_id)
      return {
        ...payment,
        customer: patientById.get(order?.patient_id)?.full_name ?? '',
        item_type: 'Order payment',
        description: order?.description ?? '',
      }
    })
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
