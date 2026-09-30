import { IS_SUPABASE_CONFIGURED } from '@/lib/constants'
import { supabase, unwrap } from '@/lib/supabase'
import { toAppError } from '@/utils/errors'

function blank(value) {
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function prescriptionPayload(visitId, input) {
  return {
    visit_id: visitId,
    od_sph: blank(input.od_sph),
    od_cyl: blank(input.od_cyl),
    od_axis: blank(input.od_axis),
    od_add: blank(input.od_add),
    od_pd: blank(input.od_pd),
    os_sph: blank(input.os_sph),
    os_cyl: blank(input.os_cyl),
    os_axis: blank(input.os_axis),
    os_add: blank(input.os_add),
    os_pd: blank(input.os_pd),
  }
}

/** True when at least one prescription cell was filled in. */
export function hasPrescription(input) {
  return Object.values(input).some((value) => value.trim().length > 0)
}

export async function createVisit(input) {
  const visitPayload = {
    patient_id: input.patient_id,
    visit_date: input.visit_date,
    notes: blank(input.notes),
  }

  if (!IS_SUPABASE_CONFIGURED) {
    const { DEMO_PRESCRIPTIONS, DEMO_VISITS } = await import('@/lib/demo-data')
    const visit = {
      id: `vis-${DEMO_VISITS.length + 1}`,
      ...visitPayload,
      created_by: null,
      created_at: new Date().toISOString(),
    }
    // The visit is always recorded, even without a prescription.
    DEMO_VISITS.push(visit)
    if (input.prescription) {
      DEMO_PRESCRIPTIONS.push({
        id: `pre-${DEMO_PRESCRIPTIONS.length + 1}`,
        ...prescriptionPayload(visit.id, input.prescription),
        created_at: new Date().toISOString(),
      })
    }
    return visit
  }

  try {
    const visit = unwrap(
      await supabase.from('visits').insert(visitPayload).select('*').single(),
    )

    if (input.prescription) {
      try {
        await supabase
          .from('prescriptions')
          .insert(prescriptionPayload(visit.id, input.prescription))
      } catch (prescriptionError) {
        // The visit must not be left without its prescription — roll it back so
        // the two records stay consistent.
        await supabase.from('visits').delete().eq('id', visit.id)
        throw prescriptionError
      }
    }

    return visit
  } catch (caught) {
    throw toAppError(caught, 'saveVisit')
  }
}

/** The prescription attached to one visit, or null when the visit has none. */
export async function getPrescriptionForVisit(visitId) {
  if (!visitId) return null

  if (!IS_SUPABASE_CONFIGURED) {
    const { DEMO_PRESCRIPTIONS } = await import('@/lib/demo-data')
    return DEMO_PRESCRIPTIONS.find((row) => row.visit_id === visitId) ?? null
  }

  const result = await supabase
    .from('prescriptions')
    .select('*')
    .eq('visit_id', visitId)
    .maybeSingle()

  if (result.error) throw toAppError(result.error, 'loadVisits')
  return result.data ?? null
}

export async function getLatestPrescription(patientId) {
  if (!IS_SUPABASE_CONFIGURED) {
    const { DEMO_PRESCRIPTIONS, DEMO_VISITS } = await import('@/lib/demo-data')
    const visit = DEMO_VISITS.filter((row) => row.patient_id === patientId).sort(
      (a, b) => Date.parse(b.visit_date) - Date.parse(a.visit_date),
    )[0]
    if (!visit) return null
    return DEMO_PRESCRIPTIONS.find((row) => row.visit_id === visit.id) ?? null
  }

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
    await supabase.from('prescriptions').select('*').eq('visit_id', visitId).limit(1),
  )
  return rows[0] ?? null
}
