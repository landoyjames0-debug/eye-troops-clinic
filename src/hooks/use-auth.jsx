import { createContext, use, useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import {
  getCurrentUser,
  getProfile,
  signIn as authSignIn,
  signOut as authSignOut,
  updateProfile as persistProfile,
} from '@/services/auth.service'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  // Keyed by user id so a profile can never outlive the session it belongs to.
  const [loadedProfile, setLoadedProfile] = useState(null)
  // Without a project there is no session to wait for.
  const [loading, setLoading] = useState(Boolean(supabase))

  useEffect(() => {
    if (!supabase) return

    let active = true

    void supabase.auth.getSession().then(({ data }) => {
      if (!active) return
      setSession(data.session)
      setLoading(false)
    })

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next)
    })

    return () => {
      active = false
      subscription.subscription.unsubscribe()
    }
  }, [])

  const userId = session?.user.id ?? null
  const profile = loadedProfile?.userId === userId ? loadedProfile.row : null

  useEffect(() => {
    if (!userId) return

    let active = true
    void getProfile(userId).then((row) => {
      if (active) setLoadedProfile({ userId, row })
    })

    return () => {
      active = false
    }
  }, [userId])

  const signIn = useCallback((email, password) => authSignIn(email, password), [])

  const signOut = useCallback(async () => {
    await authSignOut()
    setLoadedProfile(null)
  }, [])

  const saveProfile = useCallback(
    async (changes) => {
      if (!userId) throw new Error('No signed-in profile is available.')

      const row = await persistProfile(userId, changes)
      setLoadedProfile({ userId, row })
      return row
    },
    [userId],
  )

  const value = useMemo(
    () => ({
      session,
      userId,
      profile,
      loading,
      signIn,
      signOut,
      saveProfile,
    }),
    [session, userId, profile, loading, signIn, signOut, saveProfile],
  )

  return <AuthContext value={value}>{children}</AuthContext>
}

export function useAuth() {
  const context = use(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used inside <AuthProvider>.')
  }
  return context
}

/** Session user with a graceful fallback when Supabase is not configured. */
export function useCurrentUser() {
  const [user, setUser] = useState(null)
  useEffect(() => {
    let active = true
    void getCurrentUser().then((row) => {
      if (active) setUser(row)
    })
    return () => {
      active = false
    }
  }, [])
  return user
}
