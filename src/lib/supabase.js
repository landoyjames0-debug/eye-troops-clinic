import { createClient } from '@supabase/supabase-js'
import { IS_SUPABASE_CONFIGURED, SUPABASE_ANON_KEY, SUPABASE_URL } from './constants'

/**
 * One shared client for the whole app.
 *
 * The anon key is public by design — Row Level Security is what protects the
 * data. Never put the service-role key in a VITE_ variable; anything with that
 * prefix is bundled into the client.
 */
export const supabase = createClient(
  IS_SUPABASE_CONFIGURED ? SUPABASE_URL : 'https://placeholder.supabase.co',
  IS_SUPABASE_CONFIGURED
    ? SUPABASE_ANON_KEY
    : 'placeholder-anon-key-placeholder-anon-key-0000',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  },
)

/**
 * Throws on a database error so every query fails the same way, and returns
 * the rows otherwise. `.single()` and friends resolve to null when nothing
 * matched, which callers treat as a failed lookup.
 */
export function unwrap(result) {
  if (result.error) {
    const message =
      typeof result.error === 'object' &&
      result.error !== null &&
      'message' in result.error
        ? String(result.error.message)
        : 'Database error'
    throw new Error(message)
  }
  if (result.data === null || result.data === undefined) {
    throw new Error('No data returned.')
  }
  return result.data
}
