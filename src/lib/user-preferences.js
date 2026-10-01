import { PAYMENT_METHODS } from '@/lib/constants'

const PREFERENCES_KEY = 'et-user-preferences'

function preferencesKey(userId) {
  return `${PREFERENCES_KEY}:${userId ?? 'signed-out'}`
}

export function getDefaultPaymentMethod(userId) {
  try {
    const preferences = JSON.parse(window.localStorage.getItem(preferencesKey(userId)) ?? '{}')
    return PAYMENT_METHODS.includes(preferences.defaultPaymentMethod)
      ? preferences.defaultPaymentMethod
      : 'Cash'
  } catch {
    return 'Cash'
  }
}

export function saveDefaultPaymentMethod(method, userId) {
  if (!PAYMENT_METHODS.includes(method)) return
  try {
    window.localStorage.setItem(
      preferencesKey(userId),
      JSON.stringify({ defaultPaymentMethod: method }),
    )
  } catch {
    // Keep the in-memory selection usable if browser storage is unavailable.
  }
}