import { supabase, unwrap } from '@/lib/supabase'
import { toAppError } from '@/utils/errors'
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

/** Most recent visit first, with its prescription attached. */
export async function listPatients(search = '') {
  try {
    let query = supabase.from('patients').select('*').is('archived_at', null)
    const term = search.trim()
    if (term) {
      query = query.or(`full_name.ilike.%${term}%,cp_number.ilike.%${term}%`)
    }
    const patients = unwrap(await query.order('full_name', { ascending: true }))

    const [visitsResult, prescriptionsResult, ordersResult, paymentsResult] = await Promise.all([
      supabase.from('visits').select('*'),
      supabase.from('prescriptions').select('*'),
      supabase.from('orders').select('*'),
      supabase.from('payments').select('*'),
    ])
    const allVisits = visitsResult.data ?? []
    const allPrescriptions = prescriptionsResult.data ?? []
    const allPayments = paymentsResult.data ?? []
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
        return { ...patient, last_visit: visitsForPatient[0] ?? null }
      })
  } catch (caught) {
    throw toAppError(caught, 'loadPatients')
  }
}

export async function getPatientDetail(patientId) {
  try {
    const patientResult = await supabase
      .from('patients')
      .select('*')
      .eq('id', patientId)
      .maybeSingle()

    if (patientResult.error) throw patientResult.error
    if (!patientResult.data) throw toAppError(new Error('not found'), 'notFound')
    const patient = patientResult.data

    const [visitsResult, prescriptionsResult, ordersResult, paymentsResult] = await Promise.all([
      supabase.from('visits').select('*').eq('patient_id', patientId),
      supabase.from('prescriptions').select('*'),
      supabase.from('orders').select('*').eq('patient_id', patientId),
      supabase.from('payments').select('*'),
    ])

    const visits = attachPrescriptions(
      visitsResult.data ?? [],
      prescriptionsResult.data ?? [],
      patientId,
    )
    const orders = (ordersResult.data ?? [])
      .map((order) => withTotals(order, paymentsResult.data ?? []))
      .sort((a, b) => Date.parse(b.order_date) - Date.parse(a.order_date))

    return { patient, visits, orders, balance: outstandingBalance(orders), lastVisit: visits[0] ?? null }
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
