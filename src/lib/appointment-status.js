/**
 * Canonical appointment statuses matching the database check constraint:
 * check (status in ('scheduled', 'arrived', 'completed', 'no_show', 'cancelled'))
 */

export const APPOINTMENT_STATUS = Object.freeze({
  SCHEDULED: 'scheduled',
  ARRIVED: 'arrived',
  COMPLETED: 'completed',
  NO_SHOW: 'no_show',
  CANCELLED: 'cancelled',
})

export const APPOINTMENT_STATUS_LIST = Object.freeze([
  APPOINTMENT_STATUS.SCHEDULED,
  APPOINTMENT_STATUS.ARRIVED,
  APPOINTMENT_STATUS.COMPLETED,
  APPOINTMENT_STATUS.NO_SHOW,
  APPOINTMENT_STATUS.CANCELLED,
])

export const APPOINTMENT_STATUS_META = Object.freeze({
  [APPOINTMENT_STATUS.SCHEDULED]: {
    value: 'scheduled',
    label: 'Scheduled',
    badgeVariant: 'neutral',
    tone: 'neutral',
  },
  [APPOINTMENT_STATUS.ARRIVED]: {
    value: 'arrived',
    label: 'Arrived',
    badgeVariant: 'warning',
    tone: 'warning',
  },
  [APPOINTMENT_STATUS.COMPLETED]: {
    value: 'completed',
    label: 'Completed',
    badgeVariant: 'success',
    tone: 'success',
  },
  [APPOINTMENT_STATUS.NO_SHOW]: {
    value: 'no_show',
    label: 'No-show',
    badgeVariant: 'neutral',
    tone: 'neutral',
  },
  [APPOINTMENT_STATUS.CANCELLED]: {
    value: 'cancelled',
    label: 'Cancelled',
    badgeVariant: 'error',
    tone: 'error',
  },
})

/**
 * Normalizes any appointment status string (including legacy values like
 * 'Checked In', 'No Show', 'Confirmed', 'Scheduled') into a canonical DB value.
 */
export function normalizeAppointmentStatus(status) {
  if (!status) return APPOINTMENT_STATUS.SCHEDULED
  const key = String(status).toLowerCase().trim().replace(/[-\s]+/g, '_')

  if (key === 'arrived' || key === 'checked_in' || key === 'check_in') {
    return APPOINTMENT_STATUS.ARRIVED
  }
  if (key === 'no_show' || key === 'noshow') {
    return APPOINTMENT_STATUS.NO_SHOW
  }
  if (key === 'completed' || key === 'done') {
    return APPOINTMENT_STATUS.COMPLETED
  }
  if (key === 'cancelled' || key === 'canceled') {
    return APPOINTMENT_STATUS.CANCELLED
  }
  if (key === 'scheduled' || key === 'confirmed' || key === 'pending') {
    return APPOINTMENT_STATUS.SCHEDULED
  }
  return APPOINTMENT_STATUS.SCHEDULED
}

export function getAppointmentStatusMeta(status) {
  const canonical = normalizeAppointmentStatus(status)
  return APPOINTMENT_STATUS_META[canonical] ?? APPOINTMENT_STATUS_META[APPOINTMENT_STATUS.SCHEDULED]
}

export function getAppointmentStatusLabel(status) {
  return getAppointmentStatusMeta(status).label
}

export function getAppointmentStatusBadge(status) {
  return getAppointmentStatusMeta(status).badgeVariant
}

export function isActiveAppointmentStatus(status) {
  const canonical = normalizeAppointmentStatus(status)
  return canonical === APPOINTMENT_STATUS.SCHEDULED || canonical === APPOINTMENT_STATUS.ARRIVED
}

export function isClosedAppointmentStatus(status) {
  const canonical = normalizeAppointmentStatus(status)
  return canonical === APPOINTMENT_STATUS.COMPLETED || canonical === APPOINTMENT_STATUS.CANCELLED
}
