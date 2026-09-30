import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  Eye,
  Loader2,
  Pencil,
  Plus,
  Search,
  UserSearch,
  Users,
  UserCheck,
  AlertCircle,
  Calendar,
  X,
} from 'lucide-react'
import { PageHeader, Avatar } from '@/components/layout/page-header'
import { Card, Table, TBody, TD, TH, THead, TR } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Pagination } from '@/components/ui/pagination'
import { EmptyState, ErrorNote, SkeletonRows } from '@/components/ui/feedback'
import { useAsync } from '@/hooks/use-async'
import { listPatients } from '@/services/patients.service'
import { PatientDrawer } from '@/components/patients/patient-drawer'
import { PatientFormDialog } from '@/components/patients/patient-form-dialog'
import { TABLE_PAGE_SIZE } from '@/lib/constants'
import { formatDateShort, formatPeso } from '@/utils/format'

const SEARCH_DEBOUNCE_MS = 300

/* ── Mini stat card for the top banner ─────────────────────────── */

function MiniStat({ icon: Icon, label, value, tone = 'neutral' }) {
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
    <div className="flex items-center gap-3 rounded-xl bg-surface border border-champagne/60 px-4 py-3 shadow-card transition-all duration-200 hover:shadow-raised">
      <span className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${s.iconBg} ${s.iconColor}`}>
        <Icon className="size-5" strokeWidth={1.7} />
      </span>
      <div>
        <p className={`tabular font-display text-xl font-bold ${s.valueColor}`}>{value}</p>
        <p className="text-[11px] text-warmgray">{label}</p>
      </div>
    </div>
  )
}

export default function PatientsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const initialSearch = searchParams.get('search') ?? ''

  const [search, setSearch] = useState(initialSearch)
  const [deferredSearch, setDeferredSearch] = useState(initialSearch)
  const [selectedId, setSelectedId] = useState(null)
  const [editingPatient, setEditingPatient] = useState(null)
  const [page, setPage] = useState(1)

  const patients = useAsync(
    () => listPatients(deferredSearch),
    [deferredSearch],
    'loadPatients',
  )

  const selected = useMemo(
    () => patients.data?.find((row) => row.id === selectedId) ?? null,
    [patients.data, selectedId],
  )

  const total = patients.data?.length ?? 0
  const pageCount = Math.max(Math.ceil(total / TABLE_PAGE_SIZE), 1)
  const currentPage = Math.min(page, pageCount)
  const pageRows = patients.data?.slice(
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

  const searchPending = search.trim() !== deferredSearch.trim()
  const searchBusy =
    searchPending || (patients.loading && Boolean(deferredSearch.trim()))

  useEffect(() => {
    const id = window.setTimeout(() => {
      setDeferredSearch(search)
    }, SEARCH_DEBOUNCE_MS)
    return () => window.clearTimeout(id)
  }, [search])

  useEffect(() => {
    setPage(1)
  }, [deferredSearch])

  useEffect(() => {
    const trimmed = deferredSearch.trim()
    const inUrl = (searchParams.get('search') ?? '').trim()
    if (trimmed === inUrl) return
    const next = new URLSearchParams(searchParams)
    if (trimmed) next.set('search', trimmed)
    else next.delete('search')
    setSearchParams(next, { replace: true })
  }, [deferredSearch, searchParams, setSearchParams])

  const clearSearch = () => {
    setSearch('')
    setDeferredSearch('')
  }

  const applySearchNow = () => {
    setDeferredSearch(search)
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
      {!patients.loading && !patients.error && (
        <div className="grid gap-3 today-animate sm:grid-cols-3" style={{ animationDelay: '0ms' }}>
          <MiniStat
            icon={Users}
            label="Total patients"
            value={total}
            tone="neutral"
          />
          <MiniStat
            icon={AlertCircle}
            label="With balance"
            value={withBalance}
            tone={withBalance > 0 ? 'error' : 'success'}
          />
          <MiniStat
            icon={Calendar}
            label="Visited this week"
            value={recentVisits}
            tone="success"
          />
        </div>
      )}

      <Card className="overflow-hidden today-animate" style={{ animationDelay: '60ms' }}>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-champagne px-5 py-3.5">
          <div className="relative w-full sm:max-w-sm">
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
                  applySearchNow()
                }
                if (event.key === 'Escape') {
                  event.preventDefault()
                  clearSearch()
                }
              }}
              placeholder="Search by name or CP number"
              aria-label="Search by name or CP number"
              aria-busy={searchBusy}
              className="h-11 w-full rounded-[var(--radius-control)] border border-champagne bg-ivory/50 pr-10 pl-10 text-sm text-espresso transition-all duration-200 placeholder:text-warmgray/55 focus:border-gold focus:bg-white focus:ring-2 focus:ring-gold/20 focus:outline-none"
            />
            {search.length > 0 && (
              <button
                type="button"
                onClick={clearSearch}
                className="absolute top-1/2 right-2.5 flex size-7 -translate-y-1/2 items-center justify-center rounded-md text-warmgray transition-colors hover:bg-champagne/60 hover:text-espresso focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/30"
                aria-label="Clear search"
              >
                <X className="size-4" aria-hidden="true" />
              </button>
            )}
          </div>

          {!patients.loading && !patients.error && (
            <span className="inline-flex items-center gap-1.5 rounded-md bg-gold-light/70 px-2.5 py-1 text-[12px] font-semibold text-gold-dark">
              <UserCheck className="size-3.5" strokeWidth={2} />
              {total} {total === 1 ? 'patient' : 'patients'}
              {deferredSearch ? ' matching' : ''}
            </span>
          )}
        </div>

        {patients.error ? (
          <div className="p-5">
            <ErrorNote message={patients.error} />
          </div>
        ) : patients.loading ? (
          <Table>
            <SkeletonRows rows={6} columns={6} />
          </Table>
        ) : patients.data && patients.data.length > 0 ? (
          <>
            <Table>
            <THead>
              <tr>
                <TH>Patient</TH>
                <TH className="w-32">CP Number</TH>
                <TH className="w-44">Contact</TH>
                <TH className="w-36">Last Visit</TH>
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

            <Pagination
              page={currentPage}
              pageCount={pageCount}
              total={total}
              pageSize={TABLE_PAGE_SIZE}
              itemLabel="patient"
              ariaLabel="patients pagination"
              onPageChange={setPage}
            />
          </>
        ) : (
          <EmptyState
            icon={deferredSearch ? UserSearch : Users}
            title={deferredSearch ? 'No matching patients' : 'No patients yet'}
            description={
              deferredSearch
                ? 'Try a different name or CP number.'
                : 'Patients appear here after their first visit is recorded.'
            }
            action={
              deferredSearch ? (
                <Button variant="outline" size="sm" onClick={clearSearch}>
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
      </Card>
      </div>

      <PatientDrawer
        patientId={selected?.id ?? null}
        cpLabel={selected?.cp_label}
        onClose={() => setSelectedId(null)}
      />

      <PatientFormDialog
        key={editingPatient?.id ?? 'new-patient'}
        open={Boolean(editingPatient)}
        patient={editingPatient}
        onClose={() => setEditingPatient(null)}
        onSaved={patients.reload}
      />
    </>
  )
}
