import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useSearchParams } from 'react-router-dom'
import {
  Ban,
  CalendarCheck2,
  CalendarDays,
  Check,
  CircleCheck,
  ChevronDown,
  Clock3,
  Pencil,
  UserRoundX,
  Users,
  UserRound,
} from 'lucide-react'
import { PageHeader, SectionTitle, Avatar, StatTile } from '@/components/layout/page-header'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input, Select, Textarea } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { EmptyState, ErrorNote, Skeleton } from '@/components/ui/feedback'
import { useAuth } from '@/hooks/use-auth'
import { useAsync } from '@/hooks/use-async'
import { useConfirm } from '@/hooks/use-confirm'
import { useResultDialog } from '@/hooks/use-result-dialog'
import { cancelAppointment, createAppointment, findOverlappingAppointment, listAppointments, updateAppointment } from '@/lib/appointments'
import {
  APPOINTMENT_STATUS,
  getAppointmentStatusBadge,
  getAppointmentStatusLabel,
  normalizeAppointmentStatus,
} from '@/lib/appointment-status'
import { listPatientRoster } from '@/services/patients.service'
import { invalidateClinicQueries } from '@/lib/query-client'
import { toDateKey, toInputDateTime } from '@/utils/dates'
import { formatDate, formatDateShort, formatTime } from '@/utils/format'
import { AppError } from '@/utils/errors'
import { cn } from '@/lib/utils'
import { DatePicker } from '@/components/DatePicker'
import { TimeSlotPicker } from '@/components/TimeSlotPicker'

const typeOptions = [
  'Consultation',
  'Follow Up',
  'Eye Exam',
  'Contact Lens Fitting',
  'Procedure',
]

function getAppointmentDateTime(item) {
  if (!item?.start_at) return null
  const value = new Date(item.start_at)
  return Number.isNaN(value.getTime()) ? null : value
}

function defaultForm() {
  const now = new Date()
  const nextSlot = new Date(now)
  nextSlot.setSeconds(0, 0)
  nextSlot.setMinutes(Math.ceil(nextSlot.getMinutes() / 30) * 30)
  if (nextSlot.getHours() < 9) nextSlot.setHours(9, 0, 0, 0)
  if (nextSlot.getHours() >= 18 || nextSlot.getHours() === 17 && nextSlot.getMinutes() > 30) {
    nextSlot.setDate(nextSlot.getDate() + 1)
    nextSlot.setHours(9, 0, 0, 0)
  }

  return {
    patient_id: '',
    start_at: toInputDateTime(nextSlot),
    duration_minutes: '30',
    type: 'Consultation',
    notes: '',
  }
}

function localInputValue(value) {
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? '' : toInputDateTime(date)
}

function validateForm(form, todayKey) {
  const errors = {}
  if (!form.patient_id) errors.patient_id = 'Choose a patient.'
  const [date, time] = (form.start_at ?? '').split('T')
  if (!date) errors.date = 'Choose a date.'
  else if (date < todayKey) errors.date = 'The date cannot be in the past.'
  if (!time) errors.time = 'Choose a time.'

  const duration = Number(form.duration_minutes)
  if (!Number.isInteger(duration) || duration < 5 || duration > 480) {
    errors.duration_minutes = 'Duration must be between 5 and 480 minutes.'
  }
  return errors
}

function toAppointmentPayload(form) {
  const [date, time] = form.start_at.split('T')
  return {
    patient_id: form.patient_id,
    start_at: new Date(`${date}T${time}:00`).toISOString(),
    duration_minutes: Number(form.duration_minutes),
    type: form.type,
    notes: form.notes.trim(),
  }
}

const confirmationDate = new Intl.DateTimeFormat('en-PH', {
  weekday: 'short',
  month: 'short',
  day: 'numeric',
  year: 'numeric',
})

