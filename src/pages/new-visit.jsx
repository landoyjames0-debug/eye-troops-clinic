import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import {
  Banknote,
  Building2,
  Check,
  ClipboardList,
  Glasses,
  Loader2,
  Minus,
  MoreHorizontal,
  Plus,
  Search,
  Smartphone,
  Stethoscope,
  Trash2,
  UserPlus,
  UserRound,
  X,
} from 'lucide-react'
import { PageHeader, SectionTitle, Avatar } from '@/components/layout/page-header'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input, Textarea, controlVariants, Label } from '@/components/ui/input'
import { ChoiceGroup } from '@/components/ui/choice-group'
import { VisitDateTimeField } from '@/components/visits/visit-datetime-field'
import { ErrorNote, Skeleton } from '@/components/ui/feedback'
import { useAsync } from '@/hooks/use-async'
import { useAuth } from '@/hooks/use-auth'
import { useConfirm } from '@/hooks/use-confirm'
import { useResultDialog } from '@/hooks/use-result-dialog'
import { useSupabaseHealth } from '@/hooks/use-supabase-health'
import { createPatient, findPatientByMobile, listPatientRoster } from '@/services/patients.service'
import { invalidateClinicQueries } from '@/lib/query-client'
import { createVisit, hasPrescription } from '@/services/visits.service'
import { createOrder } from '@/services/orders.service'
import { createPayment, paymentTypeFor } from '@/services/payments.service'
import {
  LENS_TYPES,
  ORDER_ITEM_TYPES,
  describeOrderItems,
  describePayment,
} from '@/lib/constants'
import { toInputDateTime, toDateKey } from '@/utils/dates'
import { formatPeso } from '@/utils/format'
import { getDefaultPaymentMethod } from '@/lib/user-preferences'
import { AppError } from '@/utils/errors'
import { cn } from '@/lib/utils'

const SEARCH_DEBOUNCE_MS = 300

const BLANK_RX = {
  od_sph: '',
  od_cyl: '',
  od_axis: '',
  od_add: '',
  od_pd: '',
  os_sph: '',
  os_cyl: '',
  os_axis: '',
  os_add: '',
  os_pd: '',
}

const RX_COLUMNS = [
  { key: 'sph', label: 'SPH', placeholder: '-1.25' },
  { key: 'cyl', label: 'CYL', placeholder: '-0.50' },
  { key: 'axis', label: 'AXIS', placeholder: '180' },
  { key: 'add', label: 'ADD', placeholder: '+1.00' },
  { key: 'pd', label: 'PD', placeholder: '31.0' },
]

const PAYMENT_METHOD_OPTIONS = [
  { value: 'Cash', label: 'Cash', icon: Banknote },
  { value: 'GCash', label: 'GCash', icon: Smartphone },
  { value: 'Maya', label: 'Maya', icon: Smartphone },
  { value: 'Bank Transfer', label: 'Bank transfer', icon: Building2 },
  { value: 'Other', label: 'Other', icon: MoreHorizontal },
]

const FLOW_STEPS = [
  { label: 'Patient', icon: UserRound },
  { label: 'Visit', icon: Stethoscope },
  { label: 'Prescription', icon: Glasses },
  { label: 'Order', icon: ClipboardList },
  { label: 'Payment', icon: Banknote },
]

const blankItem = () => ({
  key: `item-${Math.random().toString(36).slice(2)}`,
  type: 'Glasses',
  lensType: 'Single Vision',
  quantity: '1',
  unitPrice: '',
})

function itemTotal(item) {
  const quantity = Math.max(parseInt(item.quantity, 10) || 0, 0)
  const price = Number(item.unitPrice) || 0
  return quantity * price
}

