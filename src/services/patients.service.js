import { supabase, unwrap } from '@/lib/supabase'
import { toAppError } from '@/utils/errors'
import { toDateKey } from '@/utils/dates'
import { isClosedAppointmentStatus } from '@/lib/appointment-status'
import { outstandingBalance, withTotals } from './orders.service'

function toNullIfBlank(value) {
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

/**
 * `cp_number` holds the patient's mobile number, and the schema has no separate
 * clinic-record column. The CP label shown in the UI is therefore derived from
 * the patient's stable position in the full roster, so it never shifts when a
 * search filter is applied.
 */
export function cpLabel(index) {
  return `CP-${String(index + 1).padStart(4, '0')}`
}

/** Joins visits + prescriptions in JS so the query never relies on inferred relations. */
function attachPrescriptions(visits, prescriptions, patientId) {
  const visitsForPatient = visits
    .filter((visit) => visit.patient_id === patientId)
    .sort((a, b) => Date.parse(b.visit_date) - Date.parse(a.visit_date))

  return visitsForPatient.map((visit) => ({
    ...visit,
    prescriptions: prescriptions.filter((row) => row.visit_id === visit.id),
  }))
}

function appointmentTimestamp(appointment) {
  if (!appointment?.start_at) return null
  const timestamp = new Date(appointment.start_at)
  return Number.isNaN(timestamp.getTime()) ? null : timestamp
}

function withLegacyAppointmentFields(appointment) {
  const timestamp = appointmentTimestamp(appointment)
  if (!timestamp) return appointment
  return {
    ...appointment,
    appointment_date: toDateKey(timestamp),
    appointment_time: `${String(timestamp.getHours()).padStart(2, '0')}:${String(timestamp.getMinutes()).padStart(2, '0')}:00`,
    appointment_type: appointment.type,
  }
}

function nextFollowUpForPatient(patientId, appointments) {
  const rows = (appointments ?? [])
    .filter((item) => item.patient_id === patientId && item.type === 'Follow Up')
    .map((item) => ({
      ...item,
      timestamp: appointmentTimestamp(item),
    }))
    .filter((item) => item.timestamp)
    .sort((left, right) => left.timestamp.getTime() - right.timestamp.getTime())

  if (rows.length === 0) return null

  const upcoming = rows.filter(
    (item) => !isClosedAppointmentStatus(item.status) && item.timestamp.getTime() >= Date.now(),
  )

  const next = (upcoming[0] ?? rows[rows.length - 1]) ?? null
  return next ? withLegacyAppointmentFields(next) : null
}

export async function listPatientRoster(search = '') {
  try {
    let query = supabase
      .from('patients')
      .select('id, full_name, cp_number, address, date_of_birth, age')
      .is('archived_at', null)
    const term = search.trim()
    if (term) {
      query = query.or(`full_name.ilike.%${term}%,cp_number.ilike.%${term}%`)
    }
    const rows = unwrap(await query.order('full_name', { ascending: true }))
    return rows.map((patient, index) => ({
      ...patient,
      cp_label: cpLabel(index),
    }))
  } catch (caught) {
    throw toAppError(caught, 'loadPatients')
  }
}

/** Most recent visit first, with its prescription attached. */
export async function listPatients(search = '') {
  try {
    let query = supabase
      .from('patients')
      .select('id, full_name, cp_number, address, notes, date_of_birth, age, created_at, updated_at')
      .is('archived_at', null)
    const term = search.trim()
    if (term) {
      query = query.or(`full_name.ilike.%${term}%,cp_number.ilike.%${term}%`)
    }
    const patients = unwrap(await query.order('full_name', { ascending: true }))

    const [visitsResult, prescriptionsResult, ordersResult, paymentsResult, appointmentsResult] = await Promise.all([
      supabase.from('visits').select('id, patient_id, visit_date, notes'),
      supabase.from('prescriptions').select('id, visit_id'),
      supabase.from('orders').select('id, patient_id, total_amount, status, order_date'),
      supabase.from('payments').select('id, order_id, amount, status'),
      supabase.from('appointments').select('id, patient_id, start_at, duration_minutes, type, status'),
    ])
    const allVisits = visitsResult.data ?? []
    const allPrescriptions = prescriptionsResult.data ?? []
    const allPayments = paymentsResult.data ?? []
    const allAppointments = appointmentsResult.data ?? []
    const allOrders = (ordersResult.data ?? []).map((order) =>
      withTotals(order, allPayments),
    )

    return patients
      .map((patient, index) => {
        const orders = allOrders.filter((order) => order.patient_id === patient.id)
        return {
          ...patient,
          cp_label: cpLabel(index),
          balance: outstandingBalance(orders),
          orders,
        }
      })
      .filter((patient) => {
        if (!term) return true
        const needle = term.toLowerCase()
        return (
          patient.full_name.toLowerCase().includes(needle) ||
          (patient.cp_number ?? '').toLowerCase().includes(needle) ||
          patient.cp_label.toLowerCase().includes(needle)
        )
      })
      .map((patient) => {
        const visitsForPatient = attachPrescriptions(
          allVisits,
          allPrescriptions,
          patient.id,
        )
        const nextFollowUp = nextFollowUpForPatient(patient.id, allAppointments)
        return { ...patient, last_visit: visitsForPatient[0] ?? null, next_follow_up: nextFollowUp }
      })
  } catch (caught) {
    throw toAppError(caught, 'loadPatients')
  }
}

export async function getPatientDetail(patientId) {
  try {
    const patientResult = await supabase
      .from('patients')
      .select('id, full_name, cp_number, address, notes, date_of_birth, age, created_at, updated_at')
      .eq('id', patientId)
      .maybeSingle()

    if (patientResult.error) throw patientResult.error
    if (!patientResult.data) throw toAppError(new Error('not found'), 'notFound')
    const patient = patientResult.data

    const [visitsResult, ordersResult, appointmentsResult] = await Promise.all([
      supabase
        .from('visits')
        .select('id, patient_id, visit_date, notes, created_at')
        .eq('patient_id', patientId),
      supabase
        .from('orders')
        .select('id, order_number, patient_id, visit_id, description, total_amount, status, order_date, created_at')
        .eq('patient_id', patientId),
      supabase
        .from('appointments')
        .select('id, patient_id, start_at, duration_minutes, type, status, notes')
        .eq('patient_id', patientId),
    ])

    const patientVisits = visitsResult.data ?? []
    const patientOrders = ordersResult.data ?? []
    const visitIds = patientVisits.map((v) => v.id)
    const orderIds = patientOrders.map((o) => o.id)

    const [prescriptionsResult, paymentsResult] = await Promise.all([
      visitIds.length > 0
        ? supabase
            .from('prescriptions')
            .select('id, visit_id, od_sph, od_cyl, od_axis, od_add, od_pd, os_sph, os_cyl, os_axis, os_add, os_pd, created_at')
            .in('visit_id', visitIds)
        : Promise.resolve({ data: [] }),
      orderIds.length > 0
        ? supabase
            .from('payments')
            .select('id, order_id, amount, payment_date, notes, status, created_at')
            .in('order_id', orderIds)
        : Promise.resolve({ data: [] }),
    ])

    const visits = attachPrescriptions(
      patientVisits,
      prescriptionsResult.data ?? [],
      patientId,
    )
    const appointments = (appointmentsResult.data ?? []).map(withLegacyAppointmentFields).sort((a, b) => {
      const left = appointmentTimestamp(a)?.getTime() ?? 0
      const right = appointmentTimestamp(b)?.getTime() ?? 0
      return left - right
    })
    const orders = patientOrders
      .map((order) => withTotals(order, paymentsResult.data ?? []))
      .sort((a, b) => Date.parse(b.order_date) - Date.parse(a.order_date))

    return {
      patient,
      visits,
      orders,
      appointments,
      balance: outstandingBalance(orders),
      lastVisit: visits[0] ?? null,
      nextFollowUp: nextFollowUpForPatient(patientId, appointments),
    }
  } catch (caught) {
    throw toAppError(caught, 'loadVisits')
  }
}

export async function createPatient(input) {
  const payload = {
    full_name: input.full_name.trim(),
    cp_number: toNullIfBlank(input.cp_number),
    address: toNullIfBlank(input.address),
    notes: toNullIfBlank(input.notes),
    date_of_birth: input.date_of_birth || null,
    age: input.date_of_birth
      ? null
      : (input.age != null && input.age !== '' ? Number(input.age) : null),
  }

  try {
    return unwrap(await supabase.from('patients').insert(payload).select('*').single())
  } catch (caught) {
    throw toAppError(caught, 'savePatient')
  }
}

export async function updatePatient(patientId, input) {
  const payload = {
    full_name: input.full_name.trim(),
    cp_number: toNullIfBlank(input.cp_number),
    address: toNullIfBlank(input.address),
    notes: toNullIfBlank(input.notes),
    date_of_birth: input.date_of_birth || null,
    age: input.date_of_birth
      ? null
      : (input.age != null && input.age !== '' ? Number(input.age) : null),
  }

  try {
    return unwrap(
      await supabase.from('patients').update(payload).eq('id', patientId).select('*').single(),
    )
  } catch (caught) {
    throw toAppError(caught, 'updatePatient')
  }
}

/**
 * Archiving hides a patient from the roster without touching their orders,
 * payments or prescriptions — the financial history must stay intact.
 */
export async function archivePatient(patientId) {
  const stamp = new Date().toISOString()

  try {
    return unwrap(
      await supabase
        .from('patients')
        .update({ archived_at: stamp })
        .eq('id', patientId)
        .select('*')
        .single(),
    )
  } catch (caught) {
    throw toAppError(caught, 'deletePatient')
  }
}

/**
 * Case-insensitive mobile lookup used to warn before a duplicate record is
 * created. Blank numbers never match — two patients may both omit a number.
 */
export async function findPatientByMobile(cpNumber) {
  const needle = (cpNumber ?? '').trim().toLowerCase()
  if (!needle) return null

  try {
    const { data, error } = await supabase
      .from('patients')
      .select('*')
      .is('archived_at', null)
      .ilike('cp_number', needle)
      .limit(1)
    if (error) throw error
    return data?.[0] ?? null
  } catch (caught) {
    throw toAppError(caught, 'loadPatients')
  }
}
