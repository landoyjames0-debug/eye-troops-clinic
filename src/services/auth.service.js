import { supabase } from '@/lib/supabase'
import { friendlyError, toAppError } from '@/utils/errors'

export async function signIn(email, password) {
  if (!supabase) throw friendlyError('supabaseConfig')

  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw friendlyError('authFailed')
  return { session: data.session, user: data.user }
}

export async function signOut() {
  if (!supabase) return
  const { error } = await supabase.auth.signOut()
  if (error) throw friendlyError('auth')
}

export async function getCurrentUser() {
  if (!supabase) return null
  const { data } = await supabase.auth.getUser()
  return data.user
}

export async function getProfile(userId) {
  if (!supabase) return null
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', userId)
    .maybeSingle()

  if (error) return null
  return data
}

export async function updateProfile(userId, changes) {
  if (!supabase) throw friendlyError('supabaseConfig')

  try {
    const { data, error } = await supabase
      .from('users')
      .update({ full_name: changes.full_name.trim() })
      .eq('id', userId)
      .select('*')
      .single()

    if (error) throw error
    return data
  } catch (caught) {
    throw toAppError(caught, 'updateProfile')
  }
}

export async function updatePassword(password) {
  if (!supabase) throw friendlyError('supabaseConfig')

  try {
    const { error } = await supabase.auth.updateUser({ password })
    if (error) throw error
  } catch (caught) {
    throw toAppError(caught, 'updatePassword')
  }
}
