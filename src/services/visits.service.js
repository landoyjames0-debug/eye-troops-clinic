import { supabase, unwrap } from '@/lib/supabase'
import { toAppError } from '@/utils/errors'

/** True when at least one prescription cell was filled in. */
export function hasPrescription(input) {
  return Object.values(input).some((value) => value.trim().length > 0)
}

export async function createVisitOrderTransaction(input) {
  try {
    return unwrap(await supabase.rpc('create_visit_order_transaction', {
      p_patient_id: input.patient_id ?? null,
      p_new_patient: input.new_patient ?? null,
      p_visit_date: input.visit_date,
      p_visit_notes: input.notes,
      p_prescription: input.prescription,
      p_description: input.description,
      p_total_amount: input.total_amount,
      p_order_date: input.order_date,
      p_initial_payment: input.initial_payment,
      p_payment_date: input.payment_date,
      p_payment_notes: input.payment_notes,
      p_idempotency_key: input.idempotency_key,
    }))
  } catch (caught) {
    throw toAppError(caught, 'saveVisit')
  }
}

const PRESCRIPTION_COLUMNS = 'id, visit_id, od_sph, od_cyl, od_axis, od_add, od_pd, os_sph, os_cyl, os_axis, os_add, os_pd, created_at'

/** The prescription attached to one visit, or null when the visit has none. */
export async function getPrescriptionForVisit(visitId) {
  if (!visitId) return null

  const result = await supabase
    .from('prescriptions')
    .select(PRESCRIPTION_COLUMNS)
    .eq('visit_id', visitId)
    .maybeSingle()

  if (result.error) throw toAppError(result.error, 'loadVisits')
  return result.data ?? null
}

export async function getLatestPrescription(patientId) {
  const visits = unwrap(
    await supabase
      .from('visits')
      .select('id')
      .eq('patient_id', patientId)
      .order('visit_date', { ascending: false })
      .limit(1),
  )
  const visitId = visits[0]?.id
  if (!visitId) return null

  const rows = unwrap(
    await supabase.from('prescriptions').select(PRESCRIPTION_COLUMNS).eq('visit_id', visitId).limit(1),
  )
  return rows[0] ?? null
}
