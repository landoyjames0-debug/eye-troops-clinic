import { createContext, use, useCallback, useEffect, useMemo, useState } from 'react'
import { IS_SUPABASE_CONFIGURED } from '@/lib/constants'
import { supabase } from '@/lib/supabase'
import {
  getCurrentUser,
  getProfile,
  signIn as authSignIn,
  signOut as authSignOut,
} from '@/services/auth.service'

const AuthContext = createContext(null)

/**
 * Sample-data mode has no real session to restore, so the signed-in flag is
 * kept in sessionStorage purely so a refresh does not dump staff back on the
 * login screen mid-review. It is scoped to the tab and cleared on sign out.
 */
const DEMO_SESSION_KEY = 'et-demo-session'

function readDemoFlag() {
  if (typeof window === 'undefined') return false
  try {
    return window.sessionStorage.getItem(DEMO_SESSION_KEY) === '1'
  } catch {
    return false
  }
}

function writeDemoFlag(value) {
  try {
    if (value) window.sessionStorage.setItem(DEMO_SESSION_KEY, '1')
    else window.sessionStorage.removeItem(DEMO_SESSION_KEY)
  } catch {
    // Private-mode storage failures must not break sign-in.
  }
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  // Keyed by user id so a profile can never outlive the session it belongs to.
  const [loadedProfile, setLoadedProfile] = useState(null)
  // Without a project there is no session to wait for.
  const [loading, setLoading] = useState(IS_SUPABASE_CONFIGURED)
  // Sample-data mode still starts signed out, so the login screen is the first
  // screen staff see in both modes.
  const [demoSignedIn, setDemoSignedIn] = useState(readDemoFlag)

  useEffect(() => {
    if (!IS_SUPABASE_CONFIGURED) return

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

  const userId = session?.user.id ?? (IS_SUPABASE_CONFIGURED ? null : demoSignedIn ? 'demo' : null)
  const profile = loadedProfile?.userId === userId ? loadedProfile.row : null

  useEffect(() => {
    if (!userId || userId === 'demo') return

    let active = true
    void getProfile(userId).then((row) => {
      if (active) setLoadedProfile({ userId, row })
    })

    return () => {
      active = false
    }
  }, [userId])

  const signIn = useCallback(async (email, password) => {
    const result = await authSignIn(email, password)
    if (!IS_SUPABASE_CONFIGURED) {
      writeDemoFlag(true)
      setDemoSignedIn(true)
    }
    return result
  }, [])

  const signOut = useCallback(async () => {
    await authSignOut()
    setLoadedProfile(null)
    writeDemoFlag(false)
    setDemoSignedIn(false)
  }, [])

  const value = useMemo(
    () => ({
      session,
      userId,
      profile,
      loading,
      isDemo: !IS_SUPABASE_CONFIGURED,
      signIn,
      signOut,
    }),
    [session, userId, profile, loading, signIn, signOut],
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
