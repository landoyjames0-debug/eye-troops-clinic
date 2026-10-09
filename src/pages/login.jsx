import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import {
  CalendarCheck,
  Check,
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
import { AuthBrandPanel } from '@/components/auth/brand-panel'
import AnimatedBackground from '@/components/AnimatedBackground'
import CustomCursor from '@/components/CustomCursor'
import { isSupabaseConfigured } from '@/lib/supabase'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/use-auth'
import { useResultDialog } from '@/hooks/use-result-dialog'
import { useSupabaseHealth } from '@/hooks/use-supabase-health'

const REMEMBER_KEY = 'eyetroops.remembered-email'

const LOGIN_COPY = {
  eyebrow: 'EYE TROOPS OPTICAL CLINIC',
  headline: ['Care for every patient.', 'Clarity for every record.'],
  description:
    'Keep patient records, prescriptions, orders, payments, and daily clinic operations organized in one place.',
  features: [
    { icon: Users, label: 'Patient records & visit history' },
    { icon: ClipboardList, label: 'Orders, balances & payments' },
    { icon: CalendarCheck, label: "Today's dashboard & daily activity" },
  ],
}

function validateEmail(value) {
  const email = value.trim()
  if (!email) return 'Enter your email address.'
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'Enter a valid email address.'
  return ''
}

function validatePassword(value) {
  return value ? '' : 'Enter your password.'
}

export default function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { signIn } = useAuth()
  const resultDialog = useResultDialog()
  const { isOnline } = useSupabaseHealth()
  const emailInputRef = useRef(null)
  const passwordInputRef = useRef(null)
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
  const [loading, setLoading] = useState(false)
  const [emailError, setEmailError] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [shake, setShake] = useState(false)
  const [forgotOpen, setForgotOpen] = useState(false)
  const [resetEmail, setResetEmail] = useState(remembered)
  const [resetEmailError, setResetEmailError] = useState('')
  const [resetLoading, setResetLoading] = useState(false)

  const performSignIn = async () => {
    const nextEmailError = validateEmail(email)
    const nextPasswordError = validatePassword(password)
    setEmailError(nextEmailError)
    setPasswordError(nextPasswordError)

    if (nextEmailError || nextPasswordError) {
      if (nextEmailError) emailInputRef.current?.focus()
      else passwordInputRef.current?.focus()
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
      resultDialog.error({
        title: 'Could not sign in',
        message: caught?.message || (window.navigator.onLine
          ? 'Check your email and password, then try again.'
          : 'You appear to be offline. Check your connection and try again.'),
        details: caught?.cause?.message,
        retryLabel: 'Try again',
        onRetry: performSignIn,
      })
      setShake(true)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    await performSignIn()
  }

  const handleEnterSubmit = (event) => {
    if (event.key !== 'Enter') return
    event.preventDefault()
    void handleSubmit(event)
  }

  const handlePasswordReset = async (event) => {
    event.preventDefault()
    setResetEmailError('')

    const validationError = validateEmail(resetEmail)
    if (validationError) {
      setResetEmailError(validationError)
      return
    }

    if (!supabase) {
      resultDialog.error({
        title: 'Password reset unavailable',
        message: 'Supabase is not configured. Please try again after the service is available.',
      })
      return
    }

    setResetLoading(true)
    try {
      const { error: authError } = await supabase.auth.resetPasswordForEmail(resetEmail.trim())
      if (authError) throw authError
      resultDialog.success({
        title: 'Reset email sent',
        message: 'If an account exists for that email, a reset link has been sent.',
        primaryLabel: 'Done',
        autoCloseMs: 6000,
      })
    } catch (caught) {
      resultDialog.error({
        title: 'Could not send reset email',
        message: 'Check your connection and try again.',
        details: caught?.message,
        retryLabel: 'Try again',
        onRetry: () => handlePasswordReset({ preventDefault() {} }),
      })
    } finally {
      setResetLoading(false)
    }
  }

  return (
    <div className="login-page relative min-h-dvh overflow-hidden">
      <AnimatedBackground />
      <CustomCursor />

      <div className="login-shell relative z-10">
      <AuthBrandPanel
        eyebrow={LOGIN_COPY.eyebrow}
        headline={<>{LOGIN_COPY.headline[0]}<br />{LOGIN_COPY.headline[1]}</>}
        description={LOGIN_COPY.description}
        features={LOGIN_COPY.features}
      />

      <section className="login-form-panel relative flex flex-1 items-center justify-center px-4 sm:px-8 lg:px-12 xl:px-20">
        <div className="relative w-full max-w-[27rem] sm:max-w-110">
          <div
            className={`login-card overflow-hidden rounded-3xl border border-champagne/80 bg-surface/95 shadow-raised backdrop-blur-sm${shake ? ' login-card-shake' : ''}`}
            onAnimationEnd={(event) => {
              if (event.animationName === 'login-shake') setShake(false)
            }}
          >
            <div className="login-card-accent h-1 bg-linear-to-r from-gold-light via-gold to-gold-dark" aria-hidden="true" />

            <div className="login-card-content p-6 sm:p-8">
          <div className="hidden items-center gap-3 border-b border-champagne/70 pb-5 lg:flex">
            <span className="flex size-11 items-center justify-center rounded-xl bg-linear-to-br from-gold-light to-champagne text-gold-dark">
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
              className="mt-5 flex items-start gap-2.5 rounded-control border border-success/25 bg-success/5 px-3.5 py-2.5 text-[13px] text-success"
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
              leading={<Mail className="size-4.25" strokeWidth={1.8} />}
              value={email}
              inputRef={emailInputRef}
              onChange={(event) => {
                const nextEmail = event.target.value
                setEmail(nextEmail)
                if (emailError) setEmailError(validateEmail(nextEmail))
              }}
              onKeyDown={handleEnterSubmit}
              onBlur={(event) => setEmailError(validateEmail(event.target.value))}
              autoFocus={!remembered}
              error={emailError}
              required
              className="login-input"
            />

            <Input
              id="password"
              label="Password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              placeholder="Enter your password"
              leading={<LockKeyhole className="size-4.25" strokeWidth={1.8} />}
              value={password}
              inputRef={passwordInputRef}
              onChange={(event) => {
                setPassword(event.target.value)
                setPasswordError(validatePassword(event.target.value))
              }}
              onKeyDown={handleEnterSubmit}
              error={passwordError}
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
                    <EyeOff className="size-4.5" strokeWidth={1.7} aria-hidden="true" />
                  ) : (
                    <Eye className="size-4.5" strokeWidth={1.7} aria-hidden="true" />
                  )}
                </button>
              }
            />

            <div className="login-form-options flex flex-wrap items-center justify-between gap-3">
              <label className="login-remember flex cursor-pointer items-center gap-2 text-[13px] text-warmgray select-none">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(event) => setRemember(event.target.checked)}
                  className="sr-only"
                />
                <span
                  aria-hidden="true"
                  className={`inline-flex size-4 shrink-0 items-center justify-center rounded border transition-colors duration-150 ${
                    remember
                      ? 'border-gold-dark bg-gold-dark'
                      : 'border-champagne bg-transparent'
                  }`}
                >
                  {remember && (
                    <Check
                      className="size-2.5 text-white"
                      strokeWidth={3}
                      aria-hidden="true"
                    />
                  )}
                </span>
                Remember me
              </label>

              <button
                type="button"
                onClick={() => {
                  setForgotOpen((open) => !open)
                  setResetEmail(email)
                  setResetEmailError('')
                }}
                aria-expanded={forgotOpen}
                aria-controls={forgotOpen ? 'password-reset-panel' : undefined}
                className="login-forgot text-[13px] font-medium text-gold-dark underline-offset-4 hover:underline"
              >
                Forgot password?
              </button>
            </div>

            {!isSupabaseConfigured && (
              <p className="login-notice" role="status">
                Supabase is not configured. Add the project URL and API key to .env.local, then restart the app.
              </p>
            )}

            <Button
              type="submit"
              loading={loading}
              loadingText="Signing in..."
              disabled={!isSupabaseConfigured || !isOnline}
              className="login-submit w-full"
            >
              <LogIn className="size-4" aria-hidden="true" />
              Sign In
            </Button>
          </form>

          {forgotOpen && (
            <form
              id="password-reset-panel"
              onSubmit={handlePasswordReset}
              className="login-reset-panel mt-4 space-y-4 rounded-control border border-champagne bg-surface p-4"
              aria-labelledby="password-reset-title"
            >
              <div>
                <h2 id="password-reset-title" className="text-sm font-semibold text-espresso">
                  Reset your password
                </h2>
                <p className="mt-1 text-xs text-warmgray">
                  Enter your email and we’ll send a reset link if an account exists.
                </p>
              </div>
              <Input
                id="reset-email"
                label="Email Address"
                type="email"
                autoComplete="email"
                placeholder="Enter your email address"
                value={resetEmail}
                onChange={(event) => {
                  setResetEmail(event.target.value)
                  setResetEmailError('')
                }}
                onBlur={(event) => setResetEmailError(validateEmail(event.target.value))}
                error={resetEmailError}
                required
                className="login-input"
              />
              {!isSupabaseConfigured && (
                <p className="login-notice text-xs" role="status">
                  Password reset is unavailable until Supabase is configured.
                </p>
              )}
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setForgotOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" loading={resetLoading} loadingText="Sending..." disabled={!isSupabaseConfigured || !isOnline}>
                  Send reset link
                </Button>
              </div>
            </form>
          )}

          <Button asChild variant="outline" className="mt-3 w-full">
            <Link to="/signup">Create an account</Link>
          </Button>

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
