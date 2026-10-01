import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL ?? ''
const supabaseKey =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? import.meta.env.VITE_SUPABASE_ANON_KEY ?? ''

export const isSupabaseConfigured = supabaseUrl.startsWith('https://') && supabaseKey.length > 20
export const supabase = isSupabaseConfigured ? createClient(supabaseUrl, supabaseKey) : null

export function unwrap(result) {
  if (result.error) throw new Error(result.error.message ?? 'Database error')
  if (result.data === null || result.data === undefined) throw new Error('No data returned.')
  return result.data
}