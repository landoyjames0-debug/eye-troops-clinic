import { addDays, monthBounds, toAmount, toDateKey } from '@/utils/dates'

/**
 * Fictional sample data. Used only when no Supabase project is configured so a
 * fresh clone is explorable. Mirrors supabase/seed.sql.
 *
 * None of this is real patient information.
 */

const now = new Date()

function isoAt(hour, minute = 0, dayOffset = 0) {
  const date = addDays(now, dayOffset)
  date.setHours(hour, minute, 0, 0)
  return date.toISOString()
}

function dateAt(dayOffset) {
  return toDateKey(addDays(now, dayOffset))
}

export const DEMO_PATIENTS = [
  {
    id: 'pat-1',
    full_name: 'Maria Santos',
    cp_number: '09171234567',
    address: '24 Kalachuchi St, Quezon City',
    notes: 'Prefers progressive lenses.',
    created_at: isoAt(9, 0, -420),
    updated_at: isoAt(9, 0, -420),
  },
  {
    id: 'pat-2',
    full_name: 'John Dela Cruz',
    cp_number: '09281234567',
    address: '118 Katipunan Ave, Quezon City',
    notes: null,
    created_at: isoAt(10, 0, -260),
    updated_at: isoAt(10, 0, -260),
  },
  {
    id: 'pat-3',
    full_name: 'Angela Reyes',
    cp_number: '09182345678',
    address: '7 Batasan Hills, Caloocan',
    notes: 'Contact lens solution refill every 6 months.',
    created_at: isoAt(11, 0, -150),
    updated_at: isoAt(11, 0, -150),
  },
  {
    id: 'pat-4',
    full_name: 'Mark Villanueva',
    cp_number: '09293456789',
    address: '221 Mabini St, Manila',
    notes: 'Always claims on weekends.',
    created_at: isoAt(14, 0, -90),
    updated_at: isoAt(14, 0, -90),
  },
  {
    id: 'pat-5',
    full_name: 'Rowan Bautista',
    cp_number: '09304567890',
    address: '55 Taft Ave, Pasay',
    notes: null,
    created_at: isoAt(16, 0, -30),
    updated_at: isoAt(16, 0, -30),
  },
  {
    id: 'pat-6',
    full_name: 'Camille Mendoza',
    cp_number: '09315678901',
    address: '12 Ortigas Ave, Pasig',
    notes: 'Sensitive to metal frames.',
    created_at: isoAt(8, 30, -12),
    updated_at: isoAt(8, 30, -12),
  },
]

export const DEMO_VISITS = [
  { id: 'vis-1', patient_id: 'pat-1', visit_date: isoAt(9, 0, -14), notes: 'Routine eye exam.', created_by: null, created_at: isoAt(9, 0, -14) },
  { id: 'vis-2', patient_id: 'pat-1', visit_date: isoAt(9, 0, -420), notes: 'First visit.', created_by: null, created_at: isoAt(9, 0, -420) },
  { id: 'vis-3', patient_id: 'pat-2', visit_date: isoAt(10, 0, -10), notes: 'Progressive fitting.', created_by: null, created_at: isoAt(10, 0, -10) },
  { id: 'vis-4', patient_id: 'pat-3', visit_date: isoAt(11, 0, -8), notes: 'Contact lens check.', created_by: null, created_at: isoAt(11, 0, -8) },
  { id: 'vis-5', patient_id: 'pat-4', visit_date: isoAt(14, 0, -6), notes: 'Claimed previous order.', created_by: null, created_at: isoAt(14, 0, -6) },
  { id: 'vis-6', patient_id: 'pat-5', visit_date: isoAt(16, 0, -3), notes: 'Single-vision reading glasses.', created_by: null, created_at: isoAt(16, 0, -3) },
  { id: 'vis-7', patient_id: 'pat-6', visit_date: isoAt(8, 30, -1), notes: 'Titanium frame fitting.', created_by: null, created_at: isoAt(8, 30, -1) },
  { id: 'vis-8', patient_id: 'pat-1', visit_date: isoAt(9, 42), notes: 'Balance payment for ET-2026-00118.', created_by: null, created_at: isoAt(9, 42) },
  { id: 'vis-9', patient_id: 'pat-2', visit_date: isoAt(10, 15), notes: 'New order placed.', created_by: null, created_at: isoAt(10, 15) },
  { id: 'vis-10', patient_id: 'pat-3', visit_date: isoAt(11, 3), notes: 'Balance payment received.', created_by: null, created_at: isoAt(11, 3) },
]

