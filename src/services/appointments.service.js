import {
  createAppointment as createAppointmentRecord,
  listAppointments as listAppointmentRecords,
  updateAppointment as updateAppointmentRecord,
} from '@/lib/appointments'
import { toDateKey } from '@/utils/dates'
import {
  APPOINTMENT_STATUS,
  APPOINTMENT_STATUS_LIST,
  normalizeAppointmentStatus,
} from '@/lib/appointment-status'

export { APPOINTMENT_STATUS, APPOINTMENT_STATUS_LIST }

const APPOINTMENT_TYPE_VALUES = [
  'Consultation',
  'Follow Up',
  'Eye Exam',
  'Contact Lens Fitting',
  'Procedure',
]

function normaliseStatus(status) {
  return normalizeAppointmentStatus(status)
}

function normaliseType(type) {
  return APPOINTMENT_TYPE_VALUES.includes(type) ? type : 'Consultation'
}

function normaliseAppointment(input) {
  const patientId = String(input.patient_id ?? '').trim()
  const appointmentDate = String(input.appointment_date ?? '').trim()
  const appointmentTime = String(input.appointment_time ?? '').trim()
  const startAt = String(input.start_at ?? '').trim() || (
    appointmentDate && appointmentTime
      ? new Date(`${appointmentDate}T${appointmentTime}`).toISOString()
      : ''
  )
  const durationMinutes = Number(input.duration_minutes ?? 30)

  if (!patientId) {
    throw new Error('Choose a patient before saving the appointment.')
  }
  if (!startAt) {
    throw new Error('Select an appointment date and time.')
  }
  if (!Number.isFinite(durationMinutes) || durationMinutes <= 0) {
    throw new Error('Duration must be greater than zero minutes.')
  }

  return {
    patient_id: patientId,
    start_at: startAt,
    duration_minutes: Math.round(durationMinutes),
    type: normaliseType(input.type ?? input.appointment_type),
    status: normaliseStatus(input.status),
    notes: (input.notes ?? '').trim() || null,
  }
}

function mapAppointment(row) {
  if (!row) return row

  const startAt = new Date(row.start_at)
  return {
    ...row,
    appointment_date: toDateKey(startAt),
    appointment_time: `${String(startAt.getHours()).padStart(2, '0')}:${String(startAt.getMinutes()).padStart(2, '0')}:00`,
    appointment_type: row.type,
    patient: row.patient ?? null,
    patient_name: row.patient_name ?? row.patient?.full_name ?? 'Unknown patient',
  }
}

export async function listAppointments(filters) {
  const rows = await listAppointmentRecords(filters)
  return rows.map(mapAppointment)
}

export async function createAppointment(input) {
  const payload = normaliseAppointment(input)
  return mapAppointment(await createAppointmentRecord(payload))
}

export async function updateAppointmentStatus(appointmentId, nextStatus) {
  const status = normaliseStatus(nextStatus)
  return mapAppointment(await updateAppointmentRecord(appointmentId, { status }))
}
