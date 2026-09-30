import { IS_SUPABASE_CONFIGURED, ORDER_NUMBER_PREFIX } from '@/lib/constants'
import { supabase, unwrap } from '@/lib/supabase'
import { toAppError } from '@/utils/errors'
import { toAmount, toDateKey } from '@/utils/dates'

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
      .filter((order) => order.status !== 'CLAIMED' && order.status !== 'CANCELLED')
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

  if (!IS_SUPABASE_CONFIGURED) {
    const { DEMO_ORDERS, DEMO_ALL_PAYMENTS, DEMO_PATIENTS } = await import('@/lib/demo-data')
    const term = search.trim().toLowerCase()
    return DEMO_ORDERS.filter((order) => {
      const patient = DEMO_PATIENTS.find((row) => row.id === order.patient_id)
      const matchesStatus = status === 'ALL' || order.status === status
      const matchesTerm =
        !term ||
        order.order_number.toLowerCase().includes(term) ||
        (patient?.full_name.toLowerCase().includes(term) ?? false) ||
        (patient?.cp_number ?? '').includes(term)
      return matchesStatus && matchesTerm
    })
      .map((order) => withTotals(order, DEMO_ALL_PAYMENTS))
      .filter(matchesPayment)
      .sort((a, b) => Date.parse(b.order_date) - Date.parse(a.order_date))
  }

  try {
    let query = supabase.from('orders').select('*')
    if (status !== 'ALL') query = query.eq('status', status)
    if (search.trim()) query = query.ilike('order_number', `%${search.trim()}%`)

    const [orders, payments, patients] = await Promise.all([
      query.order('order_date', { ascending: false }),
      supabase.from('payments').select('*'),
      supabase.from('patients').select('*'),
    ])

    const term = search.trim().toLowerCase()
    const patientById = new Map((patients.data ?? []).map((p) => [p.id, p]))

    return unwrap(orders)
      .filter((order) => {
        if (!term) return true
        const patient = patientById.get(order.patient_id)
        return (
          order.order_number.toLowerCase().includes(term) ||
          (patient?.full_name.toLowerCase().includes(term) ?? false) ||
          (patient?.cp_number ?? '').toLowerCase().includes(term)
        )
      })
      .map((order) => withTotals(order, payments.data ?? []))
      .filter(matchesPayment)
  } catch (caught) {
    throw toAppError(caught, 'loadOrders')
  }
}

export async function getOrderDetail(orderId) {
  if (!IS_SUPABASE_CONFIGURED) {
    const { DEMO_ORDERS, DEMO_ALL_PAYMENTS, DEMO_PATIENTS } = await import('@/lib/demo-data')
    const order = DEMO_ORDERS.find((row) => row.id === orderId)
    if (!order) throw toAppError(new Error('not found'), 'notFound')
    return {
      order: withTotals(order, DEMO_ALL_PAYMENTS),
      patient: DEMO_PATIENTS.find((row) => row.id === order.patient_id) ?? null,
    }
  }

  try {
    const orderResult = await supabase.from('orders').select('*').eq('id', orderId).maybeSingle()
    if (orderResult.error) throw orderResult.error
    if (!orderResult.data) throw toAppError(new Error('not found'), 'notFound')

    const payments = unwrap(await supabase.from('payments').select('*').eq('order_id', orderId))
    const patientResult = await supabase
      .from('patients')
      .select('*')
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
  if (!IS_SUPABASE_CONFIGURED) {
    const { DEMO_ORDER_STATUS_HISTORY } = await import('@/lib/demo-data')
    return DEMO_ORDER_STATUS_HISTORY.filter((row) => row.order_id === orderId).sort(
      (a, b) => Date.parse(a.changed_at) - Date.parse(b.changed_at),
    )
  }

  try {
    const { data, error } = await supabase
      .from('order_status_history')
      .select('*')
      .eq('order_id', orderId)
      .order('changed_at', { ascending: true })
    if (error) throw error
    return data ?? []
  } catch (caught) {
    throw toAppError(caught, 'loadOrders')
  }
}

/** Sequence is the count of orders in the current year, so numbers are stable. */
async function nextOrderNumber() {
  const year = new Date().getFullYear()
  const { count, error } = await supabase
    .from('orders')
    .select('id', { count: 'exact', head: true })
    .gte('order_date', `${year}-01-01`)
    .lte('order_date', `${year}-12-31`)

  if (error) throw error
  return buildOrderNumber((count ?? 0) + 1)
}

export async function createOrder(input) {
  const payload = {
    patient_id: input.patient_id,
    visit_id: input.visit_id,
    description: input.description.trim() || null,
    total_amount: toAmount(input.total_amount),
    status: input.status,
    order_date: toDateKey(),
  }

  if (!IS_SUPABASE_CONFIGURED) {
    const { DEMO_ORDERS, DEMO_ORDER_STATUS_HISTORY } = await import('@/lib/demo-data')
    const order = {
      id: `ord-${DEMO_ORDERS.length + 1}`,
      order_number: buildOrderNumber(DEMO_ORDERS.length + 1),
      ...payload,
      created_by: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    DEMO_ORDERS.unshift(order)
    // Mirrors the orders_log_status trigger, which writes the trail in Postgres.
    DEMO_ORDER_STATUS_HISTORY.push({
      id: `osh-${order.id}-0`,
      order_id: order.id,
      status: order.status,
      changed_at: order.created_at,
      changed_by: null,
    })
    return order
  }

  try {
    const orderNumber = await nextOrderNumber()
    return unwrap(
      await supabase
        .from('orders')
        .insert({ ...payload, order_number: orderNumber })
        .select('*')
        .single(),
    )
  } catch (caught) {
    throw toAppError(caught, 'saveOrder')
  }
}

export async function updateOrderStatus(orderId, status) {
  if (!IS_SUPABASE_CONFIGURED) {
    const { DEMO_ORDERS, DEMO_ORDER_STATUS_HISTORY } = await import('@/lib/demo-data')
    const order = DEMO_ORDERS.find((row) => row.id === orderId)
    if (!order) throw toAppError(new Error('not found'), 'notFound')
    order.status = status
    order.updated_at = new Date().toISOString()
    DEMO_ORDER_STATUS_HISTORY.push({
      id: `osh-${orderId}-${DEMO_ORDER_STATUS_HISTORY.length}`,
      order_id: orderId,
      status,
      changed_at: order.updated_at,
      changed_by: null,
    })
    return order
  }

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

  if (!IS_SUPABASE_CONFIGURED) {
    const { DEMO_ORDERS } = await import('@/lib/demo-data')
    const order = DEMO_ORDERS.find((row) => row.id === orderId)
    if (!order) throw toAppError(new Error('not found'), 'notFound')
    Object.assign(order, payload, { updated_at: new Date().toISOString() })
    return order
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
  return updateOrderStatus(orderId, 'CANCELLED')
}