export const DEMO_PRESCRIPTIONS = [
  { id: 'pre-1', visit_id: 'vis-1', od_sph: '-1.25', od_cyl: '-0.50', od_axis: '180', od_add: '+1.00', od_pd: '31.0', os_sph: '-1.50', os_cyl: '-0.25', os_axis: '175', os_add: '+1.00', os_pd: '31.0', created_at: isoAt(9, 0, -14) },
  { id: 'pre-2', visit_id: 'vis-2', od_sph: '-1.00', od_cyl: '-0.25', od_axis: '180', od_add: null, od_pd: '31.5', os_sph: '-1.25', os_cyl: '-0.25', os_axis: '170', os_add: null, os_pd: '31.5', created_at: isoAt(9, 0, -420) },
  { id: 'pre-3', visit_id: 'vis-3', od_sph: '-2.00', od_cyl: '-0.75', od_axis: '85', od_add: '+1.75', od_pd: '32.0', os_sph: '-2.25', os_cyl: '-0.50', os_axis: '90', os_add: '+1.75', os_pd: '32.0', created_at: isoAt(10, 0, -10) },
  { id: 'pre-4', visit_id: 'vis-4', od_sph: '-0.75', od_cyl: null, od_axis: null, od_add: null, od_pd: '30.5', os_sph: '-0.75', os_cyl: null, os_axis: null, os_add: null, os_pd: '30.5', created_at: isoAt(11, 0, -8) },
  { id: 'pre-5', visit_id: 'vis-5', od_sph: '+1.00', od_cyl: null, od_axis: null, od_add: null, od_pd: '30.0', os_sph: '+1.00', os_cyl: null, os_axis: null, os_add: null, os_pd: '30.0', created_at: isoAt(14, 0, -6) },
  { id: 'pre-6', visit_id: 'vis-6', od_sph: '+2.00', od_cyl: null, od_axis: null, od_add: null, od_pd: '30.0', os_sph: '+2.25', os_cyl: null, os_axis: null, os_add: null, os_pd: '30.0', created_at: isoAt(16, 0, -3) },
  { id: 'pre-7', visit_id: 'vis-7', od_sph: '-3.00', od_cyl: '-1.00', od_axis: '100', od_add: '+2.00', od_pd: '32.5', os_sph: '-3.25', os_cyl: '-0.75', os_axis: '80', os_add: '+2.00', os_pd: '32.5', created_at: isoAt(8, 30, -1) },
  { id: 'pre-8', visit_id: 'vis-8', od_sph: '-1.25', od_cyl: '-0.50', od_axis: '180', od_add: '+1.00', od_pd: '31.0', os_sph: '-1.50', os_cyl: '-0.25', os_axis: '175', os_add: '+1.00', os_pd: '31.0', created_at: isoAt(9, 42) },
  { id: 'pre-9', visit_id: 'vis-9', od_sph: '-2.00', od_cyl: '-0.75', od_axis: '85', od_add: '+1.75', od_pd: '32.0', os_sph: '-2.25', os_cyl: '-0.50', os_axis: '90', os_add: '+1.75', os_pd: '32.0', created_at: isoAt(10, 15) },
  { id: 'pre-10', visit_id: 'vis-10', od_sph: '-0.75', od_cyl: null, od_axis: null, od_add: null, od_pd: '30.5', os_sph: '-0.75', os_cyl: null, os_axis: null, os_add: null, os_pd: '30.5', created_at: isoAt(11, 3) },
]

