import { supabase } from '@/lib/supabase'
import { classifyConnectivityFailure, friendlyError, toAppError } from '@/utils/errors'

export async function signIn(email, password) {
  if (!supabase) throw friendlyError('supabaseConfig')

  let result
  try {
    result = await supabase.auth.signInWithPassword({ email, password })
  } catch (caught) {
    throw toAppError(caught, 'auth')
  }
  const { data, error } = result
  if (error) {
    if (classifyConnectivityFailure(error)) throw toAppError(error, 'auth')
    throw friendlyError('authFailed')
  }
  return { session: data.session, user: data.user }
}

export async function signOut() {
  if (!supabase) return
  try {
    const { error } = await supabase.auth.signOut()
    if (error) {
      if (classifyConnectivityFailure(error)) throw toAppError(error, 'auth')
      throw friendlyError('auth')
    }
  } catch (caught) {
    throw toAppError(caught, 'auth')
  }
}

export async function getCurrentUser() {
  if (!supabase) return null
  const { data } = await supabase.auth.getUser()
  return data.user
}

const USER_COLUMNS = 'id, email, full_name, role, job_title, phone, created_at'

export async function getProfile(userId) {
  if (!supabase) return null
  const { data, error } = await supabase
    .from('users')
    .select(USER_COLUMNS)
    .eq('id', userId)
    .maybeSingle()

  if (error) {
    if (import.meta.env.DEV) {
      console.error('[getProfile] Failed to load user profile:', error)
    }
    if (classifyConnectivityFailure(error)) throw toAppError(error, 'loadProfile')
    return null
  }
  return data
}

export async function updateProfile(userId, changes) {
  if (!supabase) throw friendlyError('supabaseConfig')

  try {
    const { data, error } = await supabase
      .from('users')
      .update({
        full_name: changes.full_name.trim(),
        job_title: changes.job_title?.trim() || null,
        phone: changes.phone?.trim() || null,
      })
      .eq('id', userId)
      .select(USER_COLUMNS)
      .single()

    if (error) throw error
    return data
  } catch (caught) {
    throw toAppError(caught, 'updateProfile')
  }
}

export function hasRecentSignIn(session) {
  const lastSignIn = Date.parse(session?.user?.last_sign_in_at ?? '')
  const now = Date.now()
  return Number.isFinite(lastSignIn) && now >= lastSignIn && now - lastSignIn < 24 * 60 * 60 * 1000
}

export async function updatePassword(password, currentPassword) {
  if (!supabase) throw friendlyError('supabaseConfig')

  try {
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
    if (sessionError) throw sessionError

    const session = sessionData.session
    if (!session?.user?.email) throw new Error('Your session has expired. Sign in again to continue.')

    if (!hasRecentSignIn(session)) {
      if (!currentPassword) throw new Error('Enter your current password to continue.')

      const { error: reauthenticationError } = await supabase.auth.signInWithPassword({
        email: session.user.email,
        password: currentPassword,
      })
      if (reauthenticationError) throw reauthenticationError
    }

    const { error } = await supabase.auth.updateUser({ password })
    if (error) throw error
  } catch (caught) {
    throw toAppError(caught, 'updatePassword')
  }
}

export async function listTotpFactors() {
  if (!supabase) throw friendlyError('supabaseConfig')
  const { data, error } = await supabase.auth.mfa.listFactors()
  if (error) throw toAppError(error, 'loadMfaFactors')
  return data.totp
}

export async function enrollTotpFactor() {
  if (!supabase) throw friendlyError('supabaseConfig')
  const { data, error } = await supabase.auth.mfa.enroll({
    factorType: 'totp',
    friendlyName: 'Eye Troops authenticator',
  })
  if (error) throw toAppError(error, 'enrollMfaFactor')
  return data
}

export async function verifyTotpFactor(factorId, code) {
  if (!supabase) throw friendlyError('supabaseConfig')
  const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId })
  if (challengeError) throw toAppError(challengeError, 'challengeMfaFactor')

  const { error } = await supabase.auth.mfa.verify({
    factorId,
    challengeId: challenge.id,
    code,
  })
  if (error) throw toAppError(error, 'verifyMfaFactor')
}

export async function disableTotpFactor(factorId, code) {
  if (!supabase) throw friendlyError('supabaseConfig')
  const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({ factorId, code })
  if (verifyError) throw toAppError(verifyError, 'verifyMfaFactor')

  const { error } = await supabase.auth.mfa.unenroll({ factorId })
  if (error) throw toAppError(error, 'disableMfaFactor')
}

export async function discardUnverifiedTotpFactor(factorId) {
  if (!supabase) throw friendlyError('supabaseConfig')
  const { error } = await supabase.auth.mfa.unenroll({ factorId })
  if (error) throw toAppError(error, 'discardMfaFactor')
}

export async function signOutOtherSessions() {
  if (!supabase) throw friendlyError('supabaseConfig')
  const { error } = await supabase.auth.signOut({ scope: 'others' })
  if (error) throw toAppError(error, 'signOutOtherSessions')
}
