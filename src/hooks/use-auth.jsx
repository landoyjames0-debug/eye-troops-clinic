import { createContext, use, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import {
  getProfile,
  signIn as authSignIn,
  signOut as authSignOut,
  updateProfile as persistProfile,
} from '@/services/auth.service'
import { listAppointments } from '@/lib/appointments'
import { listOrders } from '@/services/orders.service'
import { listPatients } from '@/services/patients.service'
import { toDateKey } from '@/utils/dates'
import { clinicQueryKey, clearQueryCaches, QUERY_GC_TIME, SUMMARY_STALE_TIME, runTimedQuery } from '@/lib/query-client'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const queryClient = useQueryClient()
  const currentUserIdRef = useRef(undefined)
  // Without a project there is no session to wait for.
  const [loading, setLoading] = useState(Boolean(supabase))

  useEffect(() => {
    if (!supabase) return

    let active = true

    void supabase.auth.getSession().then(({ data }) => {
      if (!active) return
      const nextUserId = data.session?.user.id ?? null
      if (currentUserIdRef.current === undefined) currentUserIdRef.current = nextUserId
      else if (currentUserIdRef.current !== nextUserId) {
        clearQueryCaches()
        currentUserIdRef.current = nextUserId
      }
      setSession(data.session)
      setLoading(false)
    })

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, next) => {
      const nextUserId = next?.user.id ?? null
      if (currentUserIdRef.current !== undefined && currentUserIdRef.current !== nextUserId) {
        clearQueryCaches()
      }
      currentUserIdRef.current = nextUserId
      setSession(next)
    })

    return () => {
      active = false
      subscription.subscription.unsubscribe()
    }
  }, [])

  const userId = session?.user.id ?? null
  const profileQuery = useQuery({
    queryKey: clinicQueryKey(userId, 'profile'),
    queryFn: () => runTimedQuery('profile', () => getProfile(userId)),
    enabled: Boolean(userId),
    staleTime: SUMMARY_STALE_TIME,
    gcTime: QUERY_GC_TIME,
    retry: 2,
  })
  const profile = profileQuery.data ?? null

  const signIn = useCallback(async (email, password) => {
    const result = await authSignIn(email, password)
    const nextUserId = result.user.id
    const todayStart = new Date(`${toDateKey()}T00:00:00`).toISOString()
    const prefetch = [
      queryClient.prefetchQuery({
        queryKey: clinicQueryKey(nextUserId, 'profile'),
        queryFn: () => runTimedQuery('profile', () => getProfile(nextUserId)),
        staleTime: SUMMARY_STALE_TIME,
      }),
      queryClient.prefetchQuery({
        queryKey: clinicQueryKey(nextUserId, 'loadPatients', 'patient-roster', ''),
        queryFn: () => runTimedQuery('patients-first-page', () => listPatients('')),
      }),
      queryClient.prefetchQuery({
        queryKey: clinicQueryKey(nextUserId, 'loadOrders', 'orders-list', ''),
        queryFn: () => runTimedQuery('orders-first-page', async () => {
          const [rows, patients] = await Promise.all([listOrders('', 'ALL', 'ALL'), listPatients('')])
          const byId = new Map(patients.map((patient) => [patient.id, patient]))
          return rows.map((order) => ({
            ...order,
            patient_name: byId.get(order.patient_id)?.full_name ?? '—',
          }))
        }),
      }),
      queryClient.prefetchQuery({
        queryKey: clinicQueryKey(nextUserId, 'loadAppointments', 'appointments-upcoming', todayStart),
        queryFn: () => runTimedQuery('appointments-first-page', () => listAppointments({ from: todayStart })),
      }),
    ]
    void Promise.all(prefetch)
    return result
  }, [queryClient])

  const signOut = useCallback(async () => {
    await authSignOut()
    clearQueryCaches()
    currentUserIdRef.current = null
    setSession(null)
  }, [])

  const saveProfile = useCallback(
    async (changes) => {
      if (!userId) throw new Error('No signed-in profile is available.')

      const row = await persistProfile(userId, changes)
      queryClient.setQueryData(clinicQueryKey(userId, 'profile'), row)
      return row
    },
    [queryClient, userId],
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
  return useAuth().session?.user ?? null
}
