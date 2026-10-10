export const APP_NAME = 'Eye Troops'
export const APP_SUBTITLE = 'OPTICAL CLINIC'
export const CURRENCY_CODE = 'PHP'

/** Official clinic artwork, served from /public. */
export const LOGO_PATH = '/eye-troops-logo.png'

export const ORDER_NUMBER_PREFIX = 'ET-'

export const ORDER_STATUS = Object.freeze({
  ORDERED: 'ORDERED',
  IN_LAB: 'IN_LAB',
  READY_FOR_PICKUP: 'READY_FOR_PICKUP',
  CLAIMED: 'CLAIMED',
  CANCELLED: 'CANCELLED',
})

/**
 * Order lifecycle. These strings are the values stored in the database's
 * `order_status` enum — keep them in sync with the SQL migration.
 *
 * `ORDER_STATUS_META` is the forward workflow only (what the status stepper
 * shows). `CANCELLED` is a terminal side-state, so it is listed separately and
 * offered as a filter instead of a step.
 */
export const ORDER_STATUS_META = [
  { value: ORDER_STATUS.ORDERED, label: 'Ordered', description: 'Order placed, not yet sent to the lab' },
  { value: ORDER_STATUS.IN_LAB, label: 'In Lab', description: 'Being fabricated' },
  { value: ORDER_STATUS.READY_FOR_PICKUP, label: 'Ready for Pickup', description: 'Finished and waiting for the patient' },
  { value: ORDER_STATUS.CLAIMED, label: 'Claimed', description: 'Collected by the patient' },
]

export const CANCELLED_STATUS = { value: ORDER_STATUS.CANCELLED, label: 'Cancelled', description: 'Cancelled and kept for reference' }

export const ORDER_STATUSES = ORDER_STATUS_META.map((meta) => meta.value)

/** Every status a filter or badge may show, workflow first then Cancelled. */
export const ORDER_STATUS_FILTERS = [...ORDER_STATUS_META, CANCELLED_STATUS]

export const PAYMENT_STATUS_META = [
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'VOIDED', label: 'Voided' },
  { value: 'REFUNDED', label: 'Refunded' },
]

export const EXPENSE_CATEGORIES = [
  'Rent',
  'Electricity',
  'Water',
  'Opto',
  'Sales Associate',
  'Optician',
  'Supplier',
  'Other',
]

/** Item kinds that can appear on an optical order. */
export const ORDER_ITEM_TYPES = ['Glasses', 'Contact Lens', 'Services']

export const LENS_TYPES = [
  'Single Vision',
  'Bifocal',
  'Progressive',
  'Photochromic',
  'Blue-light Filter',
  'Not applicable',
]

/** Prescription lens designs for a pair of glasses. */
export const LENS_TYPE_OPTIONS = [
  'Single Vision',
  'Bifocal',
  'Progressive',
  'Not applicable',
]

/** Coatings / treatments that can be added to a glasses lens. */
export const LENS_COATING_OPTIONS = [
  'Photochromic',
  'Blue-light Filter',
  'Not applicable',
]

export const PAYMENT_METHODS = ['Cash', 'GCash', 'Maya', 'Bank Transfer', 'Other']

/** Default rows per page for roster tables (Patients, Orders, Sales & Expenses). */
export const TABLE_PAGE_SIZE = 4

/**
 * `payments` has no `method` column and `orders` has no item columns, so these
 * values are serialised into the existing free-text fields: the payment method
 * into `payments.notes` and each line item into `orders.description`.
 */
export function describeOrderItems(items) {
  return items
    .map((item) => {
      const parts = [item.name?.trim() || item.type]
      if (item.lensType && item.lensType !== 'Not applicable') parts.push(item.lensType)
      if (item.lensOption && item.lensOption !== 'Not applicable') parts.push(item.lensOption)
      return `${parts.join(' · ')} (${item.quantity} × ₱${Number(item.unitPrice).toFixed(2)})`
    })
    .join(', ')
}

export function describePayment(method, paymentType) {
  return `${method} · ${paymentType}`
}

/**
 * The payment method lives at the head of the free-text note (`"GCash · Deposit"`).
 * Legacy rows without a recognisable method return `null` and surface the whole
 * note unchanged, so nothing is lost for older records.
 */
export function paymentMethodOf(payment) {
  const notes = payment?.notes ?? ''
  const [first] = notes.split(' · ')
  return PAYMENT_METHODS.includes(first) ? first : null
}

export function paymentNoteOf(payment) {
  const notes = payment?.notes ?? ''
  if (!notes) return null
  const [first, ...rest] = notes.split(' · ')
  if (!PAYMENT_METHODS.includes(first)) return notes
  return rest.join(' · ') || null
}
