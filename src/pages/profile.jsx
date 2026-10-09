import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import {
  Check,
  CheckCircle2,
  Clock3,
  Download,
  Eye,
  EyeOff,
  KeyRound,
  LockKeyhole,
  Mail,
  Monitor,
  Moon,
  Palette,
  Save,
  ShieldCheck,
  Smartphone,
  Sun,
  UserRound,
} from 'lucide-react'
import { PageHeader, SectionTitle } from '@/components/layout/page-header'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ChoiceGroup } from '@/components/ui/choice-group'
import { Input } from '@/components/ui/input'
import { PAYMENT_METHODS } from '@/lib/constants'
import { getDefaultPaymentMethod, saveDefaultPaymentMethod } from '@/lib/user-preferences'
import {
  disableTotpFactor,
  discardUnverifiedTotpFactor,
  enrollTotpFactor,
  hasRecentSignIn,
  listTotpFactors,
  signOutOtherSessions,
  updatePassword,
  verifyTotpFactor,
} from '@/services/auth.service'
import { createDatabaseBackup } from '@/services/backup.service'
import { isSupabaseConfigured } from '@/lib/supabase'
import { useAuth } from '@/hooks/use-auth'
import { useConfirm } from '@/hooks/use-confirm'
import { useResultDialog } from '@/hooks/use-result-dialog'
import { useSupabaseHealth } from '@/hooks/use-supabase-health'
import { useTheme } from '@/hooks/use-theme'
import { AppError } from '@/utils/errors'

const PHONE_PATTERN = /^\+?[0-9]{10,15}$/

const THEME_OPTIONS = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor },
]

function getPasswordStrength(password) {
  if (!password) return { score: 0, label: 'Enter a password' }
  const checks = [
    password.length >= 8,
    password.length >= 12,
    /[a-z]/.test(password) && /[A-Z]/.test(password),
    /[0-9]/.test(password) && /[^A-Za-z0-9]/.test(password),
  ]
  const score = checks.filter(Boolean).length
  const labels = ['Weak', 'Weak', 'Fair', 'Good', 'Strong']
  return { score, label: labels[score] }
}

function formatSignInTime(value) {
  if (!value) return 'No sign-in time available'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'No sign-in time available'
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date)
}

