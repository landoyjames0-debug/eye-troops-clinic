import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  CalendarCheck,
  CheckCircle2,
  ClipboardList,
  Eye,
  EyeOff,
  LockKeyhole,
  LogIn,
  Mail,
  Shield,
  Users,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ErrorNote } from '@/components/ui/feedback'
import { APP_NAME, LOGO_PATH } from '@/lib/constants'
import { isSupabaseConfigured } from '@/lib/supabase'
import { useAuth } from '@/hooks/use-auth'
import { AppError } from '@/utils/errors'

const REMEMBER_KEY = 'eyetroops.remembered-email'

const LOGIN_FEATURES = [
  { icon: Users, label: 'Patient records & visit history' },
  { icon: ClipboardList, label: 'Orders, balances & payments' },
  { icon: CalendarCheck, label: 'Today dashboard & daily activity' },
]

export default function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { signIn } = useAuth()
  const [signedOutBanner] = useState(() => location.state?.signedOut === true)

  useEffect(() => {
    if (location.state?.signedOut) {
      navigate(location.pathname, { replace: true, state: {} })
    }
  }, [location.pathname, location.state, navigate])
  // Read once during the first render rather than in an effect.
  const [remembered] = useState(() => window.localStorage.getItem(REMEMBER_KEY) ?? '')
  const [email, setEmail] = useState(remembered)
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [remember, setRemember] = useState(Boolean(remembered))
  const [notice, setNotice] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError(null)
    setNotice(null)

    if (!email.trim() || !password) {
      setError('Enter your email address and password.')
      return
    }

    setLoading(true)
    try {
      await signIn(email.trim(), password)
      if (remember) {
        window.localStorage.setItem(REMEMBER_KEY, email.trim())
      } else {
        window.localStorage.removeItem(REMEMBER_KEY)
      }
      navigate('/today', { replace: true })
    } catch (caught) {
      setError(caught instanceof AppError ? caught.message : 'Unable to sign in right now.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-page relative min-h-dvh overflow-hidden">
      {/* Ambient background — full viewport so mobile never feels like a blank white sheet. */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-gradient-to-br from-gold-light via-ivory to-champagne/50" />
      </div>

      <div className="login-shell relative lg:grid lg:min-h-dvh lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
      <section className="login-brand relative flex flex-col justify-between overflow-hidden border-r border-champagne/70 bg-gradient-to-br from-gold-light/40 via-ivory/80 to-transparent px-5 py-6 md:px-8 md:py-10 lg:px-10 xl:px-16">
        <div aria-hidden="true" className="login-iris pointer-events-none absolute inset-0 overflow-hidden" />

        <div className="relative flex items-center gap-4 pt-2">
          <img
            src={LOGO_PATH}
            alt=""
            width={56}
            height={56}
            className="size-14 shrink-0 rounded-xl object-contain"
          />
          <div className="leading-tight">
            <p className="font-display text-xl font-extrabold tracking-tight text-espresso">
              {APP_NAME}
            </p>
            <p className="text-[10px] font-semibold tracking-[0.2em] text-gold">
              OPTICAL CLINIC MANAGEMENT
            </p>
          </div>
        </div>

        <div className="login-brand-copy relative mx-auto max-w-lg flex-1 py-6 text-left md:py-10 md:text-center lg:flex lg:flex-col lg:justify-center">
          <p className="login-eyebrow text-[11px] font-semibold tracking-[0.15em] text-gold-dark uppercase mb-2 md:mb-4">
            EYE TROOPS OPTICAL CLINIC
          </p>
          <h2 className="login-headline font-display text-[25px] leading-[1.15] font-semibold tracking-tight text-espresso mb-3 md:text-[32px] lg:text-[36px] xl:text-[40px] md:mb-6">
            Care for every patient.<br />
            Clarity for every record.
          </h2>
          <p className="login-brand-description text-[13px] md:text-[15px] lg:text-[16px] leading-relaxed text-warmgray max-w-md md:mx-auto">
            Keep patient records, prescriptions, orders, payments, and daily clinic operations organized in one place.
          </p>
        </div>

        <ul className="login-features hidden space-y-2.5 md:grid md:grid-cols-1">
          {LOGIN_FEATURES.map(({ icon: Icon, label }) => (
            <li key={label} className="login-feature flex items-center gap-3 text-sm text-warmgray">
              <span className="login-feature-icon flex size-9 shrink-0 items-center justify-center rounded-lg bg-gold-light/80 text-gold-dark">
                <Icon className="size-4" strokeWidth={1.8} aria-hidden="true" />
              </span>
              {label}
            </li>
          ))}
        </ul>
      </section>

      <section className="login-form-panel relative flex min-h-[calc(100dvh-0px)] items-center justify-center px-4 py-6 sm:px-8 sm:py-10 lg:min-h-dvh lg:px-12 xl:px-20">
        <div className="relative w-full max-w-[440px]">
          <div className="login-card overflow-hidden rounded-[24px] border border-champagne/80 bg-surface/95 shadow-raised backdrop-blur-sm">
            <div className="login-card-accent h-[4px] bg-gradient-to-r from-gold-light via-gold to-gold-dark" aria-hidden="true" />

            <div className="login-card-content p-6 sm:p-8">
          <div className="hidden items-center gap-3 border-b border-champagne/70 pb-5 lg:flex">
            <span className="flex size-11 items-center justify-center rounded-xl bg-gradient-to-br from-gold-light to-champagne text-gold-dark">
              <Shield className="size-5" strokeWidth={1.8} aria-hidden="true" />
            </span>
            <div>
              <p className="text-[11px] font-semibold tracking-wide text-gold-dark uppercase">
                Staff sign in
              </p>
              <p className="text-[13px] text-warmgray">Secure access to clinic operations</p>
            </div>
          </div>

          <h1 className="font-display text-[28px] leading-[1.15] font-bold tracking-tight text-espresso sm:text-[30px] lg:mt-6">
            Welcome back
          </h1>
          <p className="mt-1.5 text-sm text-warmgray">Sign in to manage your clinic.</p>

          {signedOutBanner && (
            <p
              className="mt-5 flex items-start gap-2.5 rounded-[var(--radius-control)] border border-success/25 bg-success/5 px-3.5 py-2.5 text-[13px] text-success"
              role="status"
            >
              <CheckCircle2 className="mt-0.5 size-4 shrink-0" strokeWidth={2} aria-hidden="true" />
              <span>You have been signed out successfully.</span>
            </p>
          )}

          <form onSubmit={handleSubmit} className="login-form mt-6 space-y-5 sm:mt-8" noValidate>
            <Input
              id="email"
              label="Email Address"
              type="email"
              autoComplete="username"
              placeholder="Enter your email address"
              leading={<Mail className="size-[17px]" strokeWidth={1.8} />}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoFocus={!remembered}
              required
              className="login-input"
            />

            <Input
              id="password"
              label="Password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              placeholder="Enter your password"
              leading={<LockKeyhole className="size-[17px]" strokeWidth={1.8} />}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              className="login-input"
              trailing={
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  aria-pressed={showPassword}
                  className="login-password-toggle rounded p-1.5 text-warmgray transition-colors hover:text-espresso"
                >
                  {showPassword ? (
                    <EyeOff className="size-[18px]" strokeWidth={1.7} aria-hidden="true" />
                  ) : (
                    <Eye className="size-[18px]" strokeWidth={1.7} aria-hidden="true" />
                  )}
                </button>
              }
            />

            <div className="login-form-options flex flex-wrap items-center justify-between gap-3">
              <label className="login-remember flex cursor-pointer items-center gap-2 text-[13px] text-warmgray">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(event) => setRemember(event.target.checked)}
                  className="login-checkbox size-4 rounded border-champagne accent-[var(--color-gold-dark)]"
                />
                Remember me
              </label>

              <button
                type="button"
                onClick={() =>
                  setNotice('Please ask a clinic administrator to reset your password.')
                }
                className="login-forgot text-[13px] font-medium text-gold-dark underline-offset-4 hover:underline"
              >
                Forgot password?
              </button>
            </div>

            {error && <ErrorNote message={error} />}

            {notice && (
              <p
                className="login-notice rounded-[var(--radius-control)] border border-champagne bg-ivory/80 px-3.5 py-2.5 text-[13px] text-warmgray"
                role="status"
              >
                {notice}
              </p>
            )}

            {!isSupabaseConfigured && (
              <p className="login-notice" role="status">
                Supabase is not configured. Add the project URL and API key to .env.local, then restart the app.
              </p>
            )}

            <Button
              type="submit"
              loading={loading}
              loadingText="Signing in..."
              disabled={!isSupabaseConfigured}
              className="login-submit w-full"
            >
              <LogIn className="size-4" aria-hidden="true" />
              Sign In
            </Button>
          </form>

          <div className="login-security-note mt-6 flex items-center justify-center gap-2 text-xs text-warmgray">
            <Shield className="size-3.5 text-gold-dark/80" strokeWidth={2} aria-hidden="true" />
            <span>Authorized clinic personnel only.</span>
          </div>

            </div>
          </div>

        </div>
      </section>
      </div>
    </div>
  )
}