export const DEMO_ORDERS = [
  { id: 'ord-1', order_number: 'ET-2026-00124', patient_id: 'pat-1', visit_id: 'vis-1', description: 'Complete Progressive Glasses — gold titanium frame', total_amount: 5500, status: 'IN_LAB', order_date: dateAt(-14), created_by: null, created_at: isoAt(9, 0, -14), updated_at: isoAt(9, 0, -14) },
  { id: 'ord-2', order_number: 'ET-2026-00123', patient_id: 'pat-2', visit_id: 'vis-3', description: 'Progressive lenses — acetate frame', total_amount: 6200, status: 'ORDERED', order_date: dateAt(-10), created_by: null, created_at: isoAt(10, 0, -10), updated_at: isoAt(10, 0, -10) },
  { id: 'ord-3', order_number: 'ET-2026-00122', patient_id: 'pat-3', visit_id: 'vis-4', description: 'Contact lens supply — 3-month', total_amount: 1800, status: 'READY_FOR_PICKUP', order_date: dateAt(-8), created_by: null, created_at: isoAt(11, 0, -8), updated_at: isoAt(11, 0, -8) },
  { id: 'ord-4', order_number: 'ET-2026-00121', patient_id: 'pat-4', visit_id: 'vis-5', description: 'Reading glasses +2.00 — metal frame', total_amount: 2400, status: 'CLAIMED', order_date: dateAt(-6), created_by: null, created_at: isoAt(14, 0, -6), updated_at: isoAt(14, 0, -6) },
  { id: 'ord-5', order_number: 'ET-2026-00120', patient_id: 'pat-5', visit_id: 'vis-6', description: 'Single-vision reading glasses', total_amount: 1950, status: 'READY_FOR_PICKUP', order_date: dateAt(-3), created_by: null, created_at: isoAt(16, 0, -3), updated_at: isoAt(16, 0, -3) },
  { id: 'ord-6', order_number: 'ET-2026-00119', patient_id: 'pat-6', visit_id: 'vis-7', description: 'Titanium frame with progressive lenses', total_amount: 9800, status: 'READY_FOR_PICKUP', order_date: dateAt(-1), created_by: null, created_at: isoAt(8, 30, -1), updated_at: isoAt(8, 30, -1) },
  { id: 'ord-7', order_number: 'ET-2026-00118', patient_id: 'pat-1', visit_id: 'vis-8', description: 'Replacement nose pads and frame adjustment', total_amount: 850, status: 'CLAIMED', order_date: dateAt(-2), created_by: null, created_at: isoAt(9, 30, -2), updated_at: isoAt(13, 0, -2) },
  { id: 'ord-8', order_number: 'ET-2026-00117', patient_id: 'pat-3', visit_id: 'vis-10', description: 'Blue-light filter coating', total_amount: 1500, status: 'ORDERED', order_date: dateAt(-4), created_by: null, created_at: isoAt(11, 3, -4), updated_at: isoAt(11, 3, -4) },
]

const STATUS_FLOW = ['ORDERED', 'IN_LAB', 'READY_FOR_PICKUP', 'CLAIMED']

/**
 * Reconstructs an append-only status trail for each seeded order by spreading
 * the flow between its `created_at` and `updated_at`. Mirrors the
 * `order_status_history` table so the drawer timeline is exercised in demo mode.
 */
export const DEMO_ORDER_STATUS_HISTORY = DEMO_ORDERS.flatMap((order) => {
  const flow =
    order.status === 'CANCELLED'
      ? ['ORDERED', 'CANCELLED']
      : STATUS_FLOW.slice(0, STATUS_FLOW.indexOf(order.status) + 1)

  const start = new Date(order.created_at).getTime()
  const end = new Date(order.updated_at).getTime()
  const span = Math.max(end - start, 0)
  const step = flow.length > 1 ? span / (flow.length - 1) : 0

  return flow.map((status, index) => ({
    id: `osh-${order.id}-${index}`,
    order_id: order.id,
    status,
    changed_at: new Date(start + step * index).toISOString(),
    changed_by: null,
  }))
})

export const DEMO_PAYMENTS = [
  { id: 'pay-1', order_id: 'ord-1', amount: 2500, payment_date: dateAt(-14), notes: 'Cash · Deposit', created_by: null, created_at: isoAt(9, 10, -14) },
  { id: 'pay-2', order_id: 'ord-1', amount: 3000, payment_date: dateAt(0), notes: 'GCash · Balance on pickup', created_by: null, created_at: isoAt(9, 42) },
  { id: 'pay-3', order_id: 'ord-2', amount: 2500, payment_date: dateAt(0), notes: 'Cash · Deposit', created_by: null, created_at: isoAt(10, 15) },
  { id: 'pay-4', order_id: 'ord-3', amount: 1800, payment_date: dateAt(-8), notes: 'Maya · Paid in full', created_by: null, created_at: isoAt(11, 10, -8) },
  { id: 'pay-5', order_id: 'ord-4', amount: 2400, payment_date: dateAt(-6), notes: 'Bank Transfer · Paid in full', created_by: null, created_at: isoAt(14, 10, -6) },
  { id: 'pay-6', order_id: 'ord-5', amount: 1950, payment_date: dateAt(0), notes: 'Cash · Paid in full', created_by: null, created_at: isoAt(9, 30) },
  { id: 'pay-7', order_id: 'ord-6', amount: 4000, payment_date: dateAt(-1), notes: 'GCash · Deposit', created_by: null, created_at: isoAt(8, 40, -1) },
  { id: 'pay-8', order_id: 'ord-7', amount: 850, payment_date: dateAt(0), notes: 'Cash · Balance on pickup', created_by: null, created_at: isoAt(13, 0, 0) },
  { id: 'pay-9', order_id: 'ord-8', amount: 1500, payment_date: dateAt(0), notes: 'Maya · Balance payment', created_by: null, created_at: isoAt(11, 3) },
]

function seedMonthPayments() {
  // Backfill earlier months so the Sales & Expenses year view is not empty.
  const rows = []
  const year = now.getFullYear()

  for (let month = 0; month < 6; month += 1) {
    const { from } = monthBounds(year, month)
    const base = 48_000 + month * 6_500
    rows.push(
      { id: `pay-seed-${month}-a`, order_id: 'ord-seed-a', amount: base, payment_date: from, notes: 'Cash · Paid in full', created_by: null, created_at: `${from}T12:00:00.000Z` },
      { id: `pay-seed-${month}-b`, order_id: 'ord-seed-b', amount: Math.round(base * 0.35), payment_date: from, notes: 'Bank Transfer · Paid in full', created_by: null, created_at: `${from}T15:00:00.000Z` },
    )
  }

  return rows
}

export const DEMO_ALL_PAYMENTS = [...DEMO_PAYMENTS, ...seedMonthPayments()]

export const DEMO_EXPENSES = [
  { id: 'exp-1', expense_date: dateAt(0), category: 'Electricity', amount: 2350, description: 'Meralco — month to date', created_by: null, created_at: isoAt(8, 0) },
  { id: 'exp-2', expense_date: dateAt(0), category: 'Supplier', amount: 1800, description: 'Frames restock — Asian Optical', created_by: null, created_at: isoAt(8, 30) },
  { id: 'exp-3', expense_date: dateAt(0), category: 'Optician', amount: 4500, description: 'Lab fee — in-progress orders', created_by: null, created_at: isoAt(9, 0) },
  { id: 'exp-4', expense_date: dateAt(-1), category: 'Rent', amount: 25_000, description: 'Clinic rent', created_by: null, created_at: isoAt(8, 0, -1) },
  { id: 'exp-5', expense_date: dateAt(-2), category: 'Opto', amount: 3200, description: 'Slit lamp supplies', created_by: null, created_at: isoAt(8, 0, -2) },
  { id: 'exp-6', expense_date: dateAt(-3), category: 'Sales Associate', amount: 12_000, description: 'Associate commission', created_by: null, created_at: isoAt(8, 0, -3) },
  { id: 'exp-7', expense_date: dateAt(-5), category: 'Water', amount: 890, description: 'Water bill', created_by: null, created_at: isoAt(8, 0, -5) },
  { id: 'exp-8', expense_date: dateAt(-7), category: 'Supplier', amount: 6_400, description: 'Lens stock order', created_by: null, created_at: isoAt(8, 0, -7) },
  { id: 'exp-9', expense_date: dateAt(-9), category: 'Other', amount: 1_250, description: 'Clinic cleaning supplies', created_by: null, created_at: isoAt(8, 0, -9) },
  { id: 'exp-10', expense_date: dateAt(-12), category: 'Electricity', amount: 2_640, description: 'Meralco', created_by: null, created_at: isoAt(8, 0, -12) },
  { id: 'exp-11', expense_date: dateAt(-20), category: 'Optician', amount: 5_100, description: 'Lab fees', created_by: null, created_at: isoAt(8, 0, -20) },
  { id: 'exp-12', expense_date: dateAt(-34), category: 'Rent', amount: 25_000, description: 'Clinic rent', created_by: null, created_at: isoAt(8, 0, -34) },
]

/** Mirrors the `paid` / `balance` derivation used against the real database. */
export function deriveOrderTotals(order, payments) {
  const mine = payments.filter((payment) => payment.order_id === order.id)
  const paid = toAmount(
    mine.reduce((sum, payment) => sum + Number(payment.amount), 0),
  )
  const balance = toAmount(Number(order.total_amount) - paid)
  return { payments: mine, paid, balance }
}