export default function ProfilePage() {
  const { profile, session, saveProfile, userId } = useAuth()
  const { preference: themePreference, setTheme } = useTheme()
  const confirm = useConfirm()
  const resultDialog = useResultDialog()
  const { isOnline } = useSupabaseHealth()
  const navigate = useNavigate()
  const location = useLocation()
  const [profileDraft, setProfileDraft] = useState(null)
  const [savingProfile, setSavingProfile] = useState(false)
  const [defaultPaymentMethod, setDefaultPaymentMethod] = useState(() =>
    getDefaultPaymentMethod(userId),
  )
  const [savedPaymentMethod, setSavedPaymentMethod] = useState(() =>
    getDefaultPaymentMethod(userId),
  )
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [savingPassword, setSavingPassword] = useState(false)
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [totpFactors, setTotpFactors] = useState([])
  const [pendingTotpEnrollment, setPendingTotpEnrollment] = useState(null)
  const [totpCode, setTotpCode] = useState('')
  const [loadingMfa, setLoadingMfa] = useState(true)
  const [mfaLoadError, setMfaLoadError] = useState('')
  const [securityBusy, setSecurityBusy] = useState(false)
  const [backupLoading, setBackupLoading] = useState(false)

  const profileValues = {
    full_name: profile?.full_name ?? '',
    job_title: profile?.job_title ?? '',
    phone: profile?.phone ?? '',
  }
  const profileForm = profileDraft ?? profileValues
  const role = profile?.role === 'admin' ? 'admin' : 'staff'
  const email = profile?.email ?? session?.user?.email ?? ''
  const profileChanged = Object.keys(profileValues).some(
    (key) => profileForm[key] !== profileValues[key],
  )
  const preferencesChanged = defaultPaymentMethod !== savedPaymentMethod
  const passwordChanged = Boolean(currentPassword || newPassword || confirmPassword)
  const hasUnsavedChanges = profileChanged || preferencesChanged || passwordChanged
  const recentSignIn = hasRecentSignIn(session)
  const passwordStrength = getPasswordStrength(newPassword)
  const mfaLoading = isSupabaseConfigured && loadingMfa
  const phoneValue = profileForm.phone.trim()
  const phoneError = phoneValue && !PHONE_PATTERN.test(phoneValue)
    ? 'Enter 10 to 15 digits, with an optional leading +.'
    : ''
  const verifiedTotpFactor = totpFactors.find((factor) => factor.status === 'verified')
  const unverifiedTotpFactor = totpFactors.find((factor) => factor.status === 'unverified')

  useEffect(() => {
    let active = true
    if (!isSupabaseConfigured) return undefined

    void listTotpFactors()
      .then((factors) => {
        if (active) setTotpFactors(factors)
      })
      .catch((caught) => {
        if (active) setMfaLoadError(caught?.message || 'Could not load MFA settings.')
      })
      .finally(() => {
        if (active) setLoadingMfa(false)
      })

    return () => {
      active = false
    }
  }, [userId])

  const saveProfileAction = async (changes) => {
    setSavingProfile(true)
    try {
      await saveProfile(changes)
      setProfileDraft(null)
      resultDialog.success({ title: 'Profile updated', message: 'Your profile was updated successfully.' })
    } catch (caught) {
      resultDialog.error({
        title: 'Could not update your profile',
        message: caught instanceof AppError ? caught.message : 'Please check your connection and try again.',
        details: caught?.cause?.message ?? caught?.message,
        retryLabel: 'Try again',
        onRetry: () => saveProfileAction(changes),
      })
    } finally {
      setSavingProfile(false)
    }
  }

  const handleSaveProfile = async (event) => {
    event.preventDefault()
    if (!isOnline) return
    const changes = {
      full_name: profileForm.full_name.trim(),
      job_title: profileForm.job_title.trim(),
      phone: phoneValue,
    }
    if (!changes.full_name) {
      toast.error('Enter your name before saving.')
      return
    }
    if (phoneError) {
      toast.error(phoneError)
      return
    }

    void confirm({
      title: 'Save profile changes?',
      message: 'Update your name, job title, and phone number for this account?',
      confirmLabel: 'Save profile',
      variant: 'default',
      onConfirm: () => saveProfileAction(changes),
      errorMessage: 'Could not update your profile. Please try again.',
    })
  }

  const savePreferencesAction = () => {
    try {
      saveDefaultPaymentMethod(defaultPaymentMethod, userId)
      setSavedPaymentMethod(defaultPaymentMethod)
      resultDialog.success({ title: 'Preferences saved', message: 'Your default payment method was updated.' })
    } catch (caught) {
      resultDialog.error({
        title: 'Could not save preferences',
        message: 'Please try again.',
        details: caught?.message,
        retryLabel: 'Try again',
        onRetry: savePreferencesAction,
      })
    }
  }

  const handleSavePreferences = (event) => {
    event.preventDefault()
    void confirm({
      title: 'Save visit preferences?',
      message: `Update the default payment method to ${defaultPaymentMethod} for future visits?`,
      confirmLabel: 'Save preferences',
      variant: 'default',
      onConfirm: savePreferencesAction,
      errorMessage: 'Could not save these preferences. Please try again.',
    })
  }

  const savePasswordAction = async (password, reauthenticationPassword) => {
    setSavingPassword(true)
    try {
      await updatePassword(password, reauthenticationPassword)
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      resultDialog.success({ title: 'Password updated', message: 'Your password was changed successfully.' })
    } catch (caught) {
      resultDialog.error({
        title: 'Could not update your password',
        message: caught instanceof AppError ? caught.message : 'Please check the password and try again.',
        details: caught?.cause?.message ?? caught?.message,
        retryLabel: 'Try again',
        onRetry: () => savePasswordAction(password, reauthenticationPassword),
      })
    } finally {
      setSavingPassword(false)
    }
  }

  const handleSavePassword = async (event) => {
    event.preventDefault()
    if (!isOnline) return
    if (newPassword.length < 8) {
      toast.error('Use a password with at least 8 characters.')
      return
    }
    if (newPassword !== confirmPassword) {
      toast.error('The passwords do not match.')
      return
    }
    if (!recentSignIn && !currentPassword) {
      toast.error('Enter your current password to continue.')
      return
    }

    void confirm({
      title: 'Update your password?',
      message: 'This will change the password for your staff account.',
      confirmLabel: 'Update password',
      variant: 'default',
      onConfirm: () => savePasswordAction(newPassword, currentPassword),
      errorMessage: 'Could not update your password. Please try again.',
    })
  }

  const showSecurityError = (title, caught) => {
    resultDialog.error({
      title,
      message: caught instanceof AppError ? caught.message : caught?.message || 'Please try again.',
      details: caught?.cause?.message,
      retryLabel: 'Try again',
    })
  }

  const reloadTotpFactors = async () => {
    const factors = await listTotpFactors()
    setTotpFactors(factors)
    setMfaLoadError('')
  }

  const handleBeginMfaSetup = () => {
    void confirm({
      title: 'Set up authenticator MFA?',
      message: 'Scan a QR code with your authenticator app and verify a code. Other signed-in devices will be signed out after setup.',
      confirmLabel: 'Set up MFA',
      variant: 'default',
      onConfirm: async () => {
        setSecurityBusy(true)
        try {
          const factor = await enrollTotpFactor()
          setPendingTotpEnrollment(factor)
          setTotpCode('')
        } catch (caught) {
          showSecurityError('Could not start MFA setup', caught)
        } finally {
          setSecurityBusy(false)
        }
      },
    })
  }

  const handleVerifyMfaSetup = async (event) => {
    event.preventDefault()
    if (!pendingTotpEnrollment || !/^\d{6}$/.test(totpCode)) {
      toast.error('Enter the 6-digit code from your authenticator app.')
      return
    }

    setSecurityBusy(true)
    try {
      await verifyTotpFactor(pendingTotpEnrollment.id, totpCode)
      await reloadTotpFactors()
      setPendingTotpEnrollment(null)
      setTotpCode('')
      resultDialog.success({
        title: 'MFA enabled',
        message: 'Authenticator verification is enabled for this account. Other sessions may need to sign in again.',
      })
    } catch (caught) {
      showSecurityError('Could not verify authenticator code', caught)
    } finally {
      setSecurityBusy(false)
    }
  }

  const handleDisableMfa = (factorId) => {
    if (!/^\d{6}$/.test(totpCode)) {
      toast.error('Enter the 6-digit code from your authenticator app.')
      return
    }

    void confirm({
      title: 'Disable authenticator MFA?',
      message: 'This removes the authenticator factor from your account. You will still need to verify the current code.',
      confirmLabel: 'Disable MFA',
      variant: 'danger',
      onConfirm: async () => {
        setSecurityBusy(true)
        try {
          await disableTotpFactor(factorId, totpCode)
          await reloadTotpFactors()
          setTotpCode('')
          resultDialog.success({ title: 'MFA disabled', message: 'Authenticator verification was removed.' })
        } catch (caught) {
          showSecurityError('Could not disable MFA', caught)
        } finally {
          setSecurityBusy(false)
        }
      },
    })
  }

  const handleDiscardUnverifiedFactor = () => {
    if (!unverifiedTotpFactor) return
    void confirm({
      title: 'Restart authenticator setup?',
      message: 'This removes the unfinished authenticator setup so you can generate a new QR code.',
      confirmLabel: 'Restart setup',
      variant: 'danger',
      onConfirm: async () => {
        setSecurityBusy(true)
        try {
          await discardUnverifiedTotpFactor(unverifiedTotpFactor.id)
          await reloadTotpFactors()
        } catch (caught) {
          showSecurityError('Could not restart authenticator setup', caught)
        } finally {
          setSecurityBusy(false)
        }
      },
    })
  }

  const handleSignOutOtherSessions = () => {
    void confirm({
      title: 'Sign out other devices?',
      message: 'All other sessions for this staff account will be signed out. This device will stay signed in.',
      confirmLabel: 'Sign out other devices',
      variant: 'danger',
      onConfirm: async () => {
        setSecurityBusy(true)
        try {
          await signOutOtherSessions()
          resultDialog.success({
            title: 'Other sessions signed out',
            message: 'This device remains signed in.',
          })
        } catch (caught) {
          showSecurityError('Could not sign out other devices', caught)
        } finally {
          setSecurityBusy(false)
        }
      },
    })
  }

  const handleBackup = () => {
    void confirm({
      title: 'Download a clinic backup?',
      message: 'This creates a ZIP containing CSV exports of clinic tables, including patient and payment data. Store it securely.',
      confirmLabel: 'Create backup',
      variant: 'danger',
      onConfirm: async () => {
        setBackupLoading(true)
        try {
          const archive = await createDatabaseBackup()
          const url = URL.createObjectURL(new Blob([archive], { type: 'application/zip' }))
          const anchor = document.createElement('a')
          anchor.href = url
          anchor.download = `eye-troops-backup-${new Date().toISOString().slice(0, 10)}.zip`
          document.body.append(anchor)
          anchor.click()
          anchor.remove()
          window.setTimeout(() => URL.revokeObjectURL(url), 1000)
          resultDialog.success({
            title: 'Backup downloaded',
            message: 'The ZIP contains one CSV file per clinic table.',
          })
        } catch (caught) {
          showSecurityError('Could not create backup', caught)
        } finally {
          setBackupLoading(false)
        }
      },
    })
  }

  useEffect(() => {
    if (!hasUnsavedChanges) return undefined

    const currentUrl = `${location.pathname}${location.search}${location.hash}`
    const beforeUnload = (event) => {
      event.preventDefault()
      event.returnValue = ''
    }
    const handlePopState = (event) => {
      if (window.confirm('You have unsaved changes. Leave this page and discard them?')) return
      event.stopImmediatePropagation()
      window.history.pushState(window.history.state, '', currentUrl)
    }
    const handleInternalNavigation = (event) => {
      if (
        event.defaultPrevented
        || event.button !== 0
        || event.metaKey
        || event.ctrlKey
        || event.shiftKey
        || event.altKey
      ) return

      const anchor = event.target.closest?.('a[href]')
      if (!anchor || anchor.target === '_blank' || anchor.hasAttribute('download')) return

      const destination = new URL(anchor.href, window.location.href)
      if (destination.origin !== window.location.origin) return
      const nextLocation = `${destination.pathname}${destination.search}${destination.hash}`
      if (nextLocation === currentUrl) return

      event.preventDefault()
      event.stopImmediatePropagation()
      void confirm({
        title: 'Discard unsaved changes?',
        message: 'Your profile, preferences, or password edits have not been saved.',
        confirmLabel: 'Leave page',
        variant: 'danger',
      }).then((approved) => {
        if (approved) navigate(nextLocation)
      })
    }

    window.addEventListener('beforeunload', beforeUnload)
    window.addEventListener('popstate', handlePopState, true)
    document.addEventListener('click', handleInternalNavigation, true)
    return () => {
      window.removeEventListener('beforeunload', beforeUnload)
      window.removeEventListener('popstate', handlePopState, true)
      document.removeEventListener('click', handleInternalNavigation, true)
    }
  }, [confirm, hasUnsavedChanges, location.hash, location.pathname, location.search, navigate])

  return (
    <>
      <PageHeader
        title="Profile & Settings"
        description="Manage your staff account and everyday clinic preferences."
      />

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(20rem,0.85fr)]">
        <div className="space-y-6">
          <section>
            <SectionTitle description="Your staff identity in the clinic system.">
              Personal profile
            </SectionTitle>
            <Card className="p-5 sm:p-6">
              <div className="mb-5 flex items-center gap-3 border-b border-champagne pb-5">
                <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-gold-light text-gold-dark">
                  <UserRound className="size-6" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <p className="truncate font-display text-lg font-semibold text-espresso">
                    {profileForm.full_name || 'Staff profile'}
                  </p>
                  <span className="mt-1 inline-flex rounded-md bg-gold-light px-2 py-0.5 text-[11px] font-semibold text-gold-dark">
                    {role === 'admin' ? 'Admin' : 'Staff'}
                  </span>
                </div>
              </div>

              <form onSubmit={handleSaveProfile} className="space-y-4">
                <Input
                  id="profile-name"
                  label="Full name"
                  autoComplete="name"
                  value={profileForm.full_name}
                  onChange={(event) => setProfileDraft({ ...profileForm, full_name: event.target.value })}
                  required
                />
                <Input
                  id="profile-job-title"
                  label="Job title"
                  autoComplete="organization-title"
                  placeholder="e.g. Optometrist"
                  value={profileForm.job_title}
                  onChange={(event) => setProfileDraft({ ...profileForm, job_title: event.target.value })}
                />
                <Input
                  id="profile-phone"
                  label="Phone number"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder="e.g. +14155552671"
                  value={profileForm.phone}
                  onChange={(event) => setProfileDraft({ ...profileForm, phone: event.target.value })}
                  error={phoneError}
                  hint={!phoneError ? '10 to 15 digits, with an optional leading +.' : undefined}
                />
                <Input
                  id="profile-email"
                  label="Email address"
                  type="email"
                  value={email}
                  leading={<Mail className="size-4" aria-hidden="true" />}
                  disabled
                  hint="Email changes are managed through account administration."
                />
                <div className="flex justify-end">
                  <Button
                    type="submit"
                    loading={savingProfile}
                    loadingText="Saving"
                    disabled={!isOnline || !profileChanged || Boolean(phoneError)}
                  >
                    <Save className="size-4" aria-hidden="true" />
                    Save profile
                  </Button>
                </div>
              </form>
            </Card>
          </section>

          <section>
            <SectionTitle description="Choose the initial payment option for new visits.">
              Visit preferences
            </SectionTitle>
            <Card className="p-5 sm:p-6">
              <form onSubmit={handleSavePreferences} className="space-y-5">
                <ChoiceGroup
                  id="default-payment-method"
                  label="Default payment method"
                  value={defaultPaymentMethod}
                  options={PAYMENT_METHODS}
                  onChange={setDefaultPaymentMethod}
                  layout="grid-3"
                  size="compact"
                />
                <div className="flex justify-end">
                  <Button type="submit" variant="outline" disabled={!preferencesChanged}>
                    <Save className="size-4" aria-hidden="true" />
                    Save preferences
                  </Button>
                </div>
              </form>
            </Card>
          </section>
        </div>

        <div className="space-y-6">
          <section>
            <SectionTitle description="The clinic appearance is shared across the system.">
              Appearance
            </SectionTitle>
            <Card className="p-5 sm:p-6">
              <div className="mb-4 flex items-center gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-gold-light text-gold-dark">
                  <Palette className="size-5" aria-hidden="true" />
                </span>
                <div>
                  <p className="text-sm font-semibold text-espresso">Eye TroOps clinic theme</p>
                  <p className="mt-0.5 text-xs text-warmgray">Choose your appearance preference.</p>
                </div>
              </div>
              <ChoiceGroup
                id="theme-preference"
                label="Theme preference"
                value={themePreference}
                options={THEME_OPTIONS}
                onChange={setTheme}
                layout="grid-3"
                size="compact"
                className="profile-theme-choice"
              />
            </Card>
          </section>

          <section>
            <SectionTitle description="Keep your staff account protected.">
              Account security
            </SectionTitle>
            <Card className="p-5 sm:p-6">
              <div className="mb-5 flex items-center gap-2 text-sm font-semibold text-espresso">
                <KeyRound className="size-4 text-gold-dark" aria-hidden="true" />
                Password
              </div>
              <form onSubmit={handleSavePassword} className="space-y-4">
                {!recentSignIn && (
                  <Input
                    id="current-password"
                    label="Current password"
                    type={showCurrentPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    value={currentPassword}
                    onChange={(event) => setCurrentPassword(event.target.value)}
                    trailing={(
                      <button
                        type="button"
                        className="flex size-8 items-center justify-center rounded-md hover:bg-ivory focus-visible:outline-2 focus-visible:outline-gold"
                        aria-label={showCurrentPassword ? 'Hide current password' : 'Show current password'}
                        onClick={() => setShowCurrentPassword((value) => !value)}
                      >
                        {showCurrentPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                      </button>
                    )}
                    required
                  />
                )}
                <Input
                  id="new-password"
                  label="New password"
                  type={showNewPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  hint="Use at least 8 characters."
                  trailing={(
                    <button
                      type="button"
                      className="flex size-8 items-center justify-center rounded-md hover:bg-ivory focus-visible:outline-2 focus-visible:outline-gold"
                      aria-label={showNewPassword ? 'Hide new password' : 'Show new password'}
                      onClick={() => setShowNewPassword((value) => !value)}
                    >
                      {showNewPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  )}
                  required
                />
                {newPassword && (
                  <div aria-live="polite" className="-mt-2">
                    <div className="mb-1 flex items-center justify-between text-xs">
                      <span className="text-warmgray">Password strength</span>
                      <span className="font-medium text-espresso">{passwordStrength.label}</span>
                    </div>
                    <div className="grid grid-cols-4 gap-1" aria-label={`Password strength: ${passwordStrength.label}`}>
                      {[0, 1, 2, 3].map((index) => (
                        <span
                          key={index}
                          className={`h-1.5 rounded-full ${index < passwordStrength.score ? (passwordStrength.score < 2 ? 'bg-error' : passwordStrength.score < 3 ? 'bg-warning' : passwordStrength.score < 4 ? 'bg-gold' : 'bg-success') : 'bg-champagne'}`}
                        />
                      ))}
                    </div>
                  </div>
                )}
                <Input
                  id="confirm-password"
                  label="Confirm new password"
                  type={showConfirmPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  trailing={(
                    <button
                      type="button"
                      className="flex size-8 items-center justify-center rounded-md hover:bg-ivory focus-visible:outline-2 focus-visible:outline-gold"
                      aria-label={showConfirmPassword ? 'Hide confirmation password' : 'Show confirmation password'}
                      onClick={() => setShowConfirmPassword((value) => !value)}
                    >
                      {showConfirmPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  )}
                  required
                />
                {confirmPassword && (
                  <p
                    className={`-mt-2 flex items-center gap-1.5 text-xs ${newPassword === confirmPassword ? 'text-success' : 'text-error'}`}
                    aria-live="polite"
                  >
                    {newPassword === confirmPassword
                      ? <><CheckCircle2 className="size-3.5" aria-hidden="true" /> Passwords match</>
                      : 'Passwords do not match'}
                  </p>
                )}
                {recentSignIn && (
                  <p className="text-xs text-warmgray">Recent sign-in detected. Your current password is not required.</p>
                )}
                <div className="flex justify-end">
                  <Button
                    type="submit"
                    loading={savingPassword}
                    loadingText="Updating"
                    disabled={!isOnline || !passwordChanged}
                  >
                    <KeyRound className="size-4" aria-hidden="true" />
                    Update password
                  </Button>
                </div>
              </form>

              <div className="my-6 border-t border-champagne" />

              <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-espresso">
                <ShieldCheck className="size-4 text-success" aria-hidden="true" />
                Multi-factor authentication
              </div>
              {mfaLoadError && <p className="mb-3 text-sm text-error" role="alert">{mfaLoadError}</p>}
              {!isSupabaseConfigured ? (
                <p className="text-sm text-warmgray">MFA is unavailable until Supabase is configured.</p>
              ) : mfaLoading ? (
                <p className="text-sm text-warmgray">Checking authenticator status…</p>
              ) : pendingTotpEnrollment ? (
                <form onSubmit={handleVerifyMfaSetup} className="space-y-4">
                  <p className="text-sm text-warmgray">Scan this QR code with your authenticator app, then enter its 6-digit code.</p>
                  <img
                    src={pendingTotpEnrollment.totp.qr_code}
                    alt="Authenticator setup QR code"
                    className="mx-auto size-44 rounded-lg border border-champagne bg-white p-2"
                  />
                  <div className="rounded-md bg-ivory p-3 text-xs text-warmgray dark:bg-surface">
                    Can't scan? Enter this key manually: <span className="select-all break-all font-mono text-espresso">{pendingTotpEnrollment.totp.secret}</span>
                  </div>
                  <Input
                    id="enrollment-code"
                    label="Authenticator code"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    value={totpCode}
                    onChange={(event) => setTotpCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                  />
                  <div className="flex justify-end">
                    <Button type="submit" loading={securityBusy} loadingText="Verifying" disabled={!isOnline || totpCode.length !== 6}>
                      <Check className="size-4" aria-hidden="true" />
                      Verify and enable
                    </Button>
                  </div>
                </form>
              ) : verifiedTotpFactor ? (
                <div className="space-y-4">
                  <p className="flex items-center gap-2 text-sm text-success">
                    <CheckCircle2 className="size-4" aria-hidden="true" /> Authenticator MFA is enabled.
                  </p>
                  <Input
                    id="disable-mfa-code"
                    label="Authenticator code to disable MFA"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    value={totpCode}
                    onChange={(event) => setTotpCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                  />
                  <div className="flex justify-end">
                    <Button
                      type="button"
                      variant="outline"
                      loading={securityBusy}
                      loadingText="Disabling"
                      disabled={!isOnline || totpCode.length !== 6}
                      onClick={() => handleDisableMfa(verifiedTotpFactor.id)}
                    >
                      Disable MFA
                    </Button>
                  </div>
                </div>
              ) : unverifiedTotpFactor ? (
                <div className="space-y-3">
                  <p className="text-sm text-warmgray">An unfinished authenticator setup must be restarted before enabling MFA.</p>
                  <Button type="button" variant="outline" loading={securityBusy} disabled={!isOnline} onClick={handleDiscardUnverifiedFactor}>
                    Restart authenticator setup
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm text-warmgray">Add a time-based code from an authenticator app at sign-in.</p>
                  <Button type="button" variant="outline" loading={securityBusy} disabled={!isOnline} onClick={handleBeginMfaSetup}>
                    <Smartphone className="size-4" aria-hidden="true" />
                    Enable authenticator MFA
                  </Button>
                </div>
              )}

              <div className="my-6 border-t border-champagne" />

              <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-espresso">
                <LockKeyhole className="size-4 text-gold-dark" aria-hidden="true" />
                Sessions
              </div>
              <div className="mb-4 flex items-start gap-3">
                <Clock3 className="mt-0.5 size-4 shrink-0 text-warmgray" aria-hidden="true" />
                <div>
                  <p className="text-xs text-warmgray">Last sign-in</p>
                  <p className="text-sm font-medium text-espresso">{formatSignInTime(session?.user?.last_sign_in_at)}</p>
                </div>
              </div>
              <Button type="button" variant="outline" disabled={!isOnline || securityBusy} onClick={handleSignOutOtherSessions}>
                <LockKeyhole className="size-4" aria-hidden="true" />
                Sign out of all other devices
              </Button>

              {role === 'admin' && (
                <>
                  <div className="my-6 border-t border-champagne" />
                  <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-espresso">
                    <Download className="size-4 text-gold-dark" aria-hidden="true" />
                    Data backup
                  </div>
                  <p className="mb-3 text-xs text-warmgray">Download one CSV per clinic table in a ZIP archive.</p>
                  <Button type="button" variant="outline" loading={backupLoading} loadingText="Creating backup" disabled={!isOnline} onClick={handleBackup}>
                    <Download className="size-4" aria-hidden="true" />
                    Backup now
                  </Button>
                </>
              )}
            </Card>
          </section>
        </div>
      </div>
    </>
  )
}