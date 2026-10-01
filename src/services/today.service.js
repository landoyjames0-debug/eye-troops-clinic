import { supabase } from '@/lib/supabase'
import { toAppError } from '@/utils/errors'
import { endOfDayIso, startOfDayIso, toDateKey } from '@/utils/dates'

/** Visits scheduled for the clinic's current local day, earliest first. */
export async function listVisitsForToday(date = toDateKey()) {
  try {
    const visits = await supabase
      .from('visits')
      .select('*')
      .gte('visit_date', startOfDayIso(date))
      .lte('visit_date', endOfDayIso(date))
      .order('visit_date', { ascending: true })

    if (visits.error) throw visits.error
    const rows = visits.data ?? []
    if (rows.length === 0) return []

    const patients = await supabase
      .from('patients')
      .select('id, full_name, cp_number')
      .in(
        'id',
        rows.map((visit) => visit.patient_id),
      )

    if (patients.error) throw patients.error
    const patientById = new Map((patients.data ?? []).map((row) => [row.id, row]))

    return rows.map((visit) => {
      const patient = patientById.get(visit.patient_id)
      return {
        ...visit,
        patient_name: patient?.full_name ?? 'Unknown patient',
        cp_number: patient?.cp_number ?? null,
      }
    })
  } catch (caught) {
    throw toAppError(caught, 'loadVisits')
  }
}
