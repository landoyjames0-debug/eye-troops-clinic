import { useState } from 'react'
import { AlertTriangle, RefreshCw, X } from 'lucide-react'
import { useSupabaseHealth } from '@/hooks/use-supabase-health'

export function ConnectionBanner() {
  const { status, outageId, retry } = useSupabaseHealth()
  const [dismissedOutage, setDismissedOutage] = useState(null)

  if (status === 'online' || dismissedOutage === outageId) return null

  return (
    <div
      className="sticky top-0 z-60 flex items-center justify-center gap-3 border-b border-warning/30 bg-surface/95 px-4 py-2.5 text-sm text-espresso shadow-card backdrop-blur-sm"
      role="status"
      aria-live="polite"
    >
      <AlertTriangle className="size-4 shrink-0 text-warning" aria-hidden="true" />
      <p className="m-0 min-w-0 flex-1 text-center sm:flex-initial">
        We&apos;re having trouble connecting. Your data is safe. Please try again shortly.
      </p>
      <span className="hidden text-xs text-warmgray sm:inline">
        {status === 'down' ? 'Offline' : 'Service degraded'}
      </span>
      <button
        type="button"
        onClick={() => void retry()}
        className="inline-flex size-8 shrink-0 items-center justify-center rounded-control text-gold-dark transition-colors hover:bg-gold-light"
        aria-label="Retry connection check"
        title="Retry connection check"
      >
        <RefreshCw className="size-4" aria-hidden="true" />
      </button>
      <button
        type="button"
        onClick={() => setDismissedOutage(outageId)}
        className="inline-flex size-8 shrink-0 items-center justify-center rounded-control text-warmgray transition-colors hover:bg-ivory hover:text-espresso"
        aria-label="Dismiss connection message"
        title="Dismiss"
      >
        <X className="size-4" aria-hidden="true" />
      </button>
    </div>
  )
}