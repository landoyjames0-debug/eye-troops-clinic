import { supabase, unwrap } from '@/lib/supabase'
import { toAppError } from '@/utils/errors'
import { addDays, toDateKey } from '@/utils/dates'

const QUEUE_COLUMNS = [
  'id',
  'patient_id',
  'order_id',
  'appointment_id',
  'reason',
  'due_date',
  'status',
  'snoozed_until',
  'notes',
  'created_by',
  'created_at',
  'completed_at',
  'patient_name',
  'patient_phone',
  'is_auto',
].join(', ')

const RECORD_COLUMNS = [
  'id',
  'patient_id',
  'order_id',
  'appointment_id',
  'reason',
  'due_date',
  'status',
  'snoozed_until',
  'notes',
  'created_by',
  'created_at',
  'completed_at',
  'patients(full_name, cp_number)',
].join(', ')

function weekEnd() {
  const today = new Date()
  const daysUntilSunday = today.getDay() === 0 ? 0 : 7 - today.getDay()
  return toDateKey(addDays(today, daysUntilSunday))
}

function applyFilter(query, filter, today) {
  if (filter === 'overdue') return query.lt('due_date', today)
  if (filter === 'today') return query.eq('due_date', today)
  if (filter === 'this-week') return query.gte('due_date', today).lte('due_date', weekEnd())
  return query
}

function mapRecord(row) {
  if (!row) return row
  return {
    ...row,
    patient: row.patients ?? null,
    patient_name: row.patients?.full_name ?? 'Unknown patient',
    patient_phone: row.patients?.cp_number ?? null,
  }
}

export async function listFollowups({ filter = 'all', limit = 5 } = {}) {
  try {
    const today = toDateKey()
    let query = applyFilter(
      supabase.from('followup_queue').select(QUEUE_COLUMNS).eq('status', 'open'),
      filter,
      today,
    )
    query = query.order('due_date', { ascending: true }).order('patient_name', { ascending: true })
    if (limit !== null) query = query.limit(limit)
    return unwrap(await query)
  } catch (caught) {
    throw toAppError(caught, 'loadFollowups')
  }
}

async function countFor(filter) {
  const today = toDateKey()
  const result = await applyFilter(
    supabase.from('followup_queue').select('id', { count: 'exact', head: true }).eq('status', 'open'),
    filter,
    today,
  )
  if (result.error) throw result.error
  return result.count ?? 0
}

export async function getFollowupCounts() {
  try {
    const [all, overdue, today, thisWeek] = await Promise.all([
      countFor('all'),
      countFor('overdue'),
      countFor('today'),
      countFor('this-week'),
    ])
    return { all, overdue, today, thisWeek }
  } catch (caught) {
    throw toAppError(caught, 'loadFollowups')
  }
}

export async function createFollowup(input) {
  try {
    const result = await supabase
      .from('followups')
      .insert({
        patient_id: input.patient_id,
        order_id: input.order_id || null,
        appointment_id: input.appointment_id || null,
        reason: input.reason,
        due_date: input.due_date,
        notes: input.notes?.trim() || null,
      })
      .select(RECORD_COLUMNS)
      .single()
    return mapRecord(unwrap(result))
  } catch (caught) {
    throw toAppError(caught, 'saveFollowup')
  }
}

async function saveAutoState(item, changes) {
  let lookup = supabase.from('followups').select('id')
  if (item.appointment_id) lookup = lookup.eq('appointment_id', item.appointment_id)
  else if (item.order_id) lookup = lookup.eq('order_id', item.order_id)
  else {
    lookup = lookup
      .eq('patient_id', item.patient_id)
      .eq('reason', item.reason)
      .eq('due_date', item.due_date)
      .is('appointment_id', null)
      .is('order_id', null)
  }

  const found = await lookup.limit(1).maybeSingle()
  if (found.error) throw found.error

  const input = {
    patient_id: item.patient_id,
    order_id: item.order_id || null,
    appointment_id: item.appointment_id || null,
    reason: item.reason,
    due_date: item.due_date,
    notes: item.notes ?? null,
    ...changes,
  }
  const result = found.data
    ? await supabase.from('followups').update(changes).eq('id', found.data.id).select(RECORD_COLUMNS).single()
    : await supabase.from('followups').insert(input).select(RECORD_COLUMNS).single()
  return mapRecord(unwrap(result))
}

export async function markDone(item) {
  try {
    const changes = { status: 'done', completed_at: new Date().toISOString(), snoozed_until: null }
    if (item.is_auto) return await saveAutoState(item, changes)
    const result = await supabase.from('followups').update(changes).eq('id', item.id).select(RECORD_COLUMNS).single()
    return mapRecord(unwrap(result))
  } catch (caught) {
    throw toAppError(caught, 'updateFollowup')
  }
}

export async function snooze(item, days) {
  try {
    const snoozedUntil = toDateKey(addDays(new Date(), days))
    const changes = { status: 'snoozed', snoozed_until: snoozedUntil, completed_at: null }
    if (item.is_auto) return await saveAutoState(item, changes)
    const result = await supabase.from('followups').update(changes).eq('id', item.id).select(RECORD_COLUMNS).single()
    return mapRecord(unwrap(result))
  } catch (caught) {
    throw toAppError(caught, 'updateFollowup')
  }
}