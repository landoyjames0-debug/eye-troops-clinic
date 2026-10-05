import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  Eye,
  Pencil,
  Plus,
  UserSearch,
  Users,
  AlertCircle,
  Calendar,
} from 'lucide-react'
import { PageHeader, Avatar } from '@/components/layout/page-header'
import { Card, Table, TBody, TD, TH, THead, TR } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Pagination } from '@/components/ui/pagination'
import { EmptyState, ErrorNote, SkeletonRows } from '@/components/ui/feedback'
import { useAuth } from '@/hooks/use-auth'
import { useAsync } from '@/hooks/use-async'
import { useDebouncedSearchParam } from '@/hooks/use-debounced-search-param'
import { listPatients } from '@/services/patients.service'
import { PatientDrawer } from '@/components/patients/patient-drawer'
import { PatientFormDialog } from '@/components/patients/patient-form-dialog'
import { invalidateClinicQueries } from '@/lib/query-client'
import { TABLE_PAGE_SIZE } from '@/lib/constants'
import { formatDateShort, formatPeso, formatTime } from '@/utils/format'
import { SearchInput } from '@/components/ui/search-input'
import { cn } from '@/lib/utils'

const FILTER_OPTIONS = [
  { key: 'all', label: 'All' },
  { key: 'balance', label: 'Balance due' },
  { key: 'recent', label: 'This week' },
]

function isRecentVisit(patient) {
  if (!patient.last_visit?.visit_date) return false
  const days = Math.floor(
    (Date.now() - Date.parse(patient.last_visit.visit_date)) / 86_400_000,
  )
  return days <= 7
}

function getFilterLabel(key) {
  return FILTER_OPTIONS.find((option) => option.key === key)?.label ?? 'All'
}

/* ── Mini stat card for the top banner ─────────────────────────── */

