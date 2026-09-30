import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  CalendarCheck,
  CheckCircle2,
  ClipboardList,
  Eye,
  EyeOff,
  LogIn,
  Shield,
  Users,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ErrorNote } from '@/components/ui/feedback'
import { APP_NAME, APP_SUBTITLE, IS_SUPABASE_CONFIGURED, LOGO_PATH } from '@/lib/constants'
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
    <div className="relative min-h-dvh overflow-hidden">
      {/* Ambient background — full viewport so mobile never feels like a blank white sheet. */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-gradient-to-br from-gold-light via-ivory to-champagne/50" />
        <div
          className="absolute inset-0 opacity-[0.45]"
          style={{
            backgroundImage:
              'radial-gradient(circle at 1px 1px, rgb(212 153 58 / 0.11) 1px, transparent 0)',
            backgroundSize: '28px 28px',
          }}
        />
        <span className="absolute -top-24 right-[10%] size-[22rem] rounded-full bg-gold/15 blur-3xl" />
        <span className="absolute top-[35%] -left-20 size-[18rem] rounded-full bg-gold-light blur-3xl" />
        <span className="absolute -bottom-32 right-[20%] size-[26rem] rounded-full bg-champagne/70 blur-3xl" />
      </div>

      <div className="relative lg:grid lg:min-h-dvh lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
      {/* Brand panel — hidden on small screens, where the logo moves above the form. */}
      <section className="relative hidden overflow-hidden border-r border-champagne/70 bg-gradient-to-br from-gold-light/40 via-ivory/80 to-transparent px-10 py-12 lg:flex lg:flex-col lg:justify-between xl:px-16">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
          <span className="absolute -top-40 -left-40 size-[30rem] rounded-full border border-gold/20" />
          <span className="absolute -top-24 -left-24 size-[22rem] rounded-full border border-gold/12" />
          <span className="absolute -bottom-52 -right-40 size-[34rem] rounded-full border border-gold/15" />
          <span className="absolute -bottom-36 -right-24 size-[24rem] rounded-full border border-gold/10" />
        </div>

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

        <div className="relative mx-auto max-w-lg flex-1 py-10 text-center lg:flex lg:flex-col lg:justify-center">
          <p className="text-[11px] font-semibold tracking-[0.15em] text-gold-dark uppercase mb-4">
            EYE TROOPS OPTICAL CLINIC
          </p>
          <h2 className="font-display text-[32px] lg:text-[36px] xl:text-[40px] leading-[1.15] font-semibold tracking-tight text-espresso mb-6">
            Care for every patient.<br />
            Clarity for every record.
          </h2>
          <p className="text-[15px] lg:text-[16px] leading-relaxed text-warmgray max-w-md mx-auto">
            Keep patient records, prescriptions, orders, payments, and daily clinic operations organized in one place.
          </p>
        </div>

        {/* Subtle gold accent line — decorative, not competing. */}
        <div aria-hidden="true" className="absolute bottom-12 left-10 right-10 xl:left-16 xl:right-16 h-px bg-gradient-to-r from-transparent via-gold/30 to-transparent" />
      </section>

      <section className="relative flex min-h-[calc(100dvh-0px)] items-center justify-center px-4 py-10 sm:px-8 sm:py-14 lg:min-h-dvh lg:px-12 xl:px-20">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 hidden overflow-hidden lg:block"
        >
          <span className="absolute top-[15%] right-[8%] size-48 rounded-full border border-gold/15" />
          <span className="absolute bottom-[20%] left-[12%] size-32 rounded-full border border-champagne/80" />
        </div>

        <div className="relative w-full max-w-[420px]">
          <div className="overflow-hidden rounded-[var(--radius-card)] border border-champagne/80 bg-surface/95 shadow-raised backdrop-blur-sm">
            <div
              className="h-[3px] bg-gradient-to-r from-gold-light via-gold to-gold-dark"
              aria-hidden="true"
            />

            <div className="p-6 sm:p-8">
          {/* Logo above the form on small screens. */}
          <div className="mb-8 flex flex-col items-center gap-3 text-center lg:hidden">
            <img
              src={LOGO_PATH}
              alt=""
              width={40}
              height={40}
              className="size-10 shrink-0 rounded-lg object-contain"
            />
            <div className="leading-tight">
              <p className="font-display text-base font-extrabold tracking-tight text-espresso">
                {APP_NAME}
              </p>
              <p className="text-[9px] font-semibold tracking-[0.2em] text-gold">
                {APP_SUBTITLE}
              </p>
            </div>
            {/* Shortened brand statement on mobile. */}
            <div className="mt-4 max-w-xs mx-auto">
              <p className="text-[10px] font-semibold tracking-[0.15em] text-gold-dark uppercase mb-2">
                EYE TROOPS OPTICAL CLINIC
              </p>
              <p className="font-display text-[18px] leading-[1.2] font-semibold tracking-tight text-espresso mb-3">
                Care for every patient.<br />
                Clarity for every record.
              </p>
              <p className="text-[13px] leading-relaxed text-warmgray">
                Patient records, prescriptions, orders, payments, and daily operations — organized.
              </p>
            </div>
          </div>

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

          <form onSubmit={handleSubmit} className="mt-6 space-y-5 sm:mt-8" noValidate>
            <Input
              id="email"
              label="Email Address"
              type="email"
              autoComplete="username"
              placeholder="Enter your email address"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoFocus={!remembered}
              required
            />

            <Input
              id="password"
              label="Password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              placeholder="Enter your password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              trailing={
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  aria-pressed={showPassword}
                  className="rounded p-1.5 text-warmgray transition-colors hover:text-espresso"
                >
                  {showPassword ? (
                    <EyeOff className="size-[18px]" strokeWidth={1.7} aria-hidden="true" />
                  ) : (
                    <Eye className="size-[18px]" strokeWidth={1.7} aria-hidden="true" />
                  )}
                </button>
              }
            />

            <div className="flex flex-wrap items-center justify-between gap-3">
              <label className="flex cursor-pointer items-center gap-2 text-[13px] text-warmgray">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(event) => setRemember(event.target.checked)}
                  className="size-4 rounded border-champagne accent-[var(--color-gold-dark)]"
                />
                Remember me
              </label>

              <button
                type="button"
                onClick={() =>
                  setNotice('Please ask a clinic administrator to reset your password.')
                }
                className="text-[13px] font-medium text-gold-dark underline-offset-4 hover:underline"
              >
                Forgot password?
              </button>
            </div>

            {error && <ErrorNote message={error} />}

            {notice && (
              <p
                className="rounded-[var(--radius-control)] border border-champagne bg-ivory/80 px-3.5 py-2.5 text-[13px] text-warmgray"
                role="status"
              >
                {notice}
              </p>
            )}

            <Button type="submit" loading={loading} loadingText="Signing in..." className="w-full">
              <LogIn className="size-4" aria-hidden="true" />
              Sign In
            </Button>
          </form>

          <div className="mt-6 flex items-center justify-center gap-2 text-xs text-warmgray">
            <Shield className="size-3.5 text-gold-dark/80" strokeWidth={2} aria-hidden="true" />
            <span>Authorized clinic personnel only.</span>
          </div>

          {!IS_SUPABASE_CONFIGURED && (
            <div className="mt-4 rounded-[var(--radius-control)] border border-gold/25 bg-gradient-to-br from-gold-light/50 to-ivory px-3.5 py-3">
              <p className="text-[11px] font-semibold tracking-wide text-gold-dark uppercase">
                Sample data mode
              </p>
              <p className="mt-1.5 text-[12px] leading-relaxed text-warmgray">
                Email{' '}
                <span className="tabular font-semibold text-espresso">demo@eyetroops.ph</span>
                <br />
                Password <span className="tabular font-semibold text-espresso">demo1234</span>
              </p>
            </div>
          )}
            </div>
          </div>

          <ul className="mt-6 hidden space-y-2.5 lg:block">
            {LOGIN_FEATURES.map(({ icon: Icon, label }) => (
              <li
                key={label}
                className="flex items-center gap-3 rounded-lg border border-champagne/60 bg-surface/80 px-3.5 py-2.5 text-[12px] text-warmgray shadow-sm"
              >
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-gold-light/80 text-gold-dark">
                  <Icon className="size-4" strokeWidth={1.8} aria-hidden="true" />
                </span>
                {label}
              </li>
            ))}
          </ul>
        </div>
      </section>
      </div>
    </div>
  )
}
