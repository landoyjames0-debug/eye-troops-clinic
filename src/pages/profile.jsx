import { useState } from 'react'
import { toast } from 'sonner'
import { KeyRound, Mail, Palette, Save, ShieldCheck, UserRound } from 'lucide-react'
import { PageHeader, SectionTitle } from '@/components/layout/page-header'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ChoiceGroup } from '@/components/ui/choice-group'
import { Input } from '@/components/ui/input'
import { PAYMENT_METHODS } from '@/lib/constants'
import { getDefaultPaymentMethod, saveDefaultPaymentMethod } from '@/lib/user-preferences'
import { updatePassword } from '@/services/auth.service'
import { useAuth } from '@/hooks/use-auth'
import { AppError } from '@/utils/errors'

export default function ProfilePage() {
  const { profile, session, saveProfile, userId } = useAuth()
  const [nameDraft, setNameDraft] = useState(null)
  const [savingProfile, setSavingProfile] = useState(false)
  const [defaultPaymentMethod, setDefaultPaymentMethod] = useState(() =>
    getDefaultPaymentMethod(userId),
  )
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [savingPassword, setSavingPassword] = useState(false)

  const email = profile?.email ?? session?.user?.email ?? ''
  const role = profile?.role ?? 'staff'
  const fullName = nameDraft ?? profile?.full_name ?? ''

  const handleSaveProfile = async (event) => {
    event.preventDefault()
    const name = fullName.trim()
    if (!name) {
      toast.error('Enter your name before saving.')
      return
    }

    setSavingProfile(true)
    try {
      await saveProfile({ full_name: name })
      setNameDraft(null)
      toast.success('Profile updated')
    } catch (caught) {
      toast.error('Could not update your profile', {
        description: caught instanceof AppError ? caught.message : 'Please try again.',
      })
    } finally {
      setSavingProfile(false)
    }
  }

  const handleSavePreferences = (event) => {
    event.preventDefault()
    saveDefaultPaymentMethod(defaultPaymentMethod, userId)
    toast.success('Visit preferences saved')
  }

  const handleSavePassword = async (event) => {
    event.preventDefault()
    if (newPassword.length < 8) {
      toast.error('Use a password with at least 8 characters.')
      return
    }
    if (newPassword !== confirmPassword) {
      toast.error('The passwords do not match.')
      return
    }

    setSavingPassword(true)
    try {
      await updatePassword(newPassword)
      setNewPassword('')
      setConfirmPassword('')
      toast.success('Password updated')
    } catch (caught) {
      toast.error('Could not update your password', {
        description: caught instanceof AppError ? caught.message : 'Please try again.',
      })
    } finally {
      setSavingPassword(false)
    }
  }

  return (
    <>
      <PageHeader
        title="Profile & Settings"
        description="Manage your staff account and everyday clinic preferences."
      />

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(20rem,0.85fr)]">
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
                    {fullName || 'Staff profile'}
                  </p>
                  <p className="mt-0.5 text-xs capitalize text-warmgray">{role} account</p>
                </div>
              </div>

              <form onSubmit={handleSaveProfile} className="space-y-4">
                <Input
                  id="profile-name"
                  label="Full name"
                  autoComplete="name"
                  value={fullName}
                  onChange={(event) => setNameDraft(event.target.value)}
                  required
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
                  <Button type="submit" loading={savingProfile} loadingText="Saving">
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
                  <Button type="submit" variant="outline">
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
            <Card className="flex items-center gap-3 p-5">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-gold-light text-gold-dark">
                <Palette className="size-5" aria-hidden="true" />
              </span>
              <div>
                <p className="text-sm font-semibold text-espresso">Eye TroOps clinic theme</p>
                <p className="mt-0.5 text-xs text-warmgray">Warm ivory, espresso, and gold</p>
              </div>
              <span className="ml-auto rounded-md bg-ivory px-2 py-1 text-[11px] font-medium text-warmgray">
                System
              </span>
            </Card>
          </section>

          <section>
            <SectionTitle description="Keep your staff account protected.">
              Account security
            </SectionTitle>
            <Card className="p-5 sm:p-6">
              <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-espresso">
                <ShieldCheck className="size-4 text-success" aria-hidden="true" />
                Password
              </div>
              <form onSubmit={handleSavePassword} className="space-y-4">
                  <Input
                    id="new-password"
                    label="New password"
                    type="password"
                    autoComplete="new-password"
                    value={newPassword}
                    onChange={(event) => setNewPassword(event.target.value)}
                    hint="Use at least 8 characters."
                    required
                  />
                  <Input
                    id="confirm-password"
                    label="Confirm new password"
                    type="password"
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    required
                  />
                  <div className="flex justify-end">
                    <Button type="submit" loading={savingPassword} loadingText="Updating">
                      <KeyRound className="size-4" aria-hidden="true" />
                      Update password
                    </Button>
                  </div>
              </form>
            </Card>
          </section>
        </div>
      </div>
    </>
  )
}