function MiniStat({ icon: Icon, label, value, tone = 'neutral', active = false, onClick }) {
  const tones = {
    neutral: {
      iconBg: 'bg-gradient-to-br from-gold-light to-champagne',
      iconColor: 'text-gold-dark',
      valueColor: 'text-espresso',
      activeBorder: 'border-gold/70',
    },
    success: {
      iconBg: 'bg-gradient-to-br from-success/15 to-success/5',
      iconColor: 'text-success',
      valueColor: 'text-success',
      activeBorder: 'border-success/60',
    },
    warning: {
      iconBg: 'bg-gradient-to-br from-warning/15 to-warning/5',
      iconColor: 'text-warning',
      valueColor: 'text-warning',
      activeBorder: 'border-warning/60',
    },
    error: {
      iconBg: 'bg-gradient-to-br from-error/15 to-error/5',
      iconColor: 'text-error',
      valueColor: 'text-error',
      activeBorder: 'border-error/60',
    },
  }
  const s = tones[tone] || tones.neutral

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`flex w-full items-center gap-3 rounded-card border bg-surface px-4 py-3 text-left shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:shadow-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/30 ${
        active
          ? `border-gold bg-gold-light/35 shadow-raised ${s.activeBorder}`
          : 'border-champagne/60 hover:border-gold/55'
      }`}
    >
      <span className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${s.iconBg} ${s.iconColor}`}>
        <Icon className="size-5" strokeWidth={1.7} />
      </span>
      <div>
        <p className={`tabular font-display text-xl font-bold ${s.valueColor}`}>{value}</p>
        <p className="text-[11px] text-warmgray">{label}</p>
      </div>
    </button>
  )
}

export default function PatientsPage() {
  const { userId } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const { search, setSearch, deferredSearch, searchPending } = useDebouncedSearchParam()
  const initialFilter = searchParams.get('filter') ?? 'all'
  const requestedPatientId = searchParams.get('patient')

  const [selectedId, setSelectedId] = useState(null)
  const [editingPatient, setEditingPatient] = useState(null)
  const [page, setPage] = useState(1)

  const patients = useAsync(
    () => listPatients(deferredSearch),
    [deferredSearch],
    'loadPatients',
    { key: 'patient-roster' },
  )

  useEffect(() => {
    if (requestedPatientId) setSelectedId(requestedPatientId)
  }, [requestedPatientId])

  const selected = useMemo(
    () => patients.data?.find((row) => row.id === selectedId) ?? null,
    [patients.data, selectedId],
  )

  const total = patients.data?.length ?? 0
  const activeFilter = FILTER_OPTIONS.some((option) => option.key === initialFilter)
    ? initialFilter
    : 'all'

  const filteredPatients = useMemo(() => {
    if (!patients.data) return []
    if (activeFilter === 'balance') {
      return patients.data.filter((patient) => patient.balance > 0)
    }
    if (activeFilter === 'recent') {
      return patients.data.filter(isRecentVisit)
    }
    return patients.data
  }, [activeFilter, patients.data])

  const filteredTotal = filteredPatients.length
  const pageCount = Math.max(Math.ceil(filteredTotal / TABLE_PAGE_SIZE), 1)
  const currentPage = Math.min(page, pageCount)
  const pageRows = filteredPatients.slice(
    (currentPage - 1) * TABLE_PAGE_SIZE,
    currentPage * TABLE_PAGE_SIZE,
  )

  /* ── Computed stats for the banner ─────────────────────────────── */
  const withBalance = useMemo(
    () => (patients.data ?? []).filter((p) => p.balance > 0).length,
    [patients.data],
  )
  const recentVisits = useMemo(
    () =>
      (patients.data ?? []).filter((p) => {
        if (!p.last_visit?.visit_date) return false
        const days = Math.floor(
          (Date.now() - Date.parse(p.last_visit.visit_date)) / 86_400_000,
        )
        return days <= 7
      }).length,
    [patients.data],
  )

  const searchBusy = searchPending || patients.loading

  useEffect(() => {
    setPage(1)
  }, [deferredSearch, activeFilter])

  useEffect(() => {
    const inUrl = searchParams.get('filter') ?? 'all'
    if (inUrl === activeFilter) return
    const next = new URLSearchParams(searchParams)
    if (activeFilter === 'all') next.delete('filter')
    else next.set('filter', activeFilter)
    setSearchParams(next, { replace: true })
  }, [activeFilter, searchParams, setSearchParams])

  const setActiveFilter = (nextFilter) => {
    const next = new URLSearchParams(searchParams)
    if (nextFilter === 'all') next.delete('filter')
    else next.set('filter', nextFilter)
    setSearchParams(next, { replace: true })
  }

  const clearSearch = () => {
    setSearch('')
  }

  return (
    <>
      <PageHeader
        title="Patients"
        description="View patient records, visit history, and balances."
        action={
          <Button asChild size="sm">
            <Link to="/new-visit">
              <Plus className="size-4" aria-hidden="true" />
              New Visit
            </Link>
          </Button>
        }
      />

      <div className="flex flex-col gap-6">
      {patients.data && !patients.error && (
        <div className={cn('grid gap-3 today-animate sm:grid-cols-3 transition-opacity duration-150', searchBusy && 'opacity-60')} style={{ animationDelay: '0ms' }}>
          <MiniStat
            icon={Users}
            label="Total patients"
            value={total}
            tone="neutral"
            active={activeFilter === 'all'}
            onClick={() => setActiveFilter('all')}
          />
          <MiniStat
            icon={AlertCircle}
            label="With balance"
            value={withBalance}
            tone={withBalance > 0 ? 'error' : 'success'}
            active={activeFilter === 'balance'}
            onClick={() => setActiveFilter('balance')}
          />
          <MiniStat
            icon={Calendar}
            label="Visited this week"
            value={recentVisits}
            tone="success"
            active={activeFilter === 'recent'}
            onClick={() => setActiveFilter('recent')}
          />
        </div>
      )}

      <Card className="overflow-hidden today-animate" style={{ animationDelay: '60ms' }}>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-champagne px-5 py-3.5">
          <SearchInput
            value={search}
            onChange={setSearch}
            loading={searchBusy}
            className="w-full sm:max-w-sm"
              placeholder="Search by name or CP number"
            ariaLabel="Search by name or CP number"
          />

          {patients.data && !patients.error && (
            <div
              role="group"
              aria-label="Patient filters"
              className={cn('flex flex-wrap items-center gap-1.5 transition-opacity duration-150', searchBusy && 'opacity-60')}
            >
              {FILTER_OPTIONS.map((option) => {
                const isActive = activeFilter === option.key
                return (
                  <button
                    key={option.key}
                    type="button"
                    aria-pressed={isActive}
                    onClick={() => setActiveFilter(option.key)}
                    className={`inline-flex min-h-9 shrink-0 items-center rounded-md border px-2.5 py-1 text-[12px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:ring-offset-surface ${
                      isActive
                        ? 'border-gold bg-gold-light text-gold-dark ring-1 ring-current/20'
                        : 'border-champagne bg-surface text-warmgray hover:border-gold/55 hover:text-espresso'
                    }`}
                  >
                    {option.label}
                  </button>
                )
              })}
            </div>
          )}
        </div>

        <div
          aria-busy={searchBusy || patients.loading || undefined}
          className={cn(
            'transition-opacity duration-150',
            (searchBusy || patients.loading) && patients.data && 'opacity-60',
          )}
        >
        {patients.error ? (
          <div className="p-5">
            <ErrorNote message={patients.error} />
          </div>
        ) : patients.showSkeleton && !patients.data ? (
          <Table>
            <SkeletonRows rows={6} columns={6} />
          </Table>
        ) : !patients.data ? (
          <div className="min-h-72" />
        ) : filteredPatients.length > 0 ? (
          <>
            <div className="hidden md:block">
              <Table>
                <THead>
                  <tr>
                    <TH>Patient</TH>
                    <TH className="w-32">CP Number</TH>
                    <TH className="w-44">Contact</TH>
                    <TH className="w-36">Last Visit</TH>
                    <TH className="w-40">Next follow-up</TH>
                    <TH className="w-32 text-right">Balance</TH>
                    <TH className="w-28 text-right">Action</TH>
                  </tr>
                </THead>
                <TBody>
                  {pageRows.map((patient, idx) => (
                    <TR
                      key={patient.id}
                      onClick={() => setSelectedId(patient.id)}
                      className={`cursor-pointer ${idx % 2 === 0 ? 'bg-surface' : 'bg-ivory/40'}`}
                    >
                      <TD>
                        <div className="flex items-center gap-3">
                          <Avatar name={patient.full_name} />
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-espresso">
                              {patient.full_name}
                            </p>
                          </div>
                        </div>
                      </TD>
                      <TD>
                        <span className="tabular rounded-md bg-ivory px-2 py-0.5 text-[12px] font-medium text-warmgray ring-1 ring-champagne/70 ring-inset">
                          {patient.cp_label}
                        </span>
                      </TD>
                      <TD className="tabular text-[13px] text-warmgray">
                        {patient.cp_number ?? '—'}
                      </TD>
                      <TD>
                        {patient.last_visit ? (
                          <span className="inline-flex items-center gap-1.5 text-[13px] text-warmgray">
                            <Calendar className="size-3.5 text-gold" strokeWidth={1.8} />
                            {formatDateShort(patient.last_visit.visit_date)}
                          </span>
                        ) : (
                          <span className="text-[13px] text-warmgray/50">—</span>
                        )}
                      </TD>
                      <TD>
                        {patient.next_follow_up ? (
                          <div className="space-y-1">
                            <span className="inline-flex items-center gap-1.5 rounded-md bg-gold-light px-2 py-0.5 text-[11px] font-semibold text-gold-dark">
                              <Calendar className="size-3 text-gold-dark" strokeWidth={1.8} />
                              {formatDateShort(patient.next_follow_up.appointment_date)}
                            </span>
                            <p className="text-[11px] text-warmgray">
                              {formatTime(
                                new Date(
                                  `${patient.next_follow_up.appointment_date}T${patient.next_follow_up.appointment_time}`,
                                ),
                              )}{' '}
                              • {patient.next_follow_up.status}
                            </p>
                          </div>
                        ) : (
                          <span className="text-[13px] text-warmgray/50">No follow-up</span>
                        )}
                      </TD>
                      <TD className="text-right">
                        {patient.balance > 0 ? (
                          <Badge variant="error" className="tabular font-semibold">
                            {formatPeso(patient.balance)}
                          </Badge>
                        ) : (
                          <span className="tabular text-[13px] text-success font-medium">
                            {formatPeso(patient.balance)}
                          </span>
                        )}
                      </TD>
                      <TD className="text-right">
                        <div className="flex justify-end gap-1.5">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setSelectedId(patient.id)}
                            aria-label={`View ${patient.full_name}`}
                            className="size-9 rounded-lg"
                          >
                            <Eye className="size-4" aria-hidden="true" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(event) => {
                              event.stopPropagation()
                              setEditingPatient(patient)
                            }}
                            aria-label={`Edit ${patient.full_name}`}
                            className="size-9 rounded-lg"
                          >
                            <Pencil className="size-4" aria-hidden="true" />
                          </Button>
                        </div>
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </div>

            <div className="grid gap-3 p-4 md:hidden">
              {pageRows.map((patient) => (
                <div
                  key={patient.id}
                  className="rounded-card border border-champagne bg-surface p-4 shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:border-gold/60 hover:shadow-raised"
                >
                  <div className="flex items-start justify-between gap-3">
                    <button type="button" onClick={() => setSelectedId(patient.id)} className="min-w-0 text-left">
                      <div className="flex items-center gap-3">
                        <Avatar name={patient.full_name} />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-espresso">{patient.full_name}</p>
                          <span className="mt-1 inline-flex rounded-md bg-ivory px-2 py-0.5 text-[11px] font-medium text-warmgray ring-1 ring-champagne/70 ring-inset">
                            {patient.cp_label}
                          </span>
                        </div>
                      </div>
                    </button>

                    <div className="flex shrink-0 gap-2 text-right">
                      <Button variant="ghost" size="icon" onClick={() => setSelectedId(patient.id)} aria-label={`View ${patient.full_name}`} className="size-8 rounded-lg">
                        <Eye className="size-4" aria-hidden="true" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => setEditingPatient(patient)} aria-label={`Edit ${patient.full_name}`} className="size-8 rounded-lg">
                        <Pencil className="size-4" aria-hidden="true" />
                      </Button>
                    </div>
                  </div>

                  <div className="mt-3 grid gap-2 text-[12px] text-warmgray">
                    <div className="flex items-center justify-between gap-3">
                      <span>Contact</span>
                      <span className="tabular text-espresso">{patient.cp_number ?? '—'}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span>Last visit</span>
                      <span className="text-espresso">
                        {patient.last_visit ? formatDateShort(patient.last_visit.visit_date) : '—'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span>Next follow-up</span>
                      <span className="text-espresso">
                        {patient.next_follow_up ? formatDateShort(patient.next_follow_up.appointment_date) : '—'}
                      </span>
                    </div>
                  </div>

                  <div className="mt-3 flex items-center justify-between gap-2 pt-3 border-t border-champagne/60">
                    <span className="text-[11px] font-medium uppercase tracking-wide text-warmgray">Balance</span>
                    {patient.balance > 0 ? (
                      <Badge variant="error" className="tabular font-semibold">
                        {formatPeso(patient.balance)}
                      </Badge>
                    ) : (
                      <span className="tabular text-[13px] font-medium text-success">
                        {formatPeso(patient.balance)}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <Pagination
              page={currentPage}
              pageCount={pageCount}
              total={filteredTotal}
              pageSize={TABLE_PAGE_SIZE}
              itemLabel="patient"
              ariaLabel="patients pagination"
              onPageChange={setPage}
            />
          </>
        ) : (
          <EmptyState
            icon={deferredSearch ? UserSearch : Users}
            title={
              deferredSearch || activeFilter !== 'all'
                ? `No ${getFilterLabel(activeFilter).toLowerCase()} patients`
                : 'No patients yet'
            }
            description={
              deferredSearch || activeFilter !== 'all'
                ? 'Try a different name, CP number, or switch back to all patients.'
                : 'Patients appear here after their first visit is recorded.'
            }
            action={
              deferredSearch || activeFilter !== 'all' ? (
                <Button variant="outline" size="sm" onClick={() => { clearSearch(); setActiveFilter('all') }}>
                  Clear search
                </Button>
              ) : (
                <Button asChild variant="outline" size="sm">
                  <Link to="/new-visit">
                    <Plus className="size-4" aria-hidden="true" />
                    Record first visit
                  </Link>
                </Button>
              )
            }
          />
        )}
        </div>
      </Card>
      </div>

      <PatientDrawer
        patientId={selectedId}
        cpLabel={selected?.cp_label}
        onClose={() => setSelectedId(null)}
      />

      <PatientFormDialog
        key={editingPatient?.id ?? 'new-patient'}
        open={Boolean(editingPatient)}
        patient={editingPatient}
        onClose={() => setEditingPatient(null)}
        onSaved={() => {
          invalidateClinicQueries(userId, 'loadPatients', 'dashboard-summary')
          patients.reload()
        }}
      />
    </>
  )
}