function FlowStepper() {
  return (
    <ol className="flex flex-wrap items-center gap-2 sm:gap-0">
      {FLOW_STEPS.map((step, index) => {
        const Icon = step.icon
        const last = index === FLOW_STEPS.length - 1
        return (
          <li key={step.label} className="flex items-center">
            <span className="inline-flex items-center gap-2 rounded-lg bg-surface px-2.5 py-1.5 text-[12px] font-medium text-espresso ring-1 ring-champagne/80">
              <Icon className="size-3.5 text-gold-dark" strokeWidth={2} aria-hidden="true" />
              <span className="hidden sm:inline">{step.label}</span>
              <span className="tabular sm:hidden">{index + 1}</span>
            </span>
            {!last && (
              <span
                className="mx-1.5 hidden h-px w-6 bg-champagne sm:block"
                aria-hidden="true"
              />
            )}
          </li>
        )
      })}
    </ol>
  )
}

function ContextStat({ icon: Icon, label, value, tone = 'neutral' }) {
  const tones = {
    neutral: {
      iconBg: 'bg-gradient-to-br from-gold-light to-champagne',
      iconColor: 'text-gold-dark',
      valueColor: 'text-espresso',
    },
    success: {
      iconBg: 'bg-gradient-to-br from-success/15 to-success/5',
      iconColor: 'text-success',
      valueColor: 'text-success',
    },
    warning: {
      iconBg: 'bg-gradient-to-br from-warning/15 to-warning/5',
      iconColor: 'text-warning',
      valueColor: 'text-warning',
    },
    error: {
      iconBg: 'bg-gradient-to-br from-error/15 to-error/5',
      iconColor: 'text-error',
      valueColor: 'text-error',
    },
  }
  const s = tones[tone] || tones.neutral

  return (
    <div className="flex items-center gap-3 rounded-xl border border-champagne/60 bg-surface px-4 py-3 shadow-card">
      <span
        className={cn(
          'flex size-10 shrink-0 items-center justify-center rounded-xl',
          s.iconBg,
          s.iconColor,
        )}
      >
        <Icon className="size-5" strokeWidth={1.7} aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <p className={cn('truncate font-display text-lg font-bold tabular', s.valueColor)}>
          {value}
        </p>
        <p className="text-[11px] text-warmgray">{label}</p>
      </div>
    </div>
  )
}

function CardSection({ id, title, description, action, children, className }) {
  return (
    <section
      id={id}
      className={cn('border-b border-champagne px-5 py-4 last:border-b-0 sm:px-6 sm:py-5', className)}
    >
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <h2 className="font-display text-[17px] font-semibold tracking-tight text-espresso">
            {title}
          </h2>
          {description && <p className="mt-0.5 text-[13px] text-warmgray">{description}</p>}
        </div>
        {action}
      </div>
      <div className="mt-3.5">{children}</div>
    </section>
  )
}

