import { supabase, unwrap } from '@/lib/supabase'
import { toAppError } from '@/utils/errors'
import { APPOINTMENT_STATUS, normalizeAppointmentStatus } from '@/lib/appointment-status'

const APPOINTMENT_COLUMNS = [
  'id',
  'patient_id',
  'start_at',
  'duration_minutes',
  'type',
  'status',
  'notes',
  'patients(full_name, cp_number)',
].join(', ')

function mapAppointment(row) {
  if (!row) return row
  const patient = row.patients ?? null
  return {
    ...row,
    patient,
    patient_name: patient?.full_name ?? 'Unknown patient',
    patient_cp_number: patient?.cp_number ?? null,
  }
}

function toPayload(input, withDefaults = false) {
  const payload = {}
  if ('patient_id' in input) payload.patient_id = input.patient_id
  if ('start_at' in input) payload.start_at = input.start_at
  if ('duration_minutes' in input) payload.duration_minutes = Number(input.duration_minutes)
  if ('type' in input) payload.type = input.type
  if ('status' in input) payload.status = normalizeAppointmentStatus(input.status)
  else if (withDefaults) payload.status = APPOINTMENT_STATUS.SCHEDULED
  if ('notes' in input) payload.notes = String(input.notes ?? '').trim() || null
  return payload
}

export async function listAppointments({ from, to, status } = {}) {
  try {
    let query = supabase.from('appointments').select(APPOINTMENT_COLUMNS)
    if (from) query = query.gte('start_at', from)
    if (to) query = query.lt('start_at', to)
    if (status) query = query.eq('status', status)

    const rows = unwrap(await query.order('start_at', { ascending: true }))
    return rows.map(mapAppointment)
  } catch (caught) {
    throw toAppError(caught, 'loadAppointments')
  }
}

export async function findOverlappingAppointment({ start_at, duration_minutes, exclude_id }) {
  try {
    const startMs = Date.parse(start_at)
    if (!Number.isFinite(startMs)) throw new Error('Invalid appointment start time.')
    const endAt = new Date(startMs + Number(duration_minutes) * 60_000).toISOString()

    let query = supabase
      .from('appointments')
      .select(APPOINTMENT_COLUMNS)
      .lt('start_at', endAt)
      .not('status', 'in', `(${APPOINTMENT_STATUS.CANCELLED},Cancelled)`)
    if (exclude_id) query = query.neq('id', exclude_id)

    const candidates = unwrap(
      await query.order('start_at', { ascending: false }).limit(1000),
    )
    return candidates
      .map(mapAppointment)
      .find((appointment) => {
        if (normalizeAppointmentStatus(appointment.status) === APPOINTMENT_STATUS.CANCELLED) return false
        const otherStart = Date.parse(appointment.start_at)
        const otherEnd = otherStart + Number(appointment.duration_minutes) * 60_000
        return otherStart < startMs + Number(duration_minutes) * 60_000 && otherEnd > startMs
      }) ?? null
  } catch (caught) {
    throw toAppError(caught, 'loadAppointments')
  }
}

export async function createAppointment(input) {
  try {
    const result = await supabase
      .from('appointments')
      .insert(toPayload(input, true))
      .select(APPOINTMENT_COLUMNS)
      .single()
    return mapAppointment(unwrap(result))
  } catch (caught) {
    throw toAppError(caught, 'saveAppointment')
  }
}

export async function updateAppointment(appointmentId, input) {
  try {
    const result = await supabase
      .from('appointments')
      .update(toPayload(input))
      .eq('id', appointmentId)
      .select(APPOINTMENT_COLUMNS)
      .single()
    return mapAppointment(unwrap(result))
  } catch (caught) {
    throw toAppError(caught, 'updateAppointment')
  }
}

export async function cancelAppointment(appointmentId) {
  try {
    const result = await supabase
      .from('appointments')
      .update({ status: APPOINTMENT_STATUS.CANCELLED })
      .eq('id', appointmentId)
      .select(APPOINTMENT_COLUMNS)
      .single()
    return mapAppointment(unwrap(result))
  } catch (caught) {
    throw toAppError(caught, 'cancelAppointment')
  }
}

export async function deleteAppointment(appointmentId) {
  try {
    const { error } = await supabase.rpc('delete_appointment', {
      p_appointment_id: appointmentId,
    })
    if (error) throw error
  } catch (caught) {
    throw toAppError(caught, 'deleteAppointment')
  }
}