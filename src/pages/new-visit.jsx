import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import {
  Banknote,
  Check,
  ClipboardList,
  Glasses,
  Loader2,
  Pencil,
  Plus,
  Search,
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
import { DatePicker } from '@/components/DatePicker'
import { VisitDateTimeField } from '@/components/visits/visit-datetime-field'
import { ErrorNote, Skeleton, EmptyState } from '@/components/ui/feedback'
import { OrderItemDrawer } from '@/components/visits/order-item-drawer'
import { PaymentMethodDrawer, paymentMethodOption } from '@/components/visits/payment-method-drawer'
import { useAsync } from '@/hooks/use-async'
import { useAuth } from '@/hooks/use-auth'
import { useConfirm } from '@/hooks/use-confirm'
import { useResultDialog } from '@/hooks/use-result-dialog'
import { useSupabaseHealth } from '@/hooks/use-supabase-health'
import { findPatientByMobile, listPatientRoster } from '@/services/patients.service'
import { invalidateClinicQueries } from '@/lib/query-client'
import { createVisitOrderTransaction, hasPrescription } from '@/services/visits.service'
import { paymentTypeFor } from '@/services/payments.service'
import {
  describeOrderItems,
  describePayment,
} from '@/lib/constants'
import { toInputDateTime, toDateKey } from '@/utils/dates'
import { formatPeso } from '@/utils/format'
import { computeAgeFromDob, formatAge } from '@/utils/age'
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
  name: '',
  lensType: 'Single Vision',
  lensOption: 'Not applicable',
  quantity: '1',
  unitPrice: '',
})

function itemTotal(item) {
  const quantity = Math.max(parseInt(item.quantity, 10) || 0, 0)
  const price = Number(item.unitPrice) || 0
  return quantity * price
}

function itemLabel(item) {
  return item.name?.trim() || item.type
}