function PrescriptionGrid({ rx, setRx }) {
  const eyes = [
    { prefix: 'od', label: 'OD', hint: 'Right eye' },
    { prefix: 'os', label: 'OS', hint: 'Left eye' },
  ]

  return (
    <div className="overflow-x-auto rounded-control border border-champagne">
      <table className="w-full min-w-130 border-collapse text-sm">
        <thead>
          <tr className="border-b border-champagne bg-ivory/70">
            <th className="w-16 px-3 py-2.5 text-left text-[11px] font-semibold tracking-wide text-warmgray uppercase">
              Eye
            </th>
            {RX_COLUMNS.map((col) => (
              <th
                key={col.key}
                className="px-2 py-2.5 text-center text-[11px] font-semibold tracking-wide text-warmgray uppercase"
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {eyes.map(({ prefix, label, hint }) => (
            <tr key={prefix} className="border-b border-champagne/70 last:border-b-0">
              <td className="px-3 py-2">
                <span className="font-display text-[13px] font-bold text-gold-dark">{label}</span>
                <span className="sr-only">{hint}</span>
              </td>
              {RX_COLUMNS.map((col) => {
                const fieldKey = `${prefix}_${col.key}`
                return (
                  <td key={fieldKey} className="px-2 py-2">
                    <Label htmlFor={fieldKey} className="sr-only">
                      {label} {col.label}
                    </Label>
                    <input
                      id={fieldKey}
                      value={rx[fieldKey]}
                      onChange={(event) =>
                        setRx((prev) => ({ ...prev, [fieldKey]: event.target.value }))
                      }
                      placeholder={col.placeholder}
                      className={cn(
                        controlVariants({ invalid: false }),
                        'h-9 tabular text-center text-[13px]',
                      )}
                    />
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function SummaryRow({ label, value, tone = 'default' }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-[13px] text-warmgray">{label}</dt>
      <dd
        className={
          tone === 'due'
            ? 'tabular text-[15px] font-semibold text-error'
            : tone === 'settled'
              ? 'tabular text-[15px] font-semibold text-success'
              : 'tabular text-[15px] font-medium text-espresso'
        }
      >
        {value}
      </dd>
    </div>
  )
}

export default function NewVisitPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { userId } = useAuth()
  const confirm = useConfirm()
  const resultDialog = useResultDialog()
  const { isOnline } = useSupabaseHealth()
  const saveProgressRef = useRef({})

  const patientId = searchParams.get('patient')
  const selectPatient = (id) => {
    setSearchParams(id ? { patient: id } : {}, { replace: true })
  }

  const [mode, setMode] = useState('existing')
  const [pickingPatient, setPickingPatient] = useState(() => !patientId)
  const [search, setSearch] = useState('')
  const [deferredSearch, setDeferredSearch] = useState('')
  const [visitDate, setVisitDate] = useState(() => toInputDateTime())
  const [notes, setNotes] = useState('')
  const [rx, setRx] = useState(BLANK_RX)

  const [items, setItems] = useState([blankItem()])
  const [amountPaid, setAmountPaid] = useState('')
  const [method, setMethod] = useState(() => getDefaultPaymentMethod(userId))

  const [newPatient, setNewPatient] = useState({
    full_name: '',
    cp_number: '',
    address: '',
    notes: '',
  })
  const [duplicate, setDuplicate] = useState(null)
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)

  const patients = useAsync(
    () => (mode === 'existing' ? listPatientRoster(deferredSearch) : Promise.resolve([])),
    [deferredSearch, mode],
    'loadPatients',
    { key: 'visit-patient-search' },
  )

  const [justCreated, setJustCreated] = useState(null)

  const selected = useMemo(
    () =>
      patients.data?.find((row) => row.id === patientId) ??
      (justCreated?.id === patientId ? { full_name: justCreated.full_name } : null),
    [patients.data, patientId, justCreated],
  )

  const selectedRecord = useMemo(() => {
    if (mode !== 'existing') return null
    return patients.data?.find((row) => row.id === patientId) ?? null
  }, [mode, patients.data, patientId])

  const orderTotal = useMemo(
    () => items.reduce((sum, item) => sum + itemTotal(item), 0),
    [items],
  )
  const paid = Number(amountPaid) || 0
  const balanceDue = Math.max(orderTotal - paid, 0)
  const paymentType = paymentTypeFor(orderTotal, paid)

  const searchPending = search.trim() !== deferredSearch.trim()
  const searchBusy =
    searchPending || (patients.loading && Boolean(deferredSearch.trim()))

  useEffect(() => {
    const id = window.setTimeout(() => setDeferredSearch(search), SEARCH_DEBOUNCE_MS)
    return () => window.clearTimeout(id)
  }, [search])

  useEffect(() => {
    if (patientId && mode === 'existing') {
      setPickingPatient(false)
    }
  }, [patientId, mode])

  const setItem = (key, patch) =>
    setItems((prev) => prev.map((item) => (item.key === key ? { ...item, ...patch } : item)))

  const useExistingDuplicate = () => {
    if (!duplicate) return
    setMode('existing')
    setSearch('')
    setDeferredSearch('')
    selectPatient(duplicate.id)
    setPickingPatient(false)
    setDuplicate(null)
    toast.success('Using the existing patient', { description: duplicate.full_name })
  }

  const saveVisitAction = async () => {
    if (!isOnline) {
      resultDialog.error({
        title: 'Connection unavailable',
        message: 'Your visit details are still here. Reconnect and try saving again.',
        retryLabel: 'Try again',
        onRetry: saveVisitAction,
      })
      return
    }
    setSaving(true)
    const progress = saveProgressRef.current
    try {
      if (!progress.patientId) {
        progress.patientId = mode === 'new'
          ? (await createPatient({ ...newPatient, address: '', notes: '' })).id
          : patientId
      }

      if (mode === 'new' && !progress.patientInitialized) {
        setJustCreated({ id: progress.patientId, full_name: newPatient.full_name.trim() })
        selectPatient(progress.patientId)
        progress.patientInitialized = true
      }

      if (!progress.visit) {
        progress.visit = await createVisit({
          patient_id: progress.patientId,
          visit_date: new Date(visitDate).toISOString(),
          notes,
          prescription: hasPrescription(rx) ? rx : null,
        })
      }

      if (!progress.order) {
        progress.order = await createOrder({
          patient_id: progress.patientId,
          visit_id: progress.visit.id,
          description: describeOrderItems(items.filter((item) => itemTotal(item) > 0)),
          total_amount: orderTotal,
          status: 'ORDERED',
        })
      }

      if (paid > 0 && !progress.payment) {
        await createPayment({
          order_id: progress.order.id,
          amount: paid,
          payment_date: toDateKey(),
          notes: describePayment(method, paymentType),
        })
        progress.payment = true
      }

      const order = progress.order
      const patientName = selected?.full_name ?? newPatient.full_name ?? 'Patient'
      saveProgressRef.current = {}
      invalidateClinicQueries(
        userId,
        'patients-list',
        'patient-roster',
        'orders-list',
        'dashboard-summary',
        'today-activity',
        'finance-payments',
      )
      resultDialog.success({
        title: 'Visit and order saved',
        message: `${patientName} · ${order.order_number}. ${balanceDue > 0 ? 'Deposit received.' : 'Paid in full.'}`,
        primaryLabel: 'View order',
        onPrimary: () => navigate(`/orders?search=${encodeURIComponent(order.order_number)}`),
      })
      navigate('/orders')
    } catch (caught) {
      resultDialog.error({
        title: 'Could not save the visit',
        message: caught instanceof AppError ? caught.message : 'Please check your connection and try again.',
        details: caught?.cause?.message ?? caught?.message,
        retryLabel: 'Try again',
        onRetry: saveVisitAction,
      })
    } finally {
      setSaving(false)
    }
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (!isOnline) return
    saveProgressRef.current = {}

    const nextErrors = {}

    if (mode === 'existing' && !patientId) {
      nextErrors.patient = 'Select an existing patient first.'
    }
    if (mode === 'new' && !newPatient.full_name.trim()) {
      nextErrors.full_name = 'Enter the patient’s full name.'
    }
    if (mode === 'new' && !newPatient.cp_number.trim()) {
      nextErrors.cp_number = 'Enter the patient’s mobile number.'
    }
    if (
      mode === 'new' &&
      newPatient.cp_number &&
      !/^[\d\s+()-]{7,20}$/.test(newPatient.cp_number.trim())
    ) {
      nextErrors.cp_number = 'Enter a valid contact number.'
    }
    const visitTimestamp = visitDate ? new Date(visitDate) : null
    if (!visitDate || !visitDate.includes('T') || Number.isNaN(visitTimestamp?.getTime())) {
      nextErrors.visitDate = 'Set the date and time of the visit.'
    } else {
      const visitDateKey = toDateKey(visitTimestamp)
      const todayKey = toDateKey()
      if (visitDateKey > todayKey || (visitDateKey === todayKey && visitTimestamp > new Date())) {
        nextErrors.visitDate = 'A visit cannot be dated in the future.'
      }
    }

    const hasItems = items.some((item) => itemTotal(item) > 0)
    if (!hasItems) nextErrors.order = 'Add at least one order item with a quantity and price.'
    if (items.some((item) => itemTotal(item) < 0)) nextErrors.order = 'Prices cannot be negative.'
    if (paid < 0) nextErrors.amountPaid = 'Amount paid cannot be negative.'
    if (paid > orderTotal && orderTotal > 0) {
      nextErrors.amountPaid = 'Amount paid cannot exceed the order total.'
    }

    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) {
      toast.error('Please fix the highlighted fields')
      return
    }

    if (mode === 'new' && newPatient.cp_number.trim()) {
      try {
        const existing = await findPatientByMobile(newPatient.cp_number)
        if (existing) {
          setDuplicate(existing)
          return
        }
      } catch {
        // A failed lookup must never block recording a visit.
      }
    }
    setDuplicate(null)

    void confirm({
      title: 'Create this visit?',
      message: `Save the visit, order, and payment for ${patientContextLabel}?`,
      confirmLabel: 'Create visit',
      variant: 'default',
      onConfirm: saveVisitAction,
      errorMessage: 'Could not save the visit. Please try again.',
    })
  }

  const patientContextLabel =
    mode === 'new'
      ? newPatient.full_name.trim() || 'New patient'
      : selectedRecord?.full_name ?? selected?.full_name ?? 'Not selected'

  return (
    <>
      <PageHeader
        title="New Visit"
        description="Record the visit, prescription, order, and payment in one flow."
        action={
          <Button asChild variant="outline" size="sm">
            <Link to="/today">Back to Today</Link>
          </Button>
        }
      />

      <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 today-animate" style={{ animationDelay: '0ms' }}>
        <FlowStepper />
        <div className="grid gap-3 sm:grid-cols-3">
          <ContextStat
            icon={UserRound}
            label="Patient for this visit"
            value={patientContextLabel}
            tone={mode === 'existing' && !patientId ? 'warning' : 'neutral'}
          />
          <ContextStat icon={ClipboardList} label="Order total" value={formatPeso(orderTotal)} />
          <ContextStat
            icon={Banknote}
            label="Balance after payment"
            value={formatPeso(balanceDue)}
            tone={balanceDue > 0 ? 'error' : 'success'}
          />
        </div>
      </div>

      <form
        onSubmit={handleSubmit}
        noValidate
        className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_300px]"
      >
        <Card className="overflow-hidden today-animate" style={{ animationDelay: '60ms' }}>
          <CardSection
            id="section-patient"
            title="Patient"
            description="Pick someone from the roster or register a new record."
          >
            <div className="inline-flex rounded-control border border-champagne bg-ivory p-0.5">
              {[
                { value: 'existing', label: 'Existing patient' },
                { value: 'new', label: 'New patient' },
              ].map((tab) => (
                <button
                  key={tab.value}
                  type="button"
                  onClick={() => {
                    setMode(tab.value)
                    setErrors((prev) => ({ ...prev, patient: undefined, full_name: undefined }))
                    if (tab.value === 'new') {
                      selectPatient(null)
                      setPickingPatient(true)
                    }
                  }}
                  aria-pressed={mode === tab.value}
                  className={cn(
                    'rounded-[7px] px-4 py-2 text-[13px] font-medium transition-colors',
                    mode === tab.value
                      ? 'bg-white font-semibold text-espresso shadow-card'
                      : 'text-warmgray hover:text-espresso',
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {mode === 'existing' ? (
              <>
                {errors.patient && (
                  <div className="mt-4">
                    <ErrorNote message={errors.patient} />
                  </div>
                )}

                {patientId && selected && !pickingPatient ? (
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-control border border-gold/40 bg-gold-light/50 px-4 py-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <Avatar name={selected.full_name} />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-espresso">
                          {selected.full_name}
                        </p>
                        {selectedRecord && (
                          <p className="tabular text-[12px] text-warmgray">
                            {selectedRecord.cp_label} ·{' '}
                            {selectedRecord.cp_number ?? 'No contact number'}
                          </p>
                        )}
                      </div>
                      <Check className="size-4 shrink-0 text-gold-dark" aria-hidden="true" />
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setPickingPatient(true)}
                    >
                      Change patient
                    </Button>
                  </div>
                ) : (
                  <>
                    <div className="relative mt-4 max-w-md">
                      {searchBusy ? (
                        <Loader2
                          className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 animate-spin text-gold"
                          aria-hidden="true"
                        />
                      ) : (
                        <Search
                          className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-warmgray"
                          aria-hidden="true"
                        />
                      )}
                      <input
                        type="search"
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') {
                            event.preventDefault()
                            setDeferredSearch(search)
                          }
                          if (event.key === 'Escape') {
                            event.preventDefault()
                            setSearch('')
                            setDeferredSearch('')
                          }
                        }}
                        placeholder="Search by name or CP number"
                        aria-label="Search by name or CP number"
                        className="h-11 w-full rounded-control border border-champagne bg-ivory/50 pr-10 pl-10 text-sm text-espresso transition-all duration-200 placeholder:text-warmgray/55 focus:border-gold focus:bg-white focus:ring-2 focus:ring-gold/20 focus:outline-none"
                      />
                      {search.length > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            setSearch('')
                            setDeferredSearch('')
                          }}
                          className="absolute top-1/2 right-2.5 flex size-7 -translate-y-1/2 items-center justify-center rounded-md text-warmgray hover:bg-champagne/60 hover:text-espresso"
                          aria-label="Clear search"
                        >
                          <X className="size-4" aria-hidden="true" />
                        </button>
                      )}
                    </div>

                    {patients.showSkeleton && !patients.data ? (
                      <div className="mt-4 space-y-2">
                        {Array.from({ length: 4 }, (_, index) => (
                          <Skeleton key={index} className="h-12 w-full rounded-lg" />
                        ))}
                      </div>
                    ) : patients.data && patients.data.length > 0 ? (
                      <ul className="mt-4 max-h-56 space-y-1 overflow-y-auto rounded-control border border-champagne/80 p-1">
                        {patients.data.map((patient) => {
                          const active = patient.id === patientId
                          return (
                            <li key={patient.id}>
                              <button
                                type="button"
                                onClick={() => {
                                  selectPatient(patient.id)
                                  setPickingPatient(false)
                                }}
                                aria-pressed={active}
                                className={cn(
                                  'flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left transition-colors',
                                  active
                                    ? 'bg-gold-light ring-1 ring-gold/30'
                                    : 'hover:bg-ivory',
                                )}
                              >
                                <Avatar name={patient.full_name} className="size-8 text-[10px]" />
                                <span className="min-w-0 flex-1">
                                  <span className="block truncate text-sm font-medium text-espresso">
                                    {patient.full_name}
                                  </span>
                                  <span className="tabular block text-[12px] text-warmgray">
                                    {patient.cp_label} · {patient.cp_number ?? 'No contact number'}
                                  </span>
                                </span>
                                {active && (
                                  <Check
                                    className="size-4 shrink-0 text-gold-dark"
                                    aria-hidden="true"
                                  />
                                )}
                              </button>
                            </li>
                          )
                        })}
                      </ul>
                    ) : (
                      <p className="mt-4 text-[13px] text-warmgray">
                        {deferredSearch
                          ? 'No patients match that search.'
                          : 'No patients found. Switch to New patient to register someone.'}
                      </p>
                    )}
                  </>
                )}
              </>
            ) : (
              <>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <Input
                    id="full_name"
                    label="Full name"
                    placeholder="Juan Dela Cruz"
                    value={newPatient.full_name}
                    onChange={(event) =>
                      setNewPatient((prev) => ({ ...prev, full_name: event.target.value }))
                    }
                    error={errors.full_name}
                    required
                  />
                  <Input
                    id="cp_number"
                    label="Mobile number"
                    placeholder="0917 123 4567"
                    inputMode="tel"
                    value={newPatient.cp_number}
                    onChange={(event) => {
                      setDuplicate(null)
                      setNewPatient((prev) => ({ ...prev, cp_number: event.target.value }))
                    }}
                    error={errors.cp_number}
                    hint="Used as the record’s CP number."
                    required
                  />
                  <Input
                    id="patient_address"
                    label="Address"
                    placeholder="24 Kalachuchi St, Quezon City"
                    value={newPatient.address}
                    onChange={(event) =>
                      setNewPatient((prev) => ({ ...prev, address: event.target.value }))
                    }
                  />
                  <Input
                    id="patient_notes"
                    label="Notes"
                    placeholder="Prefers progressive lenses"
                    value={newPatient.notes}
                    onChange={(event) =>
                      setNewPatient((prev) => ({ ...prev, notes: event.target.value }))
                    }
                  />
                </div>

                {duplicate && (
                  <div className="mt-4 rounded-control border border-warning/40 bg-warning/5 px-4 py-3.5">
                    <p className="text-[13px] font-medium text-espresso">
                      {duplicate.full_name} already uses {duplicate.cp_number}.
                    </p>
                    <p className="mt-0.5 text-[12px] text-warmgray">
                      Reuse the existing record so their visits and payments stay in one place.
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button type="button" size="sm" onClick={useExistingDuplicate}>
                        Use existing patient
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setDuplicate(null)}
                      >
                        Create a separate record
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardSection>

          <CardSection
            id="section-visit"
            title="Visit details"
            description="When the patient came in and any notes for this encounter."
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <VisitDateTimeField
                id="visitDate"
                label="Date and time"
                value={visitDate}
                onChange={setVisitDate}
                error={errors.visitDate}
                required
                maxDate={toDateKey()}
                hint="Use Now for the current time, or pick the visit date and time below."
              />
              <div className="sm:col-span-2">
                <Textarea
                  id="notes"
                  label="Visit notes"
                  placeholder="Complaints, observations, follow-up…"
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  rows={3}
                />
              </div>
            </div>
          </CardSection>

          <CardSection
            id="section-rx"
            title="Prescription"
            description="Enter values per eye. Leave blank if not applicable."
          >
            <PrescriptionGrid rx={rx} setRx={setRx} />
          </CardSection>

          <CardSection
            id="section-order"
            title="Order"
            description="Line items for glasses or other products from this visit."
            action={
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setItems((prev) => [...prev, blankItem()])}
              >
                <Plus className="size-4" aria-hidden="true" />
                Add item
              </Button>
            }
          >
            {errors.order && (
              <div className="mb-4">
                <ErrorNote message={errors.order} />
              </div>
            )}

            <div className="space-y-3">
              {items.map((item, index) => (
                <div
                  key={item.key}
                  className="rounded-control border border-champagne bg-ivory/30 p-3.5"
                >
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <p className="text-[12px] font-semibold tracking-wide text-warmgray uppercase">
                      Item {index + 1}
                    </p>
                    <p className="tabular text-sm font-semibold text-espresso">
                      {formatPeso(itemTotal(item))}
                    </p>
                  </div>
                  <div className="space-y-4">
                    <ChoiceGroup
                      id={`type-${item.key}`}
                      label="Item"
                      layout="grid-3"
                      value={item.type}
                      options={ORDER_ITEM_TYPES}
                      onChange={(next) => setItem(item.key, { type: next })}
                    />
                    <ChoiceGroup
                      id={`lens-${item.key}`}
                      label="Lens type"
                      layout="grid-3"
                      value={item.lensType}
                      options={LENS_TYPES}
                      onChange={(next) => setItem(item.key, { lensType: next })}
                    />
                    <div className="grid items-end gap-3 sm:grid-cols-[8.5rem_1fr_2.5rem]">
                      <div>
                        <Label htmlFor={`qty-${item.key}`}>Qty</Label>
                        <div className="flex h-9 overflow-hidden rounded-control border border-champagne bg-white">
                          <button
                            type="button"
                            disabled={(parseInt(item.quantity, 10) || 1) <= 1}
                            onClick={() =>
                              setItem(item.key, {
                                quantity: String(Math.max(parseInt(item.quantity, 10) || 1, 1) - 1),
                              })
                            }
                            aria-label={`Decrease quantity for item ${index + 1}`}
                            className="flex w-8 shrink-0 items-center justify-center text-warmgray transition-colors hover:bg-gold-light/60 hover:text-espresso focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-gold disabled:cursor-not-allowed disabled:opacity-45"
                          >
                            <Minus className="size-3.5" aria-hidden="true" />
                          </button>
                          <input
                            id={`qty-${item.key}`}
                            type="number"
                            min="1"
                            step="1"
                            inputMode="numeric"
                            value={item.quantity}
                            onChange={(event) =>
                              setItem(item.key, { quantity: event.target.value })
                            }
                            className="h-full min-w-0 w-full border-x border-champagne bg-transparent text-center text-sm text-espresso focus:border-gold focus:ring-2 focus:ring-gold/20 focus:outline-none"
                          />
                          <button
                            type="button"
                            onClick={() =>
                              setItem(item.key, {
                                quantity: String(Math.max(parseInt(item.quantity, 10) || 1, 1) + 1),
                              })
                            }
                            aria-label={`Increase quantity for item ${index + 1}`}
                            className="flex w-8 shrink-0 items-center justify-center text-warmgray transition-colors hover:bg-gold-light/60 hover:text-espresso focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-gold"
                          >
                            <Plus className="size-3.5" aria-hidden="true" />
                          </button>
                        </div>
                      </div>
                      <Input
                        id={`price-${item.key}`}
                        label="Price each"
                        type="number"
                        min="0"
                        step="0.01"
                        inputMode="decimal"
                        placeholder="0.00"
                        leading="₱"
                        value={item.unitPrice}
                        onChange={(event) => setItem(item.key, { unitPrice: event.target.value })}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        disabled={items.length === 1}
                        onClick={() => setItems((prev) => prev.filter((row) => row.key !== item.key))}
                        aria-label={`Remove ${item.type} item`}
                      >
                        <Trash2 className="size-4" aria-hidden="true" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardSection>
        </Card>

        <aside className="min-w-0 space-y-4 lg:sticky lg:top-8">
          <section className="today-animate" style={{ animationDelay: '120ms' }}>
            <SectionTitle description="Deposit or full payment collected today.">
              Payment
            </SectionTitle>
            <Card className="overflow-hidden p-5 sm:p-6">
              <div className="space-y-4">
                <Input
                  id="amountPaid"
                  label="Amount paid"
                  type="number"
                  min="0"
                  step="0.01"
                  inputMode="decimal"
                  placeholder="0.00"
                  leading="₱"
                  value={amountPaid}
                  onChange={(event) => setAmountPaid(event.target.value)}
                  error={errors.amountPaid}
                  hint={paid > 0 ? paymentType : 'Leave blank if nothing was collected yet.'}
                />
                <ChoiceGroup
                  id="method"
                  label="Payment method"
                  layout="grid-2"
                  value={method}
                  options={PAYMENT_METHOD_OPTIONS}
                  onChange={setMethod}
                />
              </div>
            </Card>
          </section>

          <Card
            className="overflow-hidden border-gold/25 bg-linear-to-br from-ivory to-gold-light/20 p-5 today-animate"
            style={{ animationDelay: '160ms' }}
          >
            <h2 className="text-[11px] font-semibold tracking-wider text-warmgray uppercase">
              Summary
            </h2>
            <p className="tabular mt-2 font-display text-[28px] leading-none font-bold tracking-tight text-espresso">
              {formatPeso(orderTotal)}
            </p>
            <p className="mt-1 text-[13px] text-warmgray">Order total for this visit</p>
            <dl className="mt-4 space-y-2.5 border-t border-champagne/80 pt-4">
              <SummaryRow label="Amount paid" value={formatPeso(paid)} />
              <SummaryRow
                label="Balance due"
                value={formatPeso(balanceDue)}
                tone={balanceDue > 0 ? 'due' : 'settled'}
              />
            </dl>
          </Card>

          <div className="flex flex-col gap-2.5 today-animate" style={{ animationDelay: '200ms' }}>
            <Button type="submit" loading={saving} loadingText="Saving" disabled={!isOnline} className="w-full">
              <UserPlus className="size-4" aria-hidden="true" />
              Save visit
            </Button>
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => navigate('/today')}
            >
              Cancel
            </Button>
          </div>
        </aside>
      </form>
      </div>
    </>
  )
}
