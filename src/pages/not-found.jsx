import { ArrowLeft } from 'lucide-react'
import { Link } from 'react-router-dom'

export default function NotFoundPage() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-ivory px-6 py-12">
      <div className="w-full max-w-md rounded-card border border-champagne bg-surface p-6 text-center shadow-card">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gold-dark">404</p>
        <h1 className="mt-3 text-3xl font-bold text-espresso">Page not found</h1>
        <p className="mt-2 text-sm text-warmgray">
          The page you’re looking for doesn’t exist or may have moved.
        </p>
        <Link
          to="/today"
          className="mt-5 inline-flex h-11 items-center justify-center gap-2 rounded-control bg-gold px-4 text-sm font-semibold text-white transition-colors hover:bg-gold-dark focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
        >
          <ArrowLeft className="size-4" strokeWidth={2} aria-hidden="true" />
          Back to Today
        </Link>
      </div>
    </div>
  )
}
