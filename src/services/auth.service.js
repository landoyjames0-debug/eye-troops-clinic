import { IS_SUPABASE_CONFIGURED } from '@/lib/constants'
import { supabase } from '@/lib/supabase'
import { friendlyError } from '@/utils/errors'

export async function signIn(email, password) {
  if (!IS_SUPABASE_CONFIGURED) {
    // Sample-data mode: accept the documented sample credentials so the flow can
    // be walked through without a database.
    if (email.trim().toLowerCase() === 'demo@eyetroops.ph' && password === 'demo1234') {
      return { session: null, user: null }
    }
    throw friendlyError('authFailed')
  }

  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw friendlyError('authFailed')
  return { session: data.session, user: data.user }
}

export async function signOut() {
  if (!IS_SUPABASE_CONFIGURED) return
  const { error } = await supabase.auth.signOut()
  if (error) throw friendlyError('auth')
}

export async function getCurrentUser() {
  if (!IS_SUPABASE_CONFIGURED) return null
  const { data } = await supabase.auth.getUser()
  return data.user
}

export async function getProfile(userId) {
  if (!IS_SUPABASE_CONFIGURED) return null
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', userId)
    .maybeSingle()

  if (error) return null
  return data
}
