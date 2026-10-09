import { strToU8, zipSync } from 'fflate'
import { supabase } from '@/lib/supabase'
import { toCsv } from '@/utils/csv'

const PAGE_SIZE = 1000

const TABLE_COLUMNS = {
  users: ['id', 'email', 'full_name', 'role', 'job_title', 'phone', 'created_at'],
  patients: [
    'id', 'full_name', 'cp_number', 'address', 'notes', 'archived_at', 'created_by',
    'updated_by', 'created_at', 'updated_at',
  ],
  visits: ['id', 'patient_id', 'visit_date', 'notes', 'created_by', 'updated_by', 'created_at', 'updated_at'],
  prescriptions: [
    'id', 'visit_id', 'od_sph', 'od_cyl', 'od_axis', 'od_add', 'od_pd', 'os_sph', 'os_cyl',
    'os_axis', 'os_add', 'os_pd', 'created_at',
  ],
  orders: [
    'id', 'order_number', 'patient_id', 'visit_id', 'description', 'total_amount', 'status',
    'order_date', 'created_by', 'updated_by', 'created_at', 'updated_at',
  ],
  payments: [
    'id', 'order_id', 'amount', 'payment_date', 'notes', 'status', 'voided_at', 'created_by',
    'updated_by', 'created_at', 'updated_at',
  ],
  order_status_history: ['id', 'order_id', 'status', 'changed_at', 'changed_by'],
  expenses: [
    'id', 'expense_date', 'category', 'amount', 'description', 'created_by', 'updated_by',
    'created_at', 'updated_at',
  ],
}

async function readTable(table) {
  const rows = []
  for (let start = 0; ; start += PAGE_SIZE) {
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .order('id', { ascending: true })
      .range(start, start + PAGE_SIZE - 1)
    if (error) throw error
    rows.push(...data)
    if (data.length < PAGE_SIZE) return rows
  }
}

export async function createDatabaseBackup() {
  if (!supabase) throw new Error('Supabase is not configured.')

  const entries = await Promise.all(
    Object.entries(TABLE_COLUMNS).map(async ([table, columns]) => {
      const rows = await readTable(table)
      const csvColumns = columns.map((key) => ({ key, header: key }))
      return [`${table}.csv`, strToU8(toCsv(rows, csvColumns))]
    }),
  )

  return zipSync(Object.fromEntries(entries), { level: 6 })
}