/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { checkSupabaseHealth, isSupabaseConfigured } from '@/lib/supabase'

const SupabaseHealthContext = createContext(null)
const HEALTH_CHECK_INTERVAL_MS = 30_000

export function SupabaseHealthProvider({ children }) {
  const initialStatus = !isSupabaseConfigured || !navigator.onLine ? 'down' : 'online'
  const statusRef = useRef(initialStatus)
  const [status, setStatus] = useState(initialStatus)
  const [outageId, setOutageId] = useState(0)

  const updateStatus = useCallback((nextStatus) => {
    if (statusRef.current === nextStatus) return
    if (statusRef.current === 'online' && nextStatus !== 'online') {
      setOutageId((current) => current + 1)
    }
    statusRef.current = nextStatus
    setStatus(nextStatus)
  }, [])

  const retry = useCallback(async () => {
    if (!navigator.onLine) {
      updateStatus('down')
      return 'down'
    }
    if (statusRef.current !== 'online') updateStatus('degraded')
    const nextStatus = await checkSupabaseHealth()
    updateStatus(nextStatus)
    return nextStatus
  }, [updateStatus])

  useEffect(() => {
    let active = true

    const runCheck = async () => {
      const nextStatus = await checkSupabaseHealth()
      if (active) updateStatus(nextStatus)
    }
    const handleOffline = () => updateStatus('down')
    const handleRequestHealth = (event) => updateStatus(event.detail?.status ?? 'degraded')
    const handleOnline = () => {
      updateStatus('degraded')
      void runCheck()
    }

    void runCheck()
    const intervalId = window.setInterval(runCheck, HEALTH_CHECK_INTERVAL_MS)
    window.addEventListener('offline', handleOffline)
    window.addEventListener('online', handleOnline)
    window.addEventListener('supabase-health-change', handleRequestHealth)

    return () => {
      active = false
      window.clearInterval(intervalId)
      window.removeEventListener('offline', handleOffline)
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('supabase-health-change', handleRequestHealth)
    }
  }, [updateStatus])

  const value = useMemo(() => ({
    status,
    outageId,
    isOnline: status === 'online',
    retry,
  }), [outageId, retry, status])

  return <SupabaseHealthContext value={value}>{children}</SupabaseHealthContext>
}

export function useSupabaseHealth() {
  const context = useContext(SupabaseHealthContext)
  if (!context) throw new Error('useSupabaseHealth must be used inside <SupabaseHealthProvider>.')
  return context
}