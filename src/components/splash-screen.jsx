import { useEffect, useState } from 'react'
import { APP_NAME, LOGO_PATH } from '@/lib/constants'
import { useAuth } from '@/hooks/use-auth'

const SPLASH_STORAGE_KEY = 'eyetroops.splash_shown'
const MIN_DURATION_MS = 1600
const MAX_DURATION_MS = 3000
const EXIT_DURATION_MS = 500

/**
 * Splash screen & opening transition for Eye Troops Optical Clinic.
 *
 * Features:
 * - Centered clinic logo, brand name "Eye Troops", and tagline "Optical Clinic Management".
 * - Rich dark & gold color theme with soft iris radial glow.
 * - Subtle animated thin gold progress bar indicator.
 * - Lasts 1.5–2s minimum, or ends once the app and Supabase auth check are ready (capped at 3s).
 * - Shown only once per app open / browser session via sessionStorage.
 * - Respects prefers-reduced-motion by disabling translate/scale animations.
 * - Smooth fade / scale transition into the initial page (login or dashboard).
 */
export function SplashScreen({ children }) {
  const { loading: authLoading } = useAuth()
  const [showSplash, setShowSplash] = useState(() => {
    if (typeof window === 'undefined') return false
    try {
      return !sessionStorage.getItem(SPLASH_STORAGE_KEY)
    } catch {
      return false
    }
  })
  const [isExiting, setIsExiting] = useState(false)
  const [progress, setProgress] = useState(15)

  useEffect(() => {
    if (!showSplash) return undefined

    const startTime = Date.now()
    let frameId
    let exitTimer
    let unmountTimer

    // Progress bar animation across loading phase
    const updateProgress = () => {
      const elapsed = Date.now() - startTime
      // Smoothly advance progress up to 92% until completion is triggered
      const target = Math.min(15 + (elapsed / MIN_DURATION_MS) * 78, 92)
      setProgress((prev) => Math.max(prev, target))

      if (elapsed < MAX_DURATION_MS && !isExiting) {
        frameId = requestAnimationFrame(updateProgress)
      }
    }
    frameId = requestAnimationFrame(updateProgress)

    // Complete transition handler
    const tryFinish = () => {
      const elapsed = Date.now() - startTime
      const isAuthReady = !authLoading

      if ((elapsed >= MIN_DURATION_MS && isAuthReady) || elapsed >= MAX_DURATION_MS) {
        setProgress(100)
        setIsExiting(true)
        try {
          sessionStorage.setItem(SPLASH_STORAGE_KEY, 'true')
        } catch {
          // ignore storage quota / sandbox errors
        }

        unmountTimer = setTimeout(() => {
          setShowSplash(false)
        }, EXIT_DURATION_MS)
      } else {
        const remaining = Math.max(50, MIN_DURATION_MS - elapsed)
        exitTimer = setTimeout(tryFinish, remaining)
      }
    }

    exitTimer = setTimeout(tryFinish, MIN_DURATION_MS)

    return () => {
      cancelAnimationFrame(frameId)
      clearTimeout(exitTimer)
      clearTimeout(unmountTimer)
    }
  }, [showSplash, authLoading, isExiting])

  return (
    <>
      {/* Underlying content with smooth entrance transition when splash exits */}
      <div
        className={
          showSplash
            ? isExiting
              ? 'animate-splash-content-in'
              : 'opacity-0'
            : ''
        }
      >
        {children}
      </div>

      {showSplash && (
        <div
          role="status"
          aria-live="polite"
          aria-label="Loading Eye Troops Optical Clinic"
          className={`fixed inset-0 z-999 flex flex-col items-center justify-center bg-[#171513] text-[#f5f0e8] select-none transition-opacity duration-500 ease-out ${
            isExiting ? 'opacity-0 pointer-events-none' : 'opacity-100'
          }`}
        >
          {/* Subtle warm gold ambient backdrop */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(184,137,61,0.14)_0%,transparent_70%)]"
          />

          <div className="relative z-10 flex flex-col items-center px-6 text-center">
            {/* Centered clinic logo with soft gold aura */}
            <div className="relative mb-6">
              <div
                aria-hidden="true"
                className="absolute -inset-3 rounded-full bg-gold/25 blur-xl motion-safe:animate-pulse motion-reduce:opacity-40"
              />
              <img
                src={LOGO_PATH}
                alt=""
                width={96}
                height={96}
                className="relative size-24 rounded-full object-contain shadow-[0_8px_32px_rgba(0,0,0,0.55)] ring-2 ring-gold/45 motion-safe:animate-splash-logo motion-reduce:animate-none"
              />
            </div>

            {/* Clinic Name: Eye Troops */}
            <h1 className="font-display text-3xl font-extrabold tracking-tight text-[#f5f0e8] sm:text-4xl motion-safe:animate-splash-text motion-reduce:animate-none">
              {APP_NAME}
            </h1>

            {/* Tagline */}
            <p className="mt-2 text-xs font-semibold tracking-[0.25em] text-gold uppercase sm:text-sm motion-safe:animate-splash-text motion-reduce:animate-none">
              Optical Clinic Management
            </p>

            {/* Loading indicator: thin gold progress bar */}
            <div
              className="mt-8 w-44 overflow-hidden rounded-full bg-white/10 p-0.5 sm:w-52"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(progress)}
            >
              <div
                className="h-1 rounded-full bg-gradient-to-r from-gold/60 via-gold to-gold-dark transition-all duration-300 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        </div>
      )}
    </>
  )
}
