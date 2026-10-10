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
  loadAppointments: 'Unable to load appointments right now.',
  loadFollowups: 'Unable to load follow-ups right now.',
  saveAppointment: 'Unable to schedule the appointment. Please check the details and try again.',
  saveFollowup: 'Unable to add the follow-up. Please check the details and try again.',
  updateFollowup: 'Unable to update the follow-up right now.',
  updateAppointment: 'Unable to update the appointment. Please check the details and try again.',
  cancelAppointment: 'Unable to cancel the appointment right now.',
  loadPatients: 'Unable to load patients right now.',
  loadOrders: 'Unable to load orders right now.',
  loadPayments: 'Unable to load payment history right now.',
  loadVisits: 'Unable to load visit history right now.',
  loadExpenses: 'Unable to load expenses right now.',
  loadSummary: 'Unable to load the dashboard summary right now.',
  load: 'Something went wrong while loading. Please try again.',
  updateStatus: 'Unable to update the order status right now.',
  notFound: 'That record could not be found.',
  network: 'We’re having trouble connecting. Your data is safe. Please try again shortly.',
  timeout: 'The request took too long. Your data is safe. Please try again shortly.',
  server: 'The clinic data service is temporarily unavailable. Your data is safe. Please try again shortly.',
  signup: 'Unable to submit your sign-up request. Please try again.',
}

export class AppError extends Error {
  constructor(message, options) {
    super(message, options)
    this.name = 'AppError'
  }
}

export function friendlyError(key, cause) {
  if (import.meta.env.DEV) {
    // Log the full Supabase error so developers can see the real DB error
    // while clinic staff see only the friendly message.
    const detail = cause ?? null
    if (detail) {
      console.warn(
        `[EyeTroops] friendlyError("${key}") — raw error below:`,
        {
          code:    detail?.code    ?? detail?.error_code ?? '—',
          message: detail?.message ?? '—',
          details: detail?.details ?? '—',
          hint:    detail?.hint    ?? '—',
        },
        detail,
      )
    } else {
      console.warn(`[EyeTroops] friendlyError fallback used for "${key}" (no cause provided)`)
    }
  }
  return new AppError(MESSAGES[key] ?? MESSAGES.load, { cause })
}

export function classifyConnectivityFailure(caught) {
  if (caught?.kind === 'network' || caught?.kind === 'timeout' || caught?.kind === 'server') {
    return caught.kind
  }

  const status = Number(caught?.status ?? caught?.statusCode ?? caught?.code)
  if (status >= 500 && status <= 599) return 'server'

  const message = String(caught?.message ?? '')
  if (/timed out|timeout/i.test(message)) return 'timeout'
  if (
    caught?.name === 'NetworkError' ||
    /failed to fetch|fetch failed|network request failed|networkerror/i.test(message)
  ) {
    return 'network'
  }

  return null
}

/**
 * Normalises anything thrown into an AppError with a safe message.
 * The original is preserved as `cause` and logged in development.
 */
export function toAppError(caught, key) {
  if (import.meta.env.DEV) {
    console.error(`[EyeTroops] ${key}:`, caught)
  }
  if (caught instanceof AppError) return caught
  const connectivityFailure = classifyConnectivityFailure(caught)
  if (!connectivityFailure) return friendlyError(key, caught)

  return new AppError(MESSAGES[connectivityFailure], {
    cause: caught,
  })
}
