import { Link } from 'react-router-dom'
import { CalendarDays, ClipboardPlus, Clock3, NotebookPen } from 'lucide-react'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/ui/badge'
import { EmptyState, Skeleton } from '@/components/ui/feedback'
import { PrescriptionTable } from '@/components/visits/prescription-table'
import { useAsync } from '@/hooks/use-async'
import { getPatientDetail } from '@/services/patients.service'
import { formatDate, formatDateShort, formatPeso, formatTime } from '@/utils/format'

function SectionLabel({ children }) {
  return (
    <h3 className="text-[11px] font-semibold tracking-wider text-warmgray uppercase">{children}</h3>
  )
}

function Field({ label, children }) {
  return (
    <div className="min-w-0 border-b border-champagne/70 py-3">
      <dt className="text-[11px] font-semibold tracking-wider text-warmgray uppercase">{label}</dt>
      <dd className="mt-1 text-sm wrap-break-word text-espresso">{children}</dd>
    </div>
  )
}

function Summary({ label, value, tone = 'default' }) {
  return (
    <div className="min-w-0">
      <dt className="text-[10px] font-semibold tracking-wider text-warmgray uppercase">{label}</dt>
      <dd
        className={
          tone === 'due'
            ? 'tabular mt-0.5 text-[13px] font-semibold text-error'
            : 'tabular mt-0.5 text-[13px] text-espresso'
        }
      >
        {value}
      </dd>
    </div>
  )
}

/**
 * Timeline entry. Orders and visits share one left rail so a patient's whole
 * story reads as a single chronological list rather than a stack of cards.
 */
function TimelineItem({ date, meta, status, children, action }) {
  return (
    <li className="relative border-l border-champagne pb-7 pl-6 last:pb-0">
      <span
        className="absolute -left-1.25 top-1.5 size-2.5 rounded-full border-2 border-surface bg-gold"
        aria-hidden="true"
      />
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <p className="text-sm font-semibold text-espresso">{date}</p>
        {action ?? (status ? <StatusBadge status={status} /> : meta)}
      </div>
      {children}
    </li>
  )
}

/** Patient details drawer — opened from the Patients table row or View button. */
export function PatientDrawer({ patientId, cpLabel, onClose }) {
  const detail = useAsync(
    () => (patientId ? getPatientDetail(patientId) : Promise.resolve(null)),
    [patientId],
    'loadVisits',
  )

  // Fully controlled: the parent owns which patient is selected, so the sheet
  // must not keep a copy of that state that can drift out of sync.
  const handleOpenChange = (next) => {
    if (!next) onClose()
  }

  const patient = detail.data?.patient
  const orders = detail.data?.orders ?? []
  const visits = detail.data?.visits ?? []
  const nextFollowUp = detail.data?.nextFollowUp ?? null
  const balance = detail.data?.balance ?? 0

  return (
    <Sheet open={Boolean(patientId)} onOpenChange={handleOpenChange}>
      <SheetContent
        title={patient?.full_name ?? 'Patient details'}
        description={cpLabel}
        footer={
          <Button asChild size="sm">
            <Link
              to={`/new-visit?patient=${patientId}`}
              onClick={() => handleOpenChange(false)}
            >
              <ClipboardPlus className="size-4" aria-hidden="true" />
              Create New Visit
            </Link>
          </Button>
        }
      >
        {detail.loading ? (
          <div className="space-y-4">
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        ) : detail.data ? (
          <div className="space-y-8">
            {/* Balance sits at the top because it is the number staff look for. */}
            <div className="rounded-control border border-champagne bg-ivory px-4 py-3.5">
              <p className="text-[11px] font-semibold tracking-wider text-warmgray uppercase">
                Outstanding balance
              </p>
              <p
                className={
                  balance > 0
                    ? 'tabular mt-1 font-display text-2xl font-bold text-error'
                    : 'tabular mt-1 font-display text-2xl font-bold text-success'
                }
              >
                {formatPeso(balance)}
              </p>
            </div>

            <section>
              <SectionLabel>Patient information</SectionLabel>
              <dl className="mt-1.5 grid gap-x-6 sm:grid-cols-2">
                <Field label="CP Number">{cpLabel ?? '—'}</Field>
                <Field label="Contact">{patient.cp_number || '—'}</Field>
                <Field label="Address">{patient.address || '—'}</Field>
                <Field label="Date added">{formatDateShort(patient.created_at)}</Field>
              </dl>
            </section>

            {nextFollowUp && (
              <section className="rounded-control border border-gold/60 bg-gold-light/30 px-4 py-3.5">
                <SectionLabel>Next follow-up</SectionLabel>
                <div className="mt-2 flex items-start gap-3">
                  <div className="mt-0.5 rounded-lg bg-surface p-2 text-gold-dark">
                    <CalendarDays className="size-4" strokeWidth={1.8} />
                  </div>
                  <div className="min-w-0">
                    <p className="font-display text-lg font-semibold text-espresso">
                      {formatDate(nextFollowUp.appointment_date)}
                    </p>
                    <p className="mt-1 flex items-center gap-1.5 text-[12px] text-warmgray">
                      <Clock3 className="size-3.5" strokeWidth={1.8} />
                      {formatTime(
                        new Date(`${nextFollowUp.appointment_date}T${nextFollowUp.appointment_time}`),
                      )}{' '}
                      • {nextFollowUp.appointment_type}
                    </p>
                    <p className="mt-1 text-[12px] text-warmgray">{nextFollowUp.status}</p>
                    {nextFollowUp.notes && (
                      <p className="mt-2 text-[13px] leading-relaxed text-espresso">{nextFollowUp.notes}</p>
                    )}
                  </div>
                </div>
              </section>
            )}

            <section>
              <SectionLabel>Visit &amp; order history</SectionLabel>

              {orders.length === 0 && visits.length === 0 ? (
                <EmptyState
                  icon={NotebookPen}
                  title="Nothing recorded yet"
                  description="Visits and orders for this patient will appear here."
                  className="py-10"
                />
              ) : (
                <ol className="mt-4">
                  {orders.map((order) => (
                    <TimelineItem
                      key={order.id}
                      date={`${order.order_number} · ${formatDateShort(order.order_date)}`}
                      status={order.status}
                    >
                      <dl className="mt-2.5 grid grid-cols-3 gap-3">
                        <Summary label="Total" value={formatPeso(order.total_amount)} />
                        <Summary label="Paid" value={formatPeso(order.paid)} />
                        <Summary
                          label="Balance"
                          value={formatPeso(order.balance)}
                          tone={order.balance > 0 ? 'due' : 'default'}
                        />
                      </dl>
                    </TimelineItem>
                  ))}

                  {visits.map((visit) => (
                    <TimelineItem
                      key={visit.id}
                      date={formatDate(visit.visit_date)}
                      action={
                        <span className="tabular text-xs text-warmgray">
                          {formatTime(visit.visit_date)}
                        </span>
                      }
                    >
                      <div className="mt-2">
                        <PrescriptionTable prescription={visit.prescriptions[0] ?? null} />
                      </div>
                      {visit.notes && (
                        <p className="mt-2.5 text-[13px] text-warmgray">{visit.notes}</p>
                      )}
                    </TimelineItem>
                  ))}
                </ol>
              )}
            </section>

            {patient.notes && (
              <section>
                <SectionLabel>Notes</SectionLabel>
                <p className="mt-2 text-[13px] leading-relaxed text-espresso">{patient.notes}</p>
              </section>
            )}
          </div>
        ) : (
          <p className="text-[13px] text-warmgray">Patient details unavailable.</p>
        )}
      </SheetContent>
    </Sheet>
  )
}
