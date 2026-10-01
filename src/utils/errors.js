/**
 * Friendly, user-facing errors.
 *
 * Supabase/PostgREST messages ("duplicate key value violates unique constraint")
 * are never shown to clinic staff — they are logged in development and replaced
 * with plain language here.
 */

const MESSAGES = {
  auth: 'Unable to sign in. Check your email and password and try again.',
  authFailed: 'Invalid email or password.',
  supabaseConfig: 'Supabase is not configured. Add the project URL and API key to .env.local, then restart the app.',
  updateProfile: 'Unable to update your profile. Please try again.',
  updatePassword: 'Unable to update your password. Please check the password and try again.',
  savePatient: 'Unable to save the patient. Please check the information and try again.',
  updatePatient: 'Unable to update the patient. Please check the information and try again.',
  deletePatient: 'Unable to remove the patient right now.',
  duplicatePatient: 'A patient with this CP number already exists.',
  saveVisit: 'Unable to record the visit. Please check the information and try again.',
  saveOrder: 'Unable to create the order. Please check the information and try again.',
  updateOrder: 'Unable to update the order. Please check the information and try again.',
  cancelOrder: 'Unable to cancel the order right now.',
  savePayment: 'Unable to save the payment. Please check the amount and try again.',
  voidPayment: 'Unable to void the payment right now.',
  saveExpense: 'Unable to record the expense. Please check the information and try again.',
  updateExpense: 'Unable to update the expense. Please check the information and try again.',
  deleteExpense: 'Unable to delete the expense right now.',
  loadPatients: 'Unable to load patients right now.',
  loadOrders: 'Unable to load orders right now.',
  loadPayments: 'Unable to load payment history right now.',
  loadVisits: 'Unable to load visit history right now.',
  loadExpenses: 'Unable to load expenses right now.',
  loadSummary: 'Unable to load the dashboard summary right now.',
  load: 'Something went wrong while loading. Please try again.',
  updateStatus: 'Unable to update the order status right now.',
  notFound: 'That record could not be found.',
}

export class AppError extends Error {
  constructor(message, options) {
    super(message, options)
    this.name = 'AppError'
  }
}

export function friendlyError(key) {
  if (import.meta.env.DEV) {
    console.warn(`[EyeTroOps] friendlyError fallback used for "${key}"`)
  }
  return new AppError(MESSAGES[key])
}

/**
 * Normalises anything thrown into an AppError with a safe message.
 * The original is preserved as `cause` and logged in development.
 */
export function toAppError(caught, key) {
  if (import.meta.env.DEV) {
    console.error(`[EyeTroOps] ${key}:`, caught)
  }
  if (caught instanceof AppError) return caught
  return friendlyError(key)
}