export default function AppointmentsPage() {
  const { userId } = useAuth()
  const [searchParams] = useSearchParams()
  const requestedPatientId = searchParams.get('patient') ?? ''
  const requestedType = typeOptions.includes(searchParams.get('type')) ? searchParams.get('type') : 'Consultation'
  const confirm = useConfirm()
  const resultDialog = useResultDialog()
  const [today] = useState(() => new Date())
  const todayKey = toDateKey(today)
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString()
  const patients = useAsync(() => listPatientRoster(), [], 'loadPatients', { key: 'patient-roster' })
  const appointments = useAsync(
    () => listAppointments({ from: todayStart }),
    [todayStart],
    'loadAppointments',
    { key: 'appointments-upcoming' },
  )
  const [form, setForm] = useState(() => ({
    ...defaultForm(),
    patient_id: requestedPatientId,
    type: requestedType,
  }))
  const [patientSearch, setPatientSearch] = useState('')
  const [patientPickerOpen, setPatientPickerOpen] = useState(false)
  const [activePatientIndex, setActivePatientIndex] = useState(0)
  const [patientListPosition, setPatientListPosition] = useState(null)
  const [touched, setTouched] = useState({})
  const [submitted, setSubmitted] = useState(false)
  const [scheduleConflictError, setScheduleConflictError] = useState('')
  const [saving, setSaving] = useState(false)
  const [actionBusyId, setActionBusyId] = useState(null)
  const [editingAppointment, setEditingAppointment] = useState(null)
  const [availabilityRevision, setAvailabilityRevision] = useState(0)
  const savingRef = useRef(false)
  const patientComboboxRef = useRef(null)
  const patientInputRef = useRef(null)
  const patientListRef = useRef(null)

  const validationErrors = useMemo(() => validateForm(form, todayKey), [form, todayKey])
  const visibleError = (field) => (submitted || touched[field] ? validationErrors[field] : '')

  const filteredPatients = useMemo(() => {
    const term = patientSearch.trim().toLowerCase()
    return (patients.data ?? []).filter((patient) =>
      !term || patient.full_name.toLowerCase().includes(term) || (patient.cp_number ?? '').toLowerCase().includes(term),
    )
  }, [patientSearch, patients.data])
  const selectedPatient = patients.data?.find((patient) => patient.id === form.patient_id) ?? null
  const activePatient = filteredPatients[activePatientIndex] ?? null

  const selectPatient = (patient) => {
    setForm((current) => ({ ...current, patient_id: patient.id }))
    setPatientSearch('')
    setPatientPickerOpen(false)
    setActivePatientIndex(0)
    setTouched((current) => ({ ...current, patient_id: true }))
    setScheduleConflictError('')
  }

  const openPatientPicker = () => {
    const rect = patientInputRef.current?.getBoundingClientRect()
    if (rect) {
      const width = Math.min(rect.width, window.innerWidth - 16)
      const estimatedHeight = 280
      const top = rect.bottom + estimatedHeight + 4 <= window.innerHeight
        ? rect.bottom + 4
        : Math.max(8, rect.top - estimatedHeight - 4)
      setPatientListPosition({
        left: Math.max(8, Math.min(rect.left, window.innerWidth - width - 8)),
        top,
        width,
      })
    }
    setPatientPickerOpen(true)
  }

  useEffect(() => {
    const closeOutside = (event) => {
      if (
        !patientComboboxRef.current?.contains(event.target) &&
        !patientListRef.current?.contains(event.target)
      ) setPatientPickerOpen(false)
    }
    document.addEventListener('pointerdown', closeOutside)
    return () => document.removeEventListener('pointerdown', closeOutside)
  }, [])

  const upcoming = useMemo(
    () => (appointments.data ?? [])
      .filter((item) => {
        const date = getAppointmentDateTime(item)
        return date && date.getTime() >= Date.parse(todayStart)
      })
      .sort((left, right) => Date.parse(left.start_at) - Date.parse(right.start_at)),
    [appointments.data, todayStart],
  )

  const appointmentGroups = useMemo(() => {
    const groups = new Map()
    for (const appointment of upcoming) {
      const dateKey = toDateKey(new Date(appointment.start_at))
      if (!groups.has(dateKey)) groups.set(dateKey, [])
      groups.get(dateKey).push(appointment)
    }
    return [...groups.entries()].map(([dateKey, items]) => ({ dateKey, items }))
  }, [upcoming])

  const todayCount = upcoming.filter((item) =>
    toDateKey(new Date(item.start_at)) === todayKey &&
    normalizeAppointmentStatus(item.status) !== APPOINTMENT_STATUS.CANCELLED,
  ).length

  const activeCount = upcoming.filter((item) => {
    const s = normalizeAppointmentStatus(item.status)
    return s === APPOINTMENT_STATUS.SCHEDULED || s === APPOINTMENT_STATUS.ARRIVED
  }).length

  const followUpCount = upcoming.filter(
    (item) =>
      (item.type === 'Follow Up' || item.appointment_type === 'Follow Up') &&
      ![APPOINTMENT_STATUS.COMPLETED, APPOINTMENT_STATUS.CANCELLED].includes(normalizeAppointmentStatus(item.status)),
  ).length

  const seenCount = upcoming.filter(
    (item) => normalizeAppointmentStatus(item.status) === APPOINTMENT_STATUS.COMPLETED,
  ).length

  const bookedCount = upcoming.filter(
    (item) => normalizeAppointmentStatus(item.status) !== APPOINTMENT_STATUS.CANCELLED,
  ).length

  const handleFieldChange = (field) => (event) => {
    const value = event.target.value
    setForm((current) => ({ ...current, [field]: value }))
    setTouched((current) => ({ ...current, [field]: true }))
    setScheduleConflictError('')
  }

  const handleDateChange = (date) => {
    setForm((current) => ({ ...current, start_at: date ? `${date}T` : '' }))
    setTouched((current) => ({ ...current, date: true, time: true }))
    setScheduleConflictError('')
  }

  const handleTimeChange = (time) => {
    setForm((current) => {
      const date = current.start_at.split('T')[0]
      return { ...current, start_at: date && time ? `${date}T${time}` : date ? `${date}T` : '' }
    })
    setTouched((current) => ({ ...current, time: true }))
    setScheduleConflictError('')
  }

  const saveAppointment = async (payload, appointmentId, requireConfirmation = true) => {
    if (savingRef.current) return
    savingRef.current = true
    setSaving(true)
    setScheduleConflictError('')

    let conflictMessage = ''
    let saveFailure = null
    const writeAppointment = async () => {
      const conflict = await findOverlappingAppointment({
        ...payload,
        exclude_id: appointmentId,
      })
      if (conflict) {
        const conflictTime = new Date(conflict.start_at)
        conflictMessage = `${conflict.patient_name ?? 'Another patient'} already has an appointment on ${formatDateShort(conflictTime)} at ${formatTime(conflictTime)}. Choose another time.`
        return
      }

      if (appointmentId) await updateAppointment(appointmentId, payload)
      else await createAppointment(payload)
    }

    try {
      let approved = true
      if (requireConfirmation) {
        const appointmentDate = new Date(payload.start_at)
        const patientName = selectedPatient?.full_name ?? 'the selected patient'
        approved = await confirm({
          title: appointmentId ? 'Update appointment?' : 'Schedule appointment?',
          message: `${appointmentId ? 'Update' : 'Schedule'} ${patientName} for ${confirmationDate.format(appointmentDate)} at ${formatTime(appointmentDate)} (${payload.duration_minutes} min, ${payload.type})?`,
          confirmLabel: appointmentId ? 'Update appointment' : 'Schedule appointment',
          onConfirm: async () => {
            try {
              await writeAppointment()
            } catch (caught) {
              saveFailure = caught
            }
          },
        })
      } else {
        try {
          await writeAppointment()
        } catch (caught) {
          saveFailure = caught
        }
      }

      if (!approved) return
      if (conflictMessage) {
        setScheduleConflictError(conflictMessage)
        setTouched((current) => ({ ...current, start_at: true }))
        return
      }
      if (saveFailure) {
        resultDialog.error({
          title: appointmentId ? 'Could not update the appointment' : 'Could not schedule the appointment',
          message: saveFailure instanceof AppError
            ? saveFailure.message
            : 'Please check the appointment details and try again.',
          retryLabel: 'Try again',
          onRetry: () => saveAppointment(payload, appointmentId, false),
        })
        return
      }

      invalidateClinicQueries(userId, 'loadAppointments', 'dashboard-summary', 'today-activity')
      appointments.reload()
      setAvailabilityRevision((revision) => revision + 1)
      resultDialog.success({
        title: appointmentId ? 'Appointment updated' : 'Appointment scheduled',
        message: `${selectedPatient?.full_name ?? 'The patient'} has been ${appointmentId ? 'updated' : 'scheduled'} successfully.`,
      })
      setForm(defaultForm())
      setEditingAppointment(null)
      setPatientSearch('')
      setTouched({})
      setSubmitted(false)
      setScheduleConflictError('')
    } finally {
      savingRef.current = false
      setSaving(false)
    }
  }

  const handleSubmit = (event) => {
    event.preventDefault()
    setSubmitted(true)
    if (Object.keys(validationErrors).length > 0 || savingRef.current) return
    void saveAppointment(toAppointmentPayload(form), editingAppointment?.id)
  }

  const handleEdit = async (appointment) => {
    if (saving || actionBusyId !== null) return
    const patientName = appointment.patient_name ?? 'this patient'
    const approved = await confirm({
      title: 'Edit appointment?',
      message: `Load ${patientName}'s appointment into the Schedule visit form?`,
      confirmLabel: 'Edit appointment',
    })
    if (!approved) return

    setEditingAppointment(appointment)
    setForm({
      patient_id: appointment.patient_id,
      start_at: localInputValue(appointment.start_at),
      duration_minutes: String(appointment.duration_minutes),
      type: appointment.type,
      notes: appointment.notes ?? '',
    })
    setPatientSearch('')
    setTouched({})
    setSubmitted(false)
    setScheduleConflictError('')
    resultDialog.success({
      title: 'Appointment ready to edit',
      message: `${patientName}'s details are loaded into the form.`,
      autoCloseMs: 1800,
    })
  }

  const performRowAction = async (appointment, nextStatus) => {
    setActionBusyId(appointment.id)
    try {
      if (nextStatus === APPOINTMENT_STATUS.CANCELLED) {
        await cancelAppointment(appointment.id)
      } else {
        await updateAppointment(appointment.id, { status: nextStatus })
      }
      invalidateClinicQueries(userId, 'loadAppointments', 'dashboard-summary', 'today-activity')
      appointments.reload()
      setAvailabilityRevision((revision) => revision + 1)
      const actionLabel = nextStatus === APPOINTMENT_STATUS.ARRIVED
        ? 'marked arrived'
        : nextStatus === APPOINTMENT_STATUS.NO_SHOW
          ? 'marked no-show'
          : nextStatus === APPOINTMENT_STATUS.COMPLETED
            ? 'marked completed'
            : 'cancelled'
      resultDialog.success({
        title: nextStatus === APPOINTMENT_STATUS.CANCELLED ? 'Appointment cancelled' : 'Appointment updated',
        message: `${appointment.patient_name ?? 'The patient'} was ${actionLabel}.`,
      })
    } catch (caught) {
      resultDialog.error({
        title: nextStatus === APPOINTMENT_STATUS.CANCELLED ? 'Could not cancel the appointment' : 'Could not update the appointment',
        message: caught instanceof AppError ? caught.message : 'Please try again.',
        retryLabel: 'Try again',
        onRetry: () => performRowAction(appointment, nextStatus),
      })
    } finally {
      setActionBusyId(null)
    }
  }

  const handleRowAction = async (appointment, nextStatus) => {
    if (saving || actionBusyId !== null) return
    const patientName = appointment.patient_name ?? 'The patient'
    const isCancel = nextStatus === APPOINTMENT_STATUS.CANCELLED
    const actionLabel = nextStatus === APPOINTMENT_STATUS.ARRIVED
      ? 'Mark arrived'
      : nextStatus === APPOINTMENT_STATUS.NO_SHOW
        ? 'Mark no-show'
        : nextStatus === APPOINTMENT_STATUS.COMPLETED
          ? 'Mark completed'
          : 'Cancel appointment'
    const approved = await confirm({
      title: isCancel ? 'Cancel this appointment?' : `${actionLabel}?`,
      message: `${actionLabel} for ${patientName}?`,
      confirmLabel: actionLabel,
      variant: isCancel ? 'danger' : 'default',
    })
    if (approved) await performRowAction(appointment, nextStatus)
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Appointments"
        description="Book consults, follow-ups, and optical visits around the clinic schedule."
      />

      {patients.error && (
        <div className="flex flex-wrap items-center gap-2">
          <ErrorNote message={patients.error} className="flex-1" />
          <Button type="button" variant="outline" size="sm" onClick={patients.reload}>
            Try again
          </Button>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatTile
          contextLabel="UPCOMING"
          label="Booked"
          value={String(bookedCount)}
          icon={CalendarDays}
          tone="gold"
          description="Appointments still on the calendar."
        />
        <StatTile
          contextLabel="TODAY"
          label="Today"
          value={String(todayCount)}
          icon={CalendarCheck2}
          tone="neutral"
          description="Visits scheduled for this date."
        />
        <StatTile
          contextLabel="ACTIVE"
          label="In flow"
          value={String(activeCount)}
          icon={Clock3}
          tone="warning"
          description="Scheduled or arrived."
        />
        <StatTile
          contextLabel="FOLLOW-UP"
          label="Follow-ups"
          value={String(followUpCount)}
          icon={UserRound}
          tone="success"
          description="Patients due for review or check-in."
        />
        <StatTile
          contextLabel="SEEN"
          label="Seen"
          value={String(seenCount)}
          icon={Users}
          tone="success"
          description="Patients completed today."
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
        <Card className="p-5">
          <div className="flex items-center justify-between gap-3">
            <SectionTitle>{editingAppointment ? 'Edit appointment' : 'Schedule visit'}</SectionTitle>
            {editingAppointment && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={saving}
                onClick={() => {
                  setEditingAppointment(null)
                  setForm(defaultForm())
                  setTouched({})
                  setSubmitted(false)
                  setScheduleConflictError('')
                }}
              >
                Discard edit
              </Button>
            )}
          </div>

          <form onSubmit={handleSubmit} noValidate className="mt-4 space-y-4">
            <div ref={patientComboboxRef} className="relative min-w-0">
              <label htmlFor="appointment-patient" className="mb-1.5 block text-[13px] font-medium text-espresso">
                Patient <span className="text-error" aria-hidden="true">*</span>
              </label>
              <div className="relative">
                {patients.loading && (
                  <Clock3 className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 animate-pulse text-gold-dark motion-reduce:animate-none" aria-hidden="true" />
                )}
                <input
                  ref={patientInputRef}
                  id="appointment-patient"
                  type="text"
                  role="combobox"
                  aria-autocomplete="list"
                  aria-haspopup="listbox"
                  aria-expanded={patientPickerOpen}
                  aria-controls="appointment-patient-listbox"
                  aria-activedescendant={patientPickerOpen && activePatient ? `appointment-patient-option-${activePatient.id}` : undefined}
                  aria-invalid={visibleError('patient_id') ? 'true' : undefined}
                  aria-describedby={visibleError('patient_id') ? 'appointment-patient-error' : undefined}
                  autoComplete="off"
                  value={patientPickerOpen ? patientSearch : selectedPatient
                    ? `${selectedPatient.full_name}${selectedPatient.cp_number ? ` · ${selectedPatient.cp_number}` : ''}`
                    : patientSearch}
                  placeholder="Find by name or CP number"
                  disabled={saving || patients.loading || Boolean(patients.error)}
                  onFocus={() => {
                    if (selectedPatient) setPatientSearch('')
                    setActivePatientIndex(0)
                    openPatientPicker()
                  }}
                  onChange={(event) => {
                    setPatientSearch(event.target.value)
                    setActivePatientIndex(0)
                    setPatientPickerOpen(true)
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'ArrowDown') {
                      event.preventDefault()
                      if (!patientPickerOpen) {
                        openPatientPicker()
                        setActivePatientIndex(0)
                      } else {
                        setActivePatientIndex((index) => Math.max(0, Math.min(index + 1, filteredPatients.length - 1)))
                      }
                    } else if (event.key === 'ArrowUp') {
                      event.preventDefault()
                      setActivePatientIndex((index) => Math.max(index - 1, 0))
                    } else if (event.key === 'Enter' && patientPickerOpen && activePatient) {
                      event.preventDefault()
                      selectPatient(activePatient)
                    } else if (event.key === 'Escape' && patientPickerOpen) {
                      event.preventDefault()
                      setPatientPickerOpen(false)
                    }
                  }}
                  className={cn(
                    'h-11 w-full rounded-control border bg-surface px-3.5 pr-10 text-[13px] text-espresso placeholder:text-warmgray/55 focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/20 disabled:cursor-not-allowed disabled:bg-ivory disabled:text-warmgray motion-reduce:transition-none',
                    patients.loading && 'pl-9',
                    visibleError('patient_id') ? 'border-error' : 'border-champagne',
                  )}
                />
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-warmgray" aria-hidden="true" />
              </div>
              {visibleError('patient_id') && (
                <p id="appointment-patient-error" className="mt-1.5 text-xs text-error" role="alert">
                  {visibleError('patient_id')}
                </p>
              )}
              {patientPickerOpen && createPortal(
                <div
                  ref={patientListRef}
                  id="appointment-patient-listbox"
                  role="listbox"
                  aria-label="Patients matching search"
                  style={patientListPosition ? { position: 'fixed', ...patientListPosition } : undefined}
                  className="z-120 max-h-64 overflow-y-auto rounded-control border border-champagne bg-surface p-1 shadow-pop"
                >
                  {patients.loading ? (
                    <div className="space-y-2 p-2" aria-live="polite">
                      <Skeleton className="h-8 w-full motion-reduce:animate-none" />
                      <Skeleton className="h-8 w-full motion-reduce:animate-none" />
                    </div>
                  ) : filteredPatients.length > 0 ? filteredPatients.map((patient, index) => (
                    <button
                      key={patient.id}
                      id={`appointment-patient-option-${patient.id}`}
                      type="button"
                      role="option"
                      aria-selected={patient.id === form.patient_id}
                      onMouseDown={(event) => event.preventDefault()}
                      onMouseEnter={() => setActivePatientIndex(index)}
                      onClick={() => selectPatient(patient)}
                      className={cn(
                        'flex min-h-10 w-full items-center rounded-control px-3 text-left text-[13px] text-espresso transition-colors hover:bg-gold-light/60 motion-reduce:transition-none',
                        index === activePatientIndex && 'bg-gold-light/60',
                      )}
                    >
                      <span className="truncate">{patient.full_name}</span>
                      {patient.cp_number && <span className="ml-2 shrink-0 text-xs text-warmgray">{patient.cp_number}</span>}
                    </button>
                  )) : (
                    <p className="px-3 py-2 text-[13px] text-warmgray" role="status">
                      {patientSearch ? 'No patients match that search.' : 'No patients found.'}
                    </p>
                  )}
                </div>,
                document.body,
              )}
            </div>

            <div className="grid grid-cols-1 gap-4 min-[480px]:grid-cols-[1fr_1fr]">
              <DatePicker
                id="appointment-date"
                value={form.start_at.split('T')[0] ?? ''}
                onChange={handleDateChange}
                minDate={todayKey}
                error={visibleError('date')}
                disabled={saving}
              />
              <TimeSlotPicker
                date={form.start_at.split('T')[0] ?? ''}
                value={form.start_at.split('T')[1] ?? ''}
                duration={form.duration_minutes}
                onChange={handleTimeChange}
                error={scheduleConflictError || visibleError('time')}
                disabled={saving}
                excludeAppointmentId={editingAppointment?.id}
                refreshKey={availabilityRevision}
              />
            </div>

            <div className="grid grid-cols-1 gap-4 min-[480px]:grid-cols-[1fr_1fr]">
              <Input
                label="Duration (minutes)"
                id="appointment-duration"
                type="number"
                min="5"
                max="480"
                step="5"
                value={form.duration_minutes}
                onChange={handleFieldChange('duration_minutes')}
                error={visibleError('duration_minutes')}
                disabled={saving}
              />
              <Select
                label="Type"
                id="appointment-type"
                value={form.type}
                onChange={handleFieldChange('type')}
                options={typeOptions.map((option) => ({ value: option, label: option }))}
                disabled={saving}
              />
            </div>

            <Textarea
              label="Notes"
              id="appointment-notes"
              rows={4}
              value={form.notes}
              onChange={handleFieldChange('notes')}
              placeholder="Reason for visit, reminders, or instructions."
              disabled={saving}
            />

            <Button type="submit" loading={saving} disabled={patients.loading || Boolean(patients.error)} className="w-full motion-reduce:transition-none" size="md">
              {editingAppointment ? 'Update appointment' : 'Save appointment'}
            </Button>
          </form>
        </Card>

        <Card className="overflow-hidden">
          <div className="border-b border-champagne px-5 py-4">
            <SectionTitle>Upcoming schedule</SectionTitle>
          </div>

          <div className="p-5">
            {appointments.error ? (
              <div className="space-y-3">
                <ErrorNote message={appointments.error} />
                <Button type="button" variant="outline" size="sm" onClick={appointments.reload}>
                  Try again
                </Button>
              </div>
            ) : appointments.showSkeleton && !appointments.data ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }, (_, index) => (
                  <Skeleton key={index} className="h-20 w-full motion-reduce:animate-none" />
                ))}
              </div>
            ) : !appointments.data ? (
              <div className="min-h-72" />
            ) : upcoming.length === 0 ? (
              <EmptyState
                icon={CalendarCheck2}
                title="No upcoming appointments"
                description="Appointments for today and later will appear here."
              />
            ) : (
              <div
                aria-busy={appointments.loading || undefined}
                className={cn('space-y-6 transition-opacity duration-150', appointments.loading && 'opacity-60')}
              >
                {appointmentGroups.map((group) => (
                  <section key={group.dateKey} aria-labelledby={`appointment-day-${group.dateKey}`}>
                    <h3
                      id={`appointment-day-${group.dateKey}`}
                      className="mb-2 text-sm font-semibold text-espresso"
                    >
                      {formatDate(new Date(`${group.dateKey}T12:00:00`))}
                      <span className="ml-2 text-xs font-normal text-warmgray">{group.items.length}</span>
                    </h3>
                    <div className="divide-y divide-champagne/70 rounded-control border border-champagne bg-surface">
                      {group.items.map((appointment) => {
                        const patientName = appointment.patient_name ?? 'Unknown patient'
                        const appointmentDate = getAppointmentDateTime(appointment)
                        const statusValue = normalizeAppointmentStatus(appointment.status)
                        const statusLabel = getAppointmentStatusLabel(statusValue)
                        const statusBadge = getAppointmentStatusBadge(statusValue)
                        const actionsLocked = saving || actionBusyId !== null
                        const canArrive = statusValue === APPOINTMENT_STATUS.SCHEDULED
                        const canComplete = [APPOINTMENT_STATUS.SCHEDULED, APPOINTMENT_STATUS.ARRIVED].includes(statusValue)
                        const canNoShow = [APPOINTMENT_STATUS.SCHEDULED, APPOINTMENT_STATUS.ARRIVED].includes(statusValue)
                        const canCancel = [APPOINTMENT_STATUS.SCHEDULED, APPOINTMENT_STATUS.ARRIVED].includes(statusValue)

                        return (
                          <article
                            key={appointment.id}
                            className="grid gap-3 p-3 sm:p-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.8fr)_minmax(0,0.8fr)_auto] lg:items-center"
                          >
                            <div className="flex min-w-0 items-center gap-3">
                              <Avatar name={patientName} className="size-9 shrink-0 text-[11px]" />
                              <div className="min-w-0">
                                <p className="truncate text-sm font-semibold text-espresso">{patientName}</p>
                                {appointment.patient_cp_number && (
                                  <p className="tabular text-[11px] text-warmgray">{appointment.patient_cp_number}</p>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center gap-2 text-[13px]">
                              <Clock3 className="size-3.5 shrink-0 text-gold-dark" aria-hidden="true" />
                              <span className="font-medium text-espresso">
                                {appointmentDate ? formatTime(appointmentDate) : '—'}
                              </span>
                              <span className="text-warmgray">· {appointment.duration_minutes} min</span>
                            </div>

                            <div className="flex min-w-0 items-center gap-2">
                              <span className="truncate text-[13px] text-warmgray">{appointment.type}</span>
                              <Badge variant={statusBadge}>{statusLabel}</Badge>
                            </div>

                            <div className="flex flex-wrap gap-1.5 lg:justify-end">
                              {canArrive && (
                                <Button type="button" variant="ghost" size="sm" disabled={actionsLocked} onClick={() => void handleRowAction(appointment, APPOINTMENT_STATUS.ARRIVED)}>
                                  <Check className="size-3.5" aria-hidden="true" /> Arrived
                                </Button>
                              )}
                              {canComplete && (
                                <Button type="button" variant="ghost" size="sm" disabled={actionsLocked} onClick={() => void handleRowAction(appointment, APPOINTMENT_STATUS.COMPLETED)}>
                                  <CircleCheck className="size-3.5" aria-hidden="true" /> Complete
                                </Button>
                              )}
                              {canNoShow && (
                                <Button type="button" variant="ghost" size="sm" disabled={actionsLocked} onClick={() => void handleRowAction(appointment, APPOINTMENT_STATUS.NO_SHOW)}>
                                  <UserRoundX className="size-3.5" aria-hidden="true" /> No-show
                                </Button>
                              )}
                              <Button type="button" variant="ghost" size="sm" disabled={actionsLocked} onClick={() => void handleEdit(appointment)}>
                                <Pencil className="size-3.5" aria-hidden="true" /> Edit
                              </Button>
                              {canCancel && (
                                <Button type="button" variant="ghost" size="sm" disabled={actionsLocked} className="text-error hover:bg-error/5 hover:text-error" onClick={() => void handleRowAction(appointment, APPOINTMENT_STATUS.CANCELLED)}>
                                  <Ban className="size-3.5" aria-hidden="true" /> Cancel
                                </Button>
                              )}
                            </div>
                          </article>
                        )
                      })}
                    </div>
                  </section>
                ))}
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  )
}
