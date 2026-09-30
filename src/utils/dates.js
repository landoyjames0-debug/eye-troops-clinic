/**
 * All date keys are built in LOCAL time, never UTC — otherwise a visit at
 * 11:00 PM can land on the wrong day in the schedule and the ledger.
 */

export function addDays(date, days) {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

export function toDateKey(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value)
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

/** 'YYYY-MM-DD' -> 'YYYY-MM-DDT00:00:00.000' for timestamptz range queries. */
export function startOfDayIso(dateKey) {
  return `${dateKey}T00:00:00.000`
}

export function endOfDayIso(dateKey) {
  return `${dateKey}T23:59:59.999`
}

export function monthBounds(year, month) {
  const lastDay = new Date(year, month + 1, 0).getDate()
  const mm = String(month + 1).padStart(2, '0')
  return {
    from: `${year}-${mm}-01`,
    to: `${year}-${mm}-${String(lastDay).padStart(2, '0')}`,
  }
}

export function yearBounds(year) {
  return { from: `${year}-01-01`, to: `${year}-12-31` }
}

export function isSameDay(a, b) {
  return toDateKey(a) === toDateKey(b)
}

export function greetingFor(date = new Date()) {
  const hour = date.getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}

/** "2026-01-14T09:42" for <input type="datetime-local"> */
export function toInputDateTime(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value)
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  return `${toDateKey(date)}T${hours}:${minutes}`
}

export function toInputDate(value = new Date()) {
  return toDateKey(value)
}

/** Split a `datetime-local` string into date + 12-hour clock parts. */
export function parseInputDateTime(value) {
  const fallback = toInputDateTime()
  const source = value && value.includes('T') ? value : fallback
  const [date, time] = source.split('T')
  const [hoursStr, minutesStr] = time.split(':')
  const hours24 = parseInt(hoursStr, 10)
  const minutes = parseInt(minutesStr, 10)
  const ampm = hours24 >= 12 ? 'PM' : 'AM'
  let hour12 = hours24 % 12
  if (hour12 === 0) hour12 = 12
  return { date, hour12, minutes, ampm }
}

/** Build a `datetime-local` string from UI parts (12-hour clock). */
export function fromVisitDateTimeParts({ date, hour12, minutes, ampm }) {
  let hours24
  if (ampm === 'AM') {
    hours24 = hour12 === 12 ? 0 : hour12
  } else {
    hours24 = hour12 === 12 ? 12 : hour12 + 12
  }
  const h = String(hours24).padStart(2, '0')
  const m = String(minutes).padStart(2, '0')
  return `${date}T${h}:${m}`
}

/** Rounds to 2dp so peso maths never drifts (0.1 + 0.2 style bugs). */
export function toAmount(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100
}
