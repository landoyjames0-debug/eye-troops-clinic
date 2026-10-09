import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Mail, Phone, Shield, UserRound, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { AuthBrandPanel } from '@/components/auth/brand-panel'
import { useResultDialog } from '@/hooks/use-result-dialog'
import { classifyConnectivityFailure, toAppError } from '@/utils/errors'

const API_URL = '/api/signup'

const INITIAL_VALUES = {
  fullName: '',
  email: '',
  phone: '',
}

const SIGNUP_COPY = {
  eyebrow: 'JOIN THE EYE TROOPS TEAM',
  headline: 'Your team. Your patients. One clear view.',
  description:
    'Create your staff account to start managing patient records, orders, and daily clinic activity with the rest of the team.',
  features: [
    { icon: UserRound, label: 'Quick setup, ready in minutes' },
    { icon: Users, label: 'Role-based access for every staff member' },
    { icon: Shield, label: 'Patient and payment data kept private and secure' },
  ],
}

function validateField(field, value) {
  const normalizedValue = value.trim()

  if (!normalizedValue) return 'This field is required.'
  if (field === 'fullName' && normalizedValue.length < 2) {
    return 'Enter at least 2 characters.'
  }
  if (field === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedValue)) {
    return 'Enter a valid email address.'
  }
  if (field === 'phone' && !/^\+?\d{10,15}$/.test(normalizedValue)) {
    return 'Enter 10 to 15 digits, with an optional leading +.'
  }

  return ''
}

function validateForm(values) {
  return Object.fromEntries(
    Object.entries(values).map(([field, value]) => [field, validateField(field, value)]),
  )
}

export default function SignUpPage() {
  const [values, setValues] = useState(INITIAL_VALUES)
  const [errors, setErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const resultDialog = useResultDialog()

  function handleChange(event) {
    const { name, value } = event.target
    setValues((current) => ({ ...current, [name]: value }))

    if (errors[name]) {
      setErrors((current) => ({ ...current, [name]: validateField(name, value) }))
    }
  }

  function handleBlur(event) {
    const { name, value } = event.target
    setErrors((current) => ({ ...current, [name]: validateField(name, value) }))
  }

  async function performSignup() {
    setSubmitting(true)
    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: values.fullName.trim(),
          email: values.email.trim(),
          phone: values.phone.trim(),
        }),
      })

      if (!response.ok) {
        let message = 'We could not complete your sign up. Please try again.'
        try {
          const result = await response.json()
          if (typeof result.message === 'string' && result.message.trim()) {
            message = result.message
          }
        } catch {
          // Keep the friendly fallback when the server does not return JSON.
        }
        if (/already registered|already exists|duplicate/i.test(message)) {
          message = 'This email is already registered. Sign in or use a different email address.'
        }
        const requestError = new Error(message)
        requestError.status = response.status
        throw requestError
      }

      setValues(INITIAL_VALUES)
      setErrors({})
      resultDialog.success({
        title: 'Sign-up request received',
        message: 'Thanks for signing up. Your details were submitted successfully.',
        primaryLabel: 'Continue',
        autoCloseMs: 7000,
      })
    } catch (caught) {
      const isConnectivityFailure = Boolean(classifyConnectivityFailure(caught))
      const friendly = isConnectivityFailure ? toAppError(caught, 'signup') : caught
      resultDialog.error({
        title: 'Could not complete sign up',
        message: friendly.message || 'Something went wrong. Please try again.',
        details: isConnectivityFailure ? undefined : caught.message,
        retryLabel: 'Try again',
        onRetry: performSignup,
      })
    } finally {
      setSubmitting(false)
    }
  }

  async function handleSubmit(event) {
    event.preventDefault()
    const nextErrors = validateForm(values)
    setErrors(nextErrors)
    if (Object.values(nextErrors).some(Boolean)) return
    await performSignup()
  }

  return (
    <div className="login-page relative min-h-dvh overflow-hidden">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-linear-to-br from-gold-light via-ivory to-champagne/50" />
      </div>

      <div className="login-shell relative z-10">
        <AuthBrandPanel
          eyebrow={SIGNUP_COPY.eyebrow}
          headline={SIGNUP_COPY.headline}
          description={SIGNUP_COPY.description}
          features={SIGNUP_COPY.features}
        />

        <section className="login-form-panel relative flex flex-1 items-center justify-center px-4 sm:px-8 lg:px-12 xl:px-20">
          <div className="relative w-full max-w-[27rem] sm:max-w-110">
            <div className="login-card overflow-hidden rounded-3xl border border-champagne/80 bg-surface/95 shadow-raised backdrop-blur-sm">
              <div className="login-card-accent h-1 bg-linear-to-r from-gold-light via-gold to-gold-dark" aria-hidden="true" />

              <div className="login-card-content p-6 sm:p-8">
                <div className="mb-6 flex items-center gap-3 border-b border-champagne/70 pb-5">
                  <span className="login-staff-icon flex size-11 items-center justify-center rounded-xl bg-gold-light text-gold-dark">
                    <Shield className="size-5" strokeWidth={1.8} aria-hidden="true" />
                  </span>
                  <div>
                    <p className="login-staff-label text-[11px] font-semibold tracking-wide uppercase">
                      Create an account
                    </p>
                    <p className="login-staff-caption text-[13px] text-warmgray">
                      Sign up to get started
                    </p>
                  </div>
                </div>

                <h1 className="login-form-title font-display text-[28px] leading-[1.15] font-bold sm:text-[30px]">
                  Join Eye Troops
                </h1>
                <p className="login-form-description mt-1.5 text-sm text-warmgray">
                  Create your account with a few details.
                </p>

                <form onSubmit={handleSubmit} className="login-form mt-6 space-y-5 sm:mt-8" noValidate>
                  <Input
                    id="signup-full-name"
                    name="fullName"
                    label="Full Name"
                    type="text"
                    autoComplete="name"
                    placeholder="Enter your full name"
                    leading={<UserRound className="size-4.25" strokeWidth={1.8} />}
                    value={values.fullName}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    error={errors.fullName}
                    required
                    minLength={2}
                    className="login-input"
                  />

                  <Input
                    id="signup-email"
                    name="email"
                    label="Email Address"
                    type="email"
                    autoComplete="email"
                    placeholder="Enter your email address"
                    leading={<Mail className="size-4.25" strokeWidth={1.8} />}
                    value={values.email}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    error={errors.email}
                    required
                    className="login-input"
                  />

                  <Input
                    id="signup-phone"
                    name="phone"
                    label="Phone Number"
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    placeholder="e.g. +14155552671"
                    leading={<Phone className="size-4.25" strokeWidth={1.8} />}
                    value={values.phone}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    error={errors.phone}
                    required
                    className="login-input"
                  />

                  <Button
                    type="submit"
                    loading={submitting}
                    loadingText="Signing up..."
                    className="login-submit w-full"
                  >
                    Sign Up
                  </Button>
                </form>

                <div className="login-security-note mt-6 flex items-center justify-center gap-2 text-xs text-warmgray">
                  <Shield className="size-3.5 text-gold-dark/80" strokeWidth={2} aria-hidden="true" />
                  <span>Your details help us get you started.</span>
                </div>
                <p className="mt-4 text-center text-[13px] text-warmgray">
                  Already have an account?{' '}
                  <Link
                    to="/login"
                    className="login-forgot font-semibold text-gold-dark underline-offset-4 hover:underline"
                  >
                    Sign in
                  </Link>
                </p>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}