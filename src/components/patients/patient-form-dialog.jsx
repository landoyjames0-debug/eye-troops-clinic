import { useState, useMemo } from 'react'
import { toast } from 'sonner'
import { Archive, UserRoundPlus } from 'lucide-react'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input, Textarea } from '@/components/ui/input'
import { ErrorNote } from '@/components/ui/feedback'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import {
  archivePatient,
  createPatient,
  findPatientByMobile,
  updatePatient,
} from '@/services/patients.service'
import { AppError } from '@/utils/errors'

function blankForm(patient) {
  return {
    full_name: patient?.full_name ?? '',
    cp_number: patient?.cp_number ?? '',
    address: patient?.address ?? '',
    notes: patient?.notes ?? '',
  }
}

function formEquals(a, b) {
  return (
    a.full_name === b.full_name &&
    a.cp_number === b.cp_number &&
    a.address === b.address &&
    a.notes === b.notes
  )
}

/**
 * Create or edit a patient. The mobile number is the human key for a record, so
 * a collision is surfaced as a warning and never a hard block — two family
 * members legitimately share one number.
 */
export function PatientFormDialog({ open, patient = null, onClose, onSaved }) {
  const isEdit = Boolean(patient)
  const [initialForm] = useState(() => blankForm(patient))
  const [form, setForm] = useState(() => blankForm(patient))
  const [errors, setErrors] = useState({})
  const [duplicate, setDuplicate] = useState(null)
  const [saving, setSaving] = useState(false)
  const [confirmArchive, setConfirmArchive] = useState(false)
  const [archiving, setArchiving] = useState(false)

  const hasUnsavedChanges = useMemo(
    () => !formEquals(form, initialForm),
    [form, initialForm]
  )

  const handleClose = () => {
    if (saving || archiving) return
    if (hasUnsavedChanges) {
      // The ConfirmDialog will handle the unsaved changes confirmation
      // For now, we'll just prevent closing if there are unsaved changes
      // A more sophisticated implementation could use a nested ConfirmDialog
      return
    }
    onClose()
  }

  const persist = async () => {
    setSaving(true)
    try {
      if (isEdit) {
        await updatePatient(patient.id, form)
        toast.success('Patient updated')
      } else {
        await createPatient(form)
        toast.success('Patient added')
      }
      onSaved()
      onClose()
    } catch (caught) {
      toast.error('Could not save the patient', {
        description: caught instanceof AppError ? caught.message : 'Please try again.',
      })
    } finally {
      setSaving(false)
    }
  }

  const handleSubmit = async (event) => {
    event.preventDefault()

    const nextErrors = {}
    if (!form.full_name.trim()) nextErrors.full_name = 'Patient name is required.'
    if (!form.cp_number.trim()) nextErrors.cp_number = 'Mobile number is required.'
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return

    if (!duplicate) {
      try {
        const existing = await findPatientByMobile(form.cp_number)
        if (existing && existing.id !== patient?.id) {
          setDuplicate(existing)
          return
        }
      } catch {
        // A failed lookup must never block saving a record.
      }
    }

    await persist()
  }

  const handleArchive = async () => {
    setArchiving(true)
    try {
      await archivePatient(patient.id)
      toast.success('Patient archived')
      onSaved()
      setConfirmArchive(false)
      onClose()
    } catch (caught) {
      toast.error('Could not archive the patient', {
        description: caught instanceof AppError ? caught.message : 'Please try again.',
      })
    } finally {
      setArchiving(false)
    }
  }

  if (!open) return null

  return (
    <>
      <Dialog
        open
        onOpenChange={handleClose}
      >
        <DialogContent
          title={isEdit ? 'Edit Patient' : 'Add Patient'}
          description={
            isEdit
              ? 'Update contact details and clinic notes.'
              : 'Record a new patient and their mobile number.'
          }
          size="lg"
          footer={
            <>
              <Button type="button" variant="outline" onClick={handleClose} disabled={saving || archiving}>
                Cancel
              </Button>
              <Button
                type="submit"
                form="patient-form"
                loading={saving}
                loadingText="Saving"
              >
                {!isEdit && <UserRoundPlus className="size-4" aria-hidden="true" />}
                {duplicate ? 'Save Anyway' : isEdit ? 'Save Changes' : 'Add Patient'}
              </Button>
            </>
          }
        >
          <form id="patient-form" onSubmit={handleSubmit} className="space-y-4" noValidate>
            {errors._general && <ErrorNote message={errors._general} />}

            <Input
              id="full_name"
              label="Full Name *"
              autoFocus
              value={form.full_name}
              onChange={(event) => setForm((prev) => ({ ...prev, full_name: event.target.value }))}
              error={errors.full_name}
              required
            />

            <Input
              id="cp_number"
              label="Mobile Number *"
              inputMode="tel"
              placeholder="0917 000 0000"
              value={form.cp_number}
              onChange={(event) => {
                setDuplicate(null)
                setForm((prev) => ({ ...prev, cp_number: event.target.value }))
              }}
              error={errors.cp_number}
              hint="Used as the record's CP number."
              required
            />

            <Input
              id="address"
              label="Address"
              value={form.address}
              onChange={(event) => setForm((prev) => ({ ...prev, address: event.target.value }))}
            />

            <Textarea
              id="notes"
              label="Notes"
              placeholder="Preferences, conditions, reminders…"
              value={form.notes}
              onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))}
            />

            {duplicate && (
              <ErrorNote
                message={`A patient with this mobile number already exists: ${duplicate.full_name}. Saving will create a second record.`}
              />
            )}
          </form>

          {isEdit && (
            <div className="mt-5 flex items-start justify-between gap-4 rounded-[var(--radius-control)] border border-champagne bg-ivory px-4 py-3.5">
              <div className="min-w-0">
                <p className="text-[13px] font-medium text-espresso">Archive Patient</p>
                <p className="mt-0.5 text-[12px] text-warmgray">
                  Hides them from the roster. Visit and payment history is kept.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setConfirmArchive(true)}
                className="shrink-0 text-error hover:border-error/40 hover:bg-error/5 hover:text-error"
              >
                <Archive className="size-4" aria-hidden="true" />
                Archive
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirmArchive}
        title="Archive Patient?"
        message={`${patient?.full_name ?? 'This patient'} will be removed from the active roster. Their orders, payments, and visits remain on record.`}
        confirmLabel="Archive Patient"
        cancelLabel="Keep Patient"
        tone="danger"
        loading={archiving}
        onConfirm={handleArchive}
        onClose={() => setConfirmArchive(false)}
      />
    </>
  )
}