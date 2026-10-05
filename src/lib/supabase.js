import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL ?? ''
const supabaseKey =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? import.meta.env.VITE_SUPABASE_ANON_KEY ?? ''

export const isSupabaseConfigured = supabaseUrl.startsWith('https://') && supabaseKey.length > 20

if (import.meta.env.DEV && !isSupabaseConfigured) {
  console.warn('[Supabase Config] Not configured:', {
    VITE_SUPABASE_URL: supabaseUrl ? 'Set' : 'Missing',
    VITE_SUPABASE_PUBLISHABLE_KEY: supabaseKey ? `Set (len: ${supabaseKey.length})` : 'Missing',
  })
}

const REQUEST_TIMEOUT_MS = 10_000
const MAX_READ_ATTEMPTS = 3

function reportHealth(status) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('supabase-health-change', { detail: { status } }))
  }
}

export class SupabaseRequestError extends Error {
  constructor(kind, message, options = {}) {
    super(message, options)
    this.name = 'SupabaseRequestError'
    this.kind = kind
    this.status = options.status
  }
}

function wait(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms))
}

async function fetchWithTimeout(input, init = {}) {
  const method = (init.method ?? input?.method ?? 'GET').toUpperCase()
  const isRead = method === 'GET' || method === 'HEAD'
  const maxAttempts = isRead ? MAX_READ_ATTEMPTS : 1

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const controller = new AbortController()
    const externalSignal = init.signal ?? (typeof Request !== 'undefined' && input instanceof Request
      ? input.signal
      : null)
    let didTimeout = false
    const timeoutId = window.setTimeout(() => {
      didTimeout = true
      controller.abort()
    }, REQUEST_TIMEOUT_MS)
    const abortFromCaller = () => controller.abort(externalSignal.reason)

    if (externalSignal?.aborted) abortFromCaller()
    else externalSignal?.addEventListener('abort', abortFromCaller, { once: true })

    try {
      const response = await fetch(input, { ...init, signal: controller.signal })
      if (response.status >= 500) {
        await response.body?.cancel().catch(() => {})
        if (isRead && attempt < maxAttempts) {
          await wait(250 * (2 ** (attempt - 1)))
          continue
        }
        reportHealth('degraded')
        throw new SupabaseRequestError('server', 'The Supabase service returned a server error.', {
          status: response.status,
        })
      }
      return response
    } catch (caught) {
      if (caught instanceof SupabaseRequestError) throw caught
      if (externalSignal?.aborted && !didTimeout) throw caught

      const kind = didTimeout ? 'timeout' : 'network'
      if (isRead && attempt < maxAttempts) {
        await wait(250 * (2 ** (attempt - 1)))
        continue
      }

      reportHealth(typeof navigator !== 'undefined' && !navigator.onLine ? 'down' : 'degraded')
      const message = kind === 'timeout'
        ? 'The Supabase request timed out.'
        : 'The Supabase service could not be reached.'
      throw new SupabaseRequestError(kind, message, { cause: caught })
    } finally {
      window.clearTimeout(timeoutId)
      externalSignal?.removeEventListener('abort', abortFromCaller)
    }
  }

  throw new SupabaseRequestError('network', 'The Supabase service could not be reached.')
}

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseKey, { global: { fetch: fetchWithTimeout } })
  : null

export async function checkSupabaseHealth() {
  if (!isSupabaseConfigured || (typeof navigator !== 'undefined' && !navigator.onLine)) {
    return 'down'
  }

  try {
    const response = await fetchWithTimeout(`${supabaseUrl}/auth/v1/health`, {
      method: 'GET',
      headers: { apikey: supabaseKey },
    })
    const status = response.ok ? 'online' : 'degraded'
    if (status !== 'online') reportHealth(status)
    return status
  } catch {
    return typeof navigator !== 'undefined' && !navigator.onLine ? 'down' : 'degraded'
  }
}

export function unwrap(result) {
  if (result.error) {
    // Carry the full Supabase error as `cause` so friendlyError/toAppError
    // can log code, message, details, and hint in development.
    throw Object.assign(
      new Error(result.error.message ?? 'Database error', { cause: result.error }),
      {
        code:    result.error.code,
        details: result.error.details,
        hint:    result.error.hint,
      },
    )
  }
  if (result.data === null || result.data === undefined) throw new Error('No data returned.')
  return result.data
}