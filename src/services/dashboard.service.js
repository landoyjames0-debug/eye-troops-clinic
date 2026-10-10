import { listOrders, outstandingBalance, withTotals } from './orders.service'
import { listExpenses, totalExpenses } from './expenses.service'
import { listPayments } from './payments.service'
import { listAppointments } from './appointments.service'
import { listPatients } from './patients.service'
import { getFollowupCounts, listFollowups } from '@/lib/followups'
import { APPOINTMENT_STATUS, normalizeAppointmentStatus } from '@/lib/appointment-status'
import { monthBounds, toAmount, toDateKey, yearBounds } from '@/utils/dates'
import { monthLabel, formatMonthYear } from '@/utils/format'
import { ORDER_STATUS } from '@/lib/constants'

/**
 * All money figures here are summed from `payments` and `expenses` at read
 * time. Nothing is stored pre-aggregated, so the figures can never drift from
 * the underlying records.
 */
export async function getDashboardSummary() {
  const today = toDateKey()
  const { from, to } = monthBounds(new Date().getFullYear(), new Date().getMonth())

  const [todayPayments, monthPayments, monthExpenses, orders, appointmentsTodayList, followupCounts] = await Promise.all([
    listPayments(today, today),
    listPayments(from, to),
    listExpenses(from, to),
    listOrders(),
    listAppointments({ from: `${today}T00:00:00`, to: `${today}T23:59:59` }),
    getFollowupCounts(),
  ])

  const salesThisMonth = toAmount(monthPayments.reduce((sum, row) => sum + Number(row.amount), 0))
  const expensesThisMonth = totalExpenses(monthExpenses)
  const openOrders = orders.filter((order) => ![ORDER_STATUS.CLAIMED, ORDER_STATUS.CANCELLED].includes(order.status))
  return {
    collectedToday: toAmount(
      todayPayments.reduce((sum, row) => sum + Number(row.amount), 0),
    ),
    salesThisMonth,
    expensesThisMonth,
    monthNet: toAmount(salesThisMonth - expensesThisMonth),
    unpaidBalances: outstandingBalance(orders),
    pickupsDue: openOrders.filter((order) => order.status === ORDER_STATUS.READY_FOR_PICKUP).length,
    followUpsDue: followupCounts.all,
    appointmentsToday: appointmentsTodayList.filter(
      (item) => normalizeAppointmentStatus(item.status) !== APPOINTMENT_STATUS.CANCELLED,
    ).length,
    currentMonthLabel: formatMonthYear(new Date()),
  }
}

/** 12 months of sales, expenses and net, oldest first. */
export async function getMonthlySeries(year) {
  const { from, to } = yearBounds(year)
  const [payments, expenses] = await Promise.all([listPayments(from, to), listExpenses(from, to)])

  return Array.from({ length: 12 }, (_, month) => {
    const prefix = `${year}-${String(month + 1).padStart(2, '0')}`

    const sales = toAmount(
      payments
        .filter((row) => row.payment_date.startsWith(prefix))
        .reduce((sum, row) => sum + Number(row.amount), 0),
    )
    const monthExpenses = toAmount(
      expenses
        .filter((row) => row.expense_date.startsWith(prefix))
        .reduce((sum, row) => sum + Number(row.amount), 0),
    )

    return {
      month,
      label: monthLabel(month).slice(0, 3),
      sales,
      expenses: monthExpenses,
      net: toAmount(sales - monthExpenses),
    }
  })
}

/**
 * Today's front-desk feed: orders placed, payments taken and pickups handed
 * over on the given local day. Built from the same records the rest of the app
 * uses, so it can never disagree with the ledger.
 */
export async function getTodayActivity(date = toDateKey()) {
  const [orders, payments, appointments] = await Promise.all([
    listOrders(),
    listPayments(date, date),
    listAppointments({ from: `${date}T00:00:00`, to: `${date}T23:59:59` }),
  ])

  const orderById = new Map(orders.map((order) => [order.id, order]))
  const rows = []

  const recordDateKey = (record) => {
    const raw = record?.visit_date ?? record?.order_date ?? record?.created_at ?? record?.updated_at
    return raw ? toDateKey(raw) : null
  }

  for (const order of orders) {
    const patient = order.patient_name ?? 'Unknown patient'
    if (recordDateKey(order) === date) {
      rows.push({
        id: `order-${order.id}`,
        order_id: order.id,
        patient_id: order.patient_id,
        patient,
        transaction: 'New Order',
        amount: toAmount(order.total_amount),
        status: order.status,
        at: order.created_at ?? order.order_date,
      })
    }
    // A claimed order is a pickup event, and it carries no money of its own.
    if (order.status === ORDER_STATUS.CLAIMED && String(order.updated_at ?? '').startsWith(date)) {
      rows.push({
        id: `pickup-${order.id}`,
        order_id: order.id,
        patient_id: order.patient_id,
        patient,
        transaction: 'Pickup',
        amount: 0,
        status: ORDER_STATUS.CLAIMED,
        at: order.updated_at,
      })
    }
  }

  for (const payment of payments) {
    const order = orderById.get(payment.order_id)
    rows.push({
      id: `payment-${payment.id}`,
      order_id: order?.id ?? null,
      patient_id: order?.patient_id ?? null,
      patient: order?.patient_name ?? 'Unknown patient',
      transaction: payment.notes?.trim() || 'Payment',
      amount: toAmount(payment.amount),
      status: 'PAID',
      at: payment.created_at ?? payment.payment_date,
    })
  }

  for (const appointment of appointments) {
    rows.push({
      id: `appointment-${appointment.id}`,
      appointment_id: appointment.id,
      patient_id: appointment.patient_id,
      patient: appointment.patient_name ?? 'Unknown patient',
      transaction: appointment.appointment_type === 'Follow Up' ? 'Follow-up' : 'Appointment',
      amount: 0,
      status: appointment.status,
      at: `${appointment.appointment_date}T${appointment.appointment_time}`,
    })
  }

  return rows
    .sort((a, b) => Date.parse(b.at) - Date.parse(a.at))
    .slice(0, 8)
}

/** Orders waiting for a patient to collect them. */
export async function getPickupsDue() {
  const orders = await listOrders('', ORDER_STATUS.READY_FOR_PICKUP, 'ALL')

  return orders
    .map((order) => ({
      id: order.id,
      patient_id: order.patient_id,
      patient: order.patient_name ?? 'Unknown patient',
      order_number: order.order_number,
      ready_date: order.updated_at ?? order.order_date,
      balance: toAmount(order.balance),
      status: order.status,
    }))
    .sort((a, b) => Date.parse(a.ready_date) - Date.parse(b.ready_date))
}

export async function getFollowUpsDue() {
  return listFollowups({ filter: 'all', limit: 5 })
}

export { withTotals }
