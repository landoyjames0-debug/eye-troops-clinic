import { ORDER_NUMBER_PREFIX, ORDER_STATUS } from '@/lib/constants'
import { supabase, unwrap } from '@/lib/supabase'
import { toAppError } from '@/utils/errors'
import { toAmount } from '@/utils/dates'

/** `paid` and `balance` are always derived — never stored on the order row. */
export function withTotals(order, payments) {
  const mine = payments.filter((payment) => payment.order_id === order.id)
  const paid = toAmount(
    mine
      .filter(isCompletedPayment)
      .reduce((sum, payment) => sum + Number(payment.amount), 0),
  )
  return {
    ...order,
    payments: mine.sort((a, b) => Date.parse(b.payment_date) - Date.parse(a.payment_date)),
    paid,
    balance: toAmount(Number(order.total_amount) - paid),
  }
}

/** Voided and refunded payments no longer count toward the amount paid. */
export function isCompletedPayment(payment) {
  return !payment.status || payment.status === 'COMPLETED'
}

/**
 * Money still owed. Shared by the dashboard, the patient list and the order
 * drawer so all three always agree: a claimed or cancelled order carries no
 * balance, and an overpaid order never subtracts from the figure.
 */
export function outstandingBalance(orders) {
  return toAmount(
    orders
      .filter((order) => order.status !== ORDER_STATUS.CLAIMED && order.status !== ORDER_STATUS.CANCELLED)
      .reduce((sum, order) => sum + Math.max(Number(order.balance), 0), 0),
  )
}

export function buildOrderNumber(sequence, date = new Date()) {
  const year = date.getFullYear()
  return `${ORDER_NUMBER_PREFIX}${year}-${String(sequence).padStart(5, '0')}`
}

export async function listOrders(search = '', status = 'ALL', paymentFilter = 'ALL') {
  const matchesPayment = (order) => {
    if (paymentFilter === 'OUTSTANDING') return toAmount(order.balance) > 0
    if (paymentFilter === 'PAID') return toAmount(order.balance) <= 0
    return true
  }

  try {
    let query = supabase
      .from('orders')
      .select('id, order_number, patient_id, visit_id, description, total_amount, status, order_date, created_at, updated_at')
    if (status !== 'ALL') query = query.eq('status', status)
    if (search.trim()) query = query.ilike('order_number', `%${search.trim()}%`)

    const [orders, payments, patients] = await Promise.all([
      query.order('order_date', { ascending: false }),
      supabase.from('payments').select('id, order_id, amount, status'),
      supabase.from('patients').select('id, full_name, cp_number'),
    ])

    const term = search.trim().toLowerCase()
    const patientById = new Map((patients.data ?? []).map((p) => [p.id, p]))

    return unwrap(orders)
      .map((order) => {
        const patient = patientById.get(order.patient_id) ?? null
        return {
          ...order,
          patient,
          patient_name: patient?.full_name ?? '—',
          patient_phone: patient?.cp_number ?? null,
        }
      })
      .filter((order) => {
        if (!term) return true
        return (
          order.order_number.toLowerCase().includes(term) ||
          order.patient_name.toLowerCase().includes(term) ||
          (order.patient_phone ?? '').toLowerCase().includes(term)
        )
      })
      .map((order) => withTotals(order, payments.data ?? []))
      .filter(matchesPayment)
  } catch (caught) {
    throw toAppError(caught, 'loadOrders')
  }
}

export async function getOrderDetail(orderId) {
  try {
    const orderResult = await supabase
      .from('orders')
      .select('id, order_number, patient_id, visit_id, description, total_amount, status, order_date, created_at, updated_at')
      .eq('id', orderId)
      .maybeSingle()
    if (orderResult.error) throw orderResult.error
    if (!orderResult.data) throw toAppError(new Error('not found'), 'notFound')

    const payments = unwrap(
      await supabase
        .from('payments')
        .select('id, order_id, amount, payment_date, notes, status, created_at')
        .eq('order_id', orderId),
    )
    const patientResult = await supabase
      .from('patients')
      .select('id, full_name, cp_number, address, notes')
      .eq('id', orderResult.data.patient_id)
      .maybeSingle()

    return {
      order: withTotals(orderResult.data, payments),
      patient: patientResult.data ?? null,
    }
  } catch (caught) {
    throw toAppError(caught, 'loadOrders')
  }
}

/**
 * Append-only trail of status changes for one order. Oldest first so the
 * drawer renders created → in lab → ready → claimed top to bottom.
 */
export async function getOrderStatusHistory(orderId) {
  try {
    const { data, error } = await supabase
      .from('order_status_history')
      .select('id, order_id, status, changed_at, changed_by')
      .eq('order_id', orderId)
      .order('changed_at', { ascending: true })
    if (error) throw error
    return data ?? []
  } catch (caught) {
    throw toAppError(caught, 'loadOrders')
  }
}

export async function updateOrderStatus(orderId, status) {
  try {
    // `updated_at` is maintained by the orders_touch_updated_at trigger, so the
    // client never sets it — that keeps it correct even if the trigger changes.
    // The status trail is written by orders_log_status for the same reason.
    return unwrap(
      await supabase
        .from('orders')
        .update({ status })
        .eq('id', orderId)
        .select('*')
        .single(),
    )
  } catch (caught) {
    throw toAppError(caught, 'updateStatus')
  }
}

/** Editing the order's description or total; the derived balance follows. */
export async function updateOrder(orderId, input) {
  const payload = {
    description: input.description?.trim() || null,
    total_amount: toAmount(input.total_amount),
  }

  try {
    return unwrap(
      await supabase.from('orders').update(payload).eq('id', orderId).select('*').single(),
    )
  } catch (caught) {
    throw toAppError(caught, 'updateOrder')
  }
}

/**
 * Cancelling keeps the order and every payment attached to it for reference.
 * It is a status change, never a destructive delete.
 */
export async function cancelOrder(orderId) {
  try {
    return unwrap(await supabase.rpc('cancel_order', {
      p_order_id: orderId,
      p_reason: null,
    }).single())
  } catch (caught) {
    throw toAppError(caught, 'cancelOrder')
  }
}
