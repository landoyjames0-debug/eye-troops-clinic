import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { AlertTriangle, RefreshCw, X } from 'lucide-react'
import { useSupabaseHealth } from '@/hooks/use-supabase-health'
import { isSupabaseConfigured } from '@/lib/supabase'

const DISMISS_KEY = 'eyetroops.connection-banner-dismissed'

export function ConnectionBanner() {
  const location = useLocation()
  const { status, retry } = useSupabaseHealth()
  const [dismissed, setDismissed] = useState(() => {
    try {
      return sessionStorage.getItem(DISMISS_KEY) === 'true'
    } catch {
      return false
    }
  })
  const [retrying, setRetrying] = useState(false)

  // Clear dismissal once connection is restored so future outages are not missed
  useEffect(() => {
    if (status === 'online') {
      setDismissed(false)
      try {
        sessionStorage.removeItem(DISMISS_KEY)
      } catch {}
    }
  }, [status])

  // Never show on auth pages (/login, /signup) or when Supabase is not configured yet
  const isAuthPage = location.pathname === '/login' || location.pathname === '/signup'
  if (isAuthPage || !isSupabaseConfigured || status === 'online' || dismissed) {
    return null
  }

  const handleRetry = async () => {
    setRetrying(true)
    try {
      await retry()
    } finally {
      setRetrying(false)
    }
  }

  const handleDismiss = () => {
    setDismissed(true)
    try {
      sessionStorage.setItem(DISMISS_KEY, 'true')
    } catch {}
  }

  return (
    <div
      className="sticky top-0 z-60 flex items-center gap-2 border-b border-warning/30 bg-surface/95 px-3 py-2 text-sm text-espresso shadow-card backdrop-blur-sm sm:gap-3 sm:px-4 sm:py-2.5"
      role="status"
      aria-live="polite"
    >
      <AlertTriangle className="size-4 shrink-0 text-warning" aria-hidden="true" />
      <p className="m-0 min-w-0 flex-1">
        <span className="sm:hidden">Connection issue. Retrying&hellip;</span>
        <span className="hidden sm:inline">We&apos;re having trouble connecting. Please try again shortly.</span>
      </p>
      <span className="hidden text-xs text-warmgray lg:inline">
        {status === 'down' ? 'Offline' : 'Service degraded'}
      </span>
      <button
        type="button"
        onClick={() => void handleRetry()}
        disabled={retrying}
        className="inline-flex size-8 shrink-0 items-center justify-center rounded-control text-gold-dark transition-colors hover:bg-gold-light disabled:opacity-50"
        aria-label="Retry connection check"
        title="Retry connection check"
      >
        <RefreshCw className={`size-4 ${retrying ? 'animate-spin' : ''}`} aria-hidden="true" />
      </button>
      <button
        type="button"
        onClick={handleDismiss}
        className="inline-flex size-8 shrink-0 items-center justify-center rounded-control text-warmgray transition-colors hover:bg-ivory hover:text-espresso"
        aria-label="Dismiss connection message"
        title="Dismiss"
      >
        <X className="size-4" aria-hidden="true" />
      </button>
    </div>
  )
}