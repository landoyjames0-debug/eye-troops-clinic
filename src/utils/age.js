/**
 * Age utility helpers for Eye Troops Optical Clinic.
 *
 * Two sources of truth:
 *  - date_of_birth (date string "YYYY-MM-DD") → always wins; age is computed
 *    fresh so it stays correct year-over-year.
 *  - age (integer) → manual fallback used only when date_of_birth is absent.
 */

/**
 * Compute age in complete years from a date-of-birth string "YYYY-MM-DD".
 * Returns null for falsy or unparseable inputs.
 *
 * Accurate to the day: a person born on Oct 11 is still N-1 on Oct 10.
 */
export function computeAgeFromDob(dob) {
  if (!dob) return null
  const [y, m, d] = String(dob).split('-').map(Number)
  if (!y || !m || !d) return null

  const today = new Date()
  let age = today.getFullYear() - y
  const hadBirthday =
    today.getMonth() + 1 > m ||
    (today.getMonth() + 1 === m && today.getDate() >= d)
  if (!hadBirthday) age -= 1
  return age < 0 ? 0 : age
}

/**
 * Returns the display-ready age for a patient record.
 *
 * - If `date_of_birth` is set, always compute fresh so the number stays
 *   correct over the years without any DB updates.
 * - If only `age` is present (manual entry), return that value.
 * - Otherwise return null.
 *
 * @param {{ date_of_birth?: string|null, age?: number|null }} patient
 * @returns {number|null}
 */
export function resolveAge(patient) {
  if (patient?.date_of_birth) return computeAgeFromDob(patient.date_of_birth)
  if (typeof patient?.age === 'number' && Number.isFinite(patient.age)) return patient.age
  return null
}

/**
 * Format the resolved age for display.
 * Returns "—" when neither source is available.
 *
 * @param {{ date_of_birth?: string|null, age?: number|null }} patient
 * @param {{ unit?: boolean }} [options]
 * @returns {string}
 */
export function formatAge(patient, { unit = false } = {}) {
  const age = resolveAge(patient)
  if (age === null) return '—'
  return unit ? `${age} yrs` : `${age}`
}