function itemDetails(item) {
  return [item.lensType, item.lensOption]
    .filter((value) => value && value !== 'Not applicable')
    .join(' · ')
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
    <div className="space-y-4">
      {/* Mobile: stacked cards per eye */}
      <div className="md:hidden space-y-4">
        {eyes.map(({ prefix, label, hint }) => (
          <div key={prefix} className="rounded-control border border-champagne bg-surface p-4">
            <h4 className="mb-3 flex items-center gap-2 font-display text-[13px] font-bold text-gold-dark">
              <span className="flex size-8 items-center justify-center rounded-lg bg-gold-light/50 text-gold-dark">{label}</span>
              <span className="sr-only">{hint}</span>
            </h4>
            <div className="grid grid-cols-3 gap-2">
              {RX_COLUMNS.map((col) => (
                <div key={`${prefix}_${col.key}`} className="col-span-1">
                  <Label htmlFor={`${prefix}_${col.key}`} className="sr-only">
                    {label} {col.label}
                  </Label>
                  <input
                    id={`${prefix}_${col.key}`}
                    type="text"
                    inputMode="decimal"
                    value={rx[`${prefix}_${col.key}`]}
                    onChange={(event) =>
                      setRx((prev) => ({ ...prev, [`${prefix}_${col.key}`]: event.target.value }))
                    }
                    placeholder={col.placeholder}
                    className={cn(
                      controlVariants({ invalid: false }),
                      'min-h-[44px] tabular text-center text-sm',
                    )}
                  />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Desktop: table */}
      <div className="hidden md:block overflow-x-auto rounded-control border border-champagne">
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
                        type="text"
                        inputMode="decimal"
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

  const [items, setItems] = useState([])
  const [includeOrder, setIncludeOrder] = useState(true)
  const [amountPaid, setAmountPaid] = useState('')
  const [method, setMethod] = useState(() => getDefaultPaymentMethod(userId))
  const [orderDrawer, setOrderDrawer] = useState({ open: false, index: null })
  const [paymentDrawerOpen, setPaymentDrawerOpen] = useState(false)

  const [newPatient, setNewPatient] = useState({
    full_name: '',
    cp_number: '',
    address: '',
    notes: '',
    visit_date: toDateKey(),
    date_of_birth: '',
    age: '',
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
  const hasOrder = includeOrder && items.some((item) => itemTotal(item) > 0)
  const paid = Number(amountPaid) || 0
  const balanceDue = hasOrder ? Math.max(orderTotal - paid, 0) : 0
  const paymentType = hasOrder ? paymentTypeFor(orderTotal, paid) : 'Unpaid'

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

  const openAddItem = () => {
    setIncludeOrder(true)
    setOrderDrawer({ open: true, index: null })
  }
  const openEditItem = (index) => setOrderDrawer({ open: true, index })
  const closeOrderDrawer = () => setOrderDrawer({ open: false, index: null })

  const saveOrderItem = (next) => {
    const editing = orderDrawer.index
    if (editing == null) {
      setItems((prev) => [...prev, { ...next, key: blankItem().key }])
    } else {
      setItems((prev) =>
        prev.map((item, index) => (index === editing ? { ...next, key: item.key } : item)),
      )
    }
    closeOrderDrawer()
  }

  const removeItem = (index) => {
    const item = items[index]
    void confirm({
      title: 'Remove this item?',
      message: `${itemLabel(item)} will be removed from the order.`,
      confirmLabel: 'Remove item',
      onConfirm: () => setItems((prev) => prev.filter((_, i) => i !== index)),
      errorMessage: 'Could not remove the item. Please try again.',
    })
  }

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
      if (!progress.order) {
        progress.transactionIdempotencyKey ??= crypto.randomUUID()
        const transaction = await createVisitOrderTransaction({
          patient_id: mode === 'existing' ? patientId : null,
          new_patient: mode === 'new'
            ? {
                ...newPatient,
                visit_date: newPatient.visit_date || toDateKey(),
                date_of_birth: newPatient.date_of_birth || null,
                age: newPatient.date_of_birth
                  ? null
                  : (newPatient.age !== '' ? Number(newPatient.age) : null),
                address: newPatient.address || '',
                notes: newPatient.notes || '',
              }
            : null,
          visit_date: new Date(visitDate).toISOString(),
          notes,
          prescription: hasPrescription(rx) ? rx : null,
          description: hasOrder ? describeOrderItems(items.filter((item) => itemTotal(item) > 0)) : null,
          total_amount: hasOrder ? orderTotal : null,
          order_date: toDateKey(new Date(visitDate)),
          initial_payment: hasOrder ? paid : 0,
          payment_date: hasOrder && paid > 0 ? toDateKey(new Date(visitDate)) : null,
          payment_notes: hasOrder && paid > 0 ? describePayment(method, paymentType) : null,
          idempotency_key: progress.transactionIdempotencyKey,
        })
        progress.patient = transaction.patient
        progress.patientId = transaction.patient.id
        progress.visit = transaction.visit
        progress.order = transaction.order
        progress.payment = Boolean(transaction.payment)
      }

      if (mode === 'new' && !progress.patientInitialized) {
        setJustCreated({ id: progress.patientId, full_name: progress.patient.full_name })
        selectPatient(progress.patientId)
        progress.patientInitialized = true
      }

      const order = progress.order
      const patientName = progress.patient.full_name ?? selected?.full_name ?? newPatient.full_name ?? 'Patient'
      saveProgressRef.current = {}
      invalidateClinicQueries(
        userId,
        'loadPatients',
        'loadVisits',
        'loadOrders',
        'loadSummary',
        'loadPayments',
        'loadFollowups',
      )
      resultDialog.success({
        title: order ? 'Visit and order saved' : 'Visit saved',
        message: order
          ? `${patientName} · ${order.order_number}. ${balanceDue > 0 ? 'Deposit received.' : 'Paid in full.'}`
          : `${patientName}'s visit was saved without an order.`,
        primaryLabel: order ? 'View order' : 'View patients',
        onPrimary: () => navigate(order
          ? `/orders?search=${encodeURIComponent(order.order_number)}`
          : `/patients?search=${encodeURIComponent(patientName)}`),
      })
      navigate(order ? '/orders' : '/patients')
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
    if (mode === 'new' && newPatient.visit_date && newPatient.visit_date > toDateKey()) {
      nextErrors.visit_date = 'Patient visit date cannot be in the future.'
    }
    if (
      mode === 'new' &&
      newPatient.cp_number &&
      !/^[\d\s+()-]{7,20}$/.test(newPatient.cp_number.trim())
    ) {
      nextErrors.cp_number = 'Enter a valid contact number.'
    }
    if (mode === 'new' && newPatient.date_of_birth && newPatient.date_of_birth > toDateKey()) {
      nextErrors.date_of_birth = 'Date of birth cannot be in the future.'
    }
    if (mode === 'new' && !newPatient.date_of_birth && newPatient.age !== '') {
      const ageNum = Number(newPatient.age)
      if (!Number.isInteger(ageNum) || ageNum < 0 || ageNum > 120) {
        nextErrors.age = 'Age must be a whole number between 0 and 120.'
      }
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
    if (includeOrder && !hasItems) nextErrors.order = 'Add an order item or turn off order creation.'
    if (items.some((item) => itemTotal(item) < 0)) nextErrors.order = 'Prices cannot be negative.'
    if (paid < 0) nextErrors.amountPaid = 'Amount paid cannot be negative.'
    if (!includeOrder && paid > 0) nextErrors.amountPaid = 'Add an order before recording a payment.'
    if (includeOrder && paid > orderTotal && orderTotal > 0) {
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
      message: includeOrder
        ? `Save the visit, order, and payment for ${patientContextLabel}?`
        : `Save a visit for ${patientContextLabel} without creating an order?`,
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
          <ContextStat
            icon={ClipboardList}
            label="Order total"
            value={hasOrder ? formatPeso(orderTotal) : includeOrder ? 'Add items' : 'No order'}
          />
          <ContextStat
            icon={Banknote}
            label={hasOrder ? 'Balance after payment' : 'Payment'}
            value={hasOrder ? formatPeso(balanceDue) : includeOrder ? 'Add items' : 'Not applicable'}
            tone={hasOrder && balanceDue > 0 ? 'error' : 'neutral'}
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
                      ? 'bg-surface font-semibold text-espresso shadow-card'
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
                            {selectedRecord.cp_label} · Age: {formatAge(selectedRecord)} ·{' '}
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
                        className="h-11 w-full rounded-control border border-champagne bg-ivory/50 pr-10 pl-10 text-sm text-espresso transition-all duration-200 placeholder:text-warmgray/55 focus:border-gold focus:bg-surface focus:ring-2 focus:ring-gold/20 focus:outline-none"
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
                                    {patient.cp_label} · Age: {formatAge(patient)} · {patient.cp_number ?? 'No contact number'}
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

                  <DatePicker
                    id="new_patient_visit_date"
                    label="Visit date"
                    value={newPatient.visit_date}
                    onChange={(visit_date) => {
                      setNewPatient((prev) => ({ ...prev, visit_date }))
                      if (errors.visit_date) setErrors((prev) => ({ ...prev, visit_date: '' }))
                    }}
                    maxDate={toDateKey()}
                    error={errors.visit_date}
                  />

                  <DatePicker
                    id="new_date_of_birth"
                    label="Date of Birth"
                    required={false}
                    value={newPatient.date_of_birth}
                    onChange={(date_of_birth) => {
                      setNewPatient((prev) => ({ ...prev, date_of_birth }))
                      if (errors.date_of_birth) setErrors((prev) => ({ ...prev, date_of_birth: '' }))
                    }}
                    maxDate={toDateKey()}
                    error={errors.date_of_birth}
                  />

                  {/* Age — computed when DOB is entered, editable fallback otherwise */}
                  <div>
                    <label
                      htmlFor="new_age_field"
                      className="mb-1.5 block text-[13px] font-medium text-espresso"
                    >
                      Age
                      {newPatient.date_of_birth && (
                        <span className="ml-2 text-[11px] font-normal text-warmgray">(auto-calculated)</span>
                      )}
                    </label>
                    {newPatient.date_of_birth ? (
                      <div
                        id="new_age_field"
                        className="flex h-11 w-full items-center rounded-[var(--radius-control)] border border-champagne/60 bg-ivory px-3.5 text-sm text-warmgray"
                      >
                        {computeAgeFromDob(newPatient.date_of_birth) !== null
                          ? `${computeAgeFromDob(newPatient.date_of_birth)} years old`
                          : '—'}
                      </div>
                    ) : (
                      <Input
                        id="new_age_field"
                        type="number"
                        inputMode="numeric"
                        min={0}
                        max={120}
                        step={1}
                        placeholder="e.g. 35"
                        value={newPatient.age}
                        onChange={(event) => {
                          setNewPatient((prev) => ({ ...prev, age: event.target.value }))
                          if (errors.age) setErrors((prev) => ({ ...prev, age: '' }))
                        }}
                        error={errors.age}
                        hint="Leave blank if unknown."
                      />
                    )}
                  </div>
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
            description="An order is optional for this visit."
            action={
              <Button type="button" variant="outline" size="sm" onClick={openAddItem}>
                <Plus className="size-4" aria-hidden="true" />
                Add item
              </Button>
            }
          >
            <label className="mb-4 flex cursor-pointer items-start gap-3 rounded-control border border-champagne bg-ivory/40 px-3.5 py-3 select-none transition-colors hover:bg-ivory/70">
              <input
                type="checkbox"
                checked={includeOrder}
                onChange={(event) => {
                  setIncludeOrder(event.target.checked)
                  if (!event.target.checked) setAmountPaid('')
                }}
                className="sr-only peer"
              />
              <span
                aria-hidden="true"
                className={cn(
                  'mt-0.5 inline-flex size-4.5 shrink-0 items-center justify-center rounded-[5px] border transition-all duration-150',
                  'peer-focus-visible:ring-2 peer-focus-visible:ring-gold/40 peer-focus-visible:ring-offset-1',
                  includeOrder
                    ? 'border-gold-dark bg-gold-dark text-white shadow-xs'
                    : 'border-champagne bg-surface hover:border-gold/50',
                )}
              >
                {includeOrder && (
                  <Check
                    className="size-3 text-white"
                    strokeWidth={2.5}
                    aria-hidden="true"
                  />
                )}
              </span>
              <span>
                <span className="block text-[13px] font-medium text-espresso">Create an order for this visit</span>
                <span className="mt-0.5 block text-[12px] text-warmgray">Turn this off to save only the patient and visit.</span>
              </span>
            </label>

            {includeOrder ? (
              <>
            {errors.order && (
              <div className="mb-4">
                <ErrorNote message={errors.order} />
              </div>
            )}

            {items.length === 0 ? (
              <EmptyState
                icon={Glasses}
                title="No items added yet"
                description="Add glasses, lenses, or services to build this visit’s order."
                action={
                  <Button type="button" size="sm" onClick={openAddItem}>
                    <Plus className="size-4" aria-hidden="true" />
                    Add your first item
                  </Button>
                }
              />
            ) : (
              <>
                <div className="hidden overflow-hidden rounded-control border border-champagne sm:block">
                  <table className="w-full border-collapse text-sm">
                    <thead>
                      <tr className="border-b border-champagne bg-ivory/70 text-[11px] tracking-wide text-warmgray uppercase">
                        <th className="px-3 py-2.5 text-left font-semibold">Item</th>
                        <th className="px-3 py-2.5 text-left font-semibold">Details</th>
                        <th className="px-3 py-2.5 text-center font-semibold">Qty</th>
                        <th className="px-3 py-2.5 text-right font-semibold">Price</th>
                        <th className="px-3 py-2.5 text-right font-semibold">Subtotal</th>
                        <th className="px-3 py-2.5 text-right font-semibold">
                          <span className="sr-only">Actions</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((item, index) => (
                        <tr
                          key={item.key}
                          className="border-b border-champagne/70 last:border-b-0"
                        >
                          <td className="px-3 py-2.5 font-medium text-espresso">
                            {itemLabel(item)}
                          </td>
                          <td className="px-3 py-2.5 text-warmgray">
                            {itemDetails(item) || '—'}
                          </td>
                          <td className="tabular px-3 py-2.5 text-center text-espresso">
                            {item.quantity}
                          </td>
                          <td className="tabular px-3 py-2.5 text-right text-espresso">
                            {formatPeso(Number(item.unitPrice) || 0)}
                          </td>
                          <td className="tabular px-3 py-2.5 text-right font-semibold text-espresso">
                            {formatPeso(itemTotal(item))}
                          </td>
                          <td className="px-3 py-2.5">
                            <div className="flex justify-end gap-1">
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => openEditItem(index)}
                                aria-label={`Edit ${itemLabel(item)}`}
                              >
                                <Pencil className="size-4" aria-hidden="true" />
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => removeItem(index)}
                                aria-label={`Remove ${itemLabel(item)}`}
                              >
                                <Trash2 className="size-4" aria-hidden="true" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <ul className="space-y-2.5 sm:hidden">
                  {items.map((item, index) => (
                    <li
                      key={item.key}
                      className="rounded-control border border-champagne bg-ivory/30 p-3.5"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <p className="min-w-0 truncate text-sm font-semibold text-espresso">
                          {itemLabel(item)}
                        </p>
                        <p className="tabular shrink-0 text-sm font-semibold text-espresso">
                          {formatPeso(itemTotal(item))}
                        </p>
                      </div>
                      {itemDetails(item) && (
                        <p className="mt-0.5 text-[12px] text-warmgray">{itemDetails(item)}</p>
                      )}
                      <div className="mt-2.5 flex items-center justify-between">
                        <p className="tabular text-[12px] text-warmgray">
                          {item.quantity} × {formatPeso(Number(item.unitPrice) || 0)}
                        </p>
                        <div className="flex gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => openEditItem(index)}
                            aria-label={`Edit ${itemLabel(item)}`}
                          >
                            <Pencil className="size-4" aria-hidden="true" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => removeItem(index)}
                            aria-label={`Remove ${itemLabel(item)}`}
                          >
                            <Trash2 className="size-4" aria-hidden="true" />
                          </Button>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </>
            )}
              </>
            ) : (
              <p className="rounded-control border border-champagne px-4 py-5 text-center text-[13px] text-warmgray">
                This visit will be saved without an order or payment.
              </p>
            )}
          </CardSection>
        </Card>

        <aside className="min-w-0 space-y-4 lg:sticky lg:top-8">
          <section className="today-animate" style={{ animationDelay: '120ms' }}>
            <SectionTitle description={includeOrder
              ? 'Deposit or full payment collected today.'
              : 'Add an order before recording payment.'}>
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
                  hint={!includeOrder
                    ? 'Enable order creation to record a payment.'
                    : paid > 0 ? paymentType : 'Leave blank if nothing was collected yet.'}
                  disabled={!includeOrder}
                />
                <div>
                  <Label>Payment method</Label>
                  <div className="mt-1.5 flex items-center gap-2.5 rounded-control border border-champagne bg-ivory/40 px-3.5 py-2.5">
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-gold-light/60 text-gold-dark">
                      {(() => {
                        const Icon = paymentMethodOption(method).icon
                        return <Icon className="size-4" strokeWidth={1.8} aria-hidden="true" />
                      })()}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm font-medium text-espresso">
                      {paymentMethodOption(method).label}
                    </span>
                    <Check className="size-4 shrink-0 text-gold-dark" aria-hidden="true" />
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="mt-2 w-full"
                    onClick={() => setPaymentDrawerOpen(true)}
                    disabled={!includeOrder}
                  >
                    Change Payment Method
                  </Button>
                  <p className="mt-1.5 text-xs text-warmgray">
                    Applies to the payment recorded when you save this visit.
                  </p>
                </div>
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
              {includeOrder ? formatPeso(orderTotal) : 'No order'}
            </p>
            <p className="mt-1 text-[13px] text-warmgray">
              {includeOrder ? 'Order total for this visit' : 'Patient and visit only'}
            </p>
            <dl className="mt-4 space-y-2.5 border-t border-champagne/80 pt-4">
              {includeOrder && (
                <>
                  <SummaryRow label="Amount paid" value={formatPeso(paid)} />
                  <SummaryRow
                    label="Balance due"
                    value={formatPeso(balanceDue)}
                    tone={balanceDue > 0 ? 'due' : 'settled'}
                  />
                </>
              )}
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

      <OrderItemDrawer
        open={orderDrawer.open}
        item={orderDrawer.index != null ? items[orderDrawer.index] : null}
        onClose={closeOrderDrawer}
        onSave={saveOrderItem}
      />

      <PaymentMethodDrawer
        open={paymentDrawerOpen}
        method={method}
        onClose={() => setPaymentDrawerOpen(false)}
        onSelect={setMethod}
      />
    </>
  )
}
