import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react'
import { addDays, toDateKey } from '@/utils/dates'
import { formatDate } from '@/utils/format'
import { cn } from '@/lib/utils'

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']

function atNoon(dateKey) {
  const [year, month, day] = dateKey.split('-').map(Number)
  return new Date(year, month - 1, day, 12)
}

function monthDays(month) {
  const first = new Date(month.getFullYear(), month.getMonth(), 1)
  const start = new Date(first)
  start.setDate(first.getDate() - first.getDay())
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start)
    date.setDate(start.getDate() + index)
    return date
  })
}

function normalizeDateKey(value) {
  if (!value) return null
  return value instanceof Date ? toDateKey(value) : String(value).slice(0, 10)
}

export function DatePicker({
  value,
  onChange,
  minDate,
  maxDate,
  disabled = false,
  id = 'date-picker',
  'aria-describedby': externalDescribedBy,
  error,
  label = 'Date',
  required = true,
}) {
  const todayKey = toDateKey()
  const minDateKey = normalizeDateKey(minDate)
  const maxDateKey = normalizeDateKey(maxDate)
  const describedBy = [externalDescribedBy, error ? `${id}-error` : null].filter(Boolean).join(' ') || undefined
  const [open, setOpen] = useState(false)
  const [selectingYear, setSelectingYear] = useState(false)
  const [visibleMonth, setVisibleMonth] = useState(() => atNoon(value || todayKey))
  const [focusedDate, setFocusedDate] = useState(value || todayKey)
  const [desktopPosition, setDesktopPosition] = useState(null)
  const rootRef = useRef(null)
  const panelRef = useRef(null)
  const triggerRef = useRef(null)
  const dayRefs = useRef(new Map())
  const yearRefs = useRef(new Map())
  const wasOpen = useRef(false)
  const days = useMemo(() => monthDays(visibleMonth), [visibleMonth])

  useEffect(() => {
    if (!open) return undefined
    const handlePointerDown = (event) => {
      if (!rootRef.current?.contains(event.target) && !panelRef.current?.contains(event.target)) setOpen(false)
    }
    const handleScroll = () => setOpen(false)
    document.addEventListener('pointerdown', handlePointerDown)
    window.addEventListener('scroll', handleScroll, true)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      window.removeEventListener('scroll', handleScroll, true)
    }
  }, [open])

  useEffect(() => {
    if (open) {
      wasOpen.current = true
      if (selectingYear) yearRefs.current.get(visibleMonth.getFullYear())?.focus()
      else dayRefs.current.get(focusedDate)?.focus()
    } else if (wasOpen.current) {
      wasOpen.current = false
      triggerRef.current?.focus()
    }
  }, [focusedDate, open, selectingYear, visibleMonth])

  const close = () => setOpen(false)
  const isAllowed = (dateKey) =>
    (!minDateKey || dateKey >= minDateKey) && (!maxDateKey || dateKey <= maxDateKey)
  const selectDate = (date) => {
    const key = toDateKey(date)
    if (!isAllowed(key)) return
    onChange(key)
    setFocusedDate(key)
    setSelectingYear(false)
    close()
  }
  const shiftMonth = (amount) => {
    setVisibleMonth((month) => new Date(month.getFullYear(), month.getMonth() + amount, 1, 12))
  }
  const moveFocus = (date, amount) => {
    let next = addDays(date, amount)
    while (!isAllowed(toDateKey(next))) {
      const nextKey = toDateKey(next)
      if (minDateKey && nextKey < minDateKey) next = atNoon(minDateKey)
      else if (maxDateKey && nextKey > maxDateKey) next = atNoon(maxDateKey)
      else break
    }
    setFocusedDate(toDateKey(next))
    setVisibleMonth(new Date(next.getFullYear(), next.getMonth(), 1, 12))
  }
  const yearWindowStart = Math.floor((visibleMonth.getFullYear() - 1) / 12) * 12 + 1
  const years = Array.from({ length: 12 }, (_, index) => yearWindowStart + index)
  const minYear = minDateKey ? Number(minDateKey.slice(0, 4)) : 1
  const maxYear = maxDateKey ? Number(maxDateKey.slice(0, 4)) : 9999
  const shiftYearWindow = (amount) => {
    const year = Math.max(minYear, Math.min(maxYear, yearWindowStart + amount * 12))
    setVisibleMonth(new Date(year, visibleMonth.getMonth(), 1, 12))
  }
  const selectYear = (year) => {
    let month = new Date(year, visibleMonth.getMonth(), 1, 12)
    const firstDay = toDateKey(month)
    const lastDay = toDateKey(new Date(year, month.getMonth() + 1, 0, 12))
    if (minDateKey && lastDay < minDateKey) month = atNoon(minDateKey)
    else if (maxDateKey && firstDay > maxDateKey) month = atNoon(maxDateKey)

    const monthKey = toDateKey(month)
    setVisibleMonth(new Date(month.getFullYear(), month.getMonth(), 1, 12))
    setFocusedDate(minDateKey && monthKey < minDateKey ? minDateKey : monthKey)
    setSelectingYear(false)
  }
  const openPicker = () => {
    setSelectingYear(false)
    if (value) {
      setVisibleMonth(atNoon(value))
      setFocusedDate(value)
    }
    const rect = triggerRef.current?.getBoundingClientRect()
    if (rect && window.matchMedia('(min-width: 640px)').matches) {
      const width = Math.min(300, window.innerWidth - 16)
      const height = 360
      const spaceBelow = window.innerHeight - rect.bottom
      const spaceAbove = rect.top
      const flip = spaceBelow < height && spaceAbove > spaceBelow
      const top = flip
        ? Math.max(8, rect.top - height - 8)
        : Math.max(8, Math.min(rect.bottom + 8, window.innerHeight - height - 8))
      setDesktopPosition({
        left: Math.max(8, Math.min(rect.left, window.innerWidth - width - 8)),
        top,
      })
    } else {
      setDesktopPosition(null)
    }
    setOpen((current) => !current)
  }

  const previousMonthEnd = toDateKey(new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), 0, 12))
  const nextMonthStart = toDateKey(new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 1, 12))
  const canGoPrevious = !minDateKey || previousMonthEnd >= minDateKey
  const canGoNext = !maxDateKey || nextMonthStart <= maxDateKey

  return (
    <div ref={rootRef} className="relative">
      <span className="mb-1.5 block text-[13px] font-medium text-espresso">
        {label} {required && <span className="text-error" aria-hidden="true">*</span>}
      </span>
      <button
        ref={triggerRef}
        id={id}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`${label}: ${value ? formatDate(atNoon(value)) : 'Choose a date'}`}
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={describedBy}
        disabled={disabled}
        onClick={openPicker}
        className={cn(
          'flex h-11 w-full items-center gap-2 rounded-control border bg-surface px-3 text-left text-[13px] text-espresso transition-colors hover:border-gold/60 focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/20 disabled:cursor-not-allowed disabled:opacity-60 motion-reduce:transition-none',
          error ? 'border-error' : 'border-champagne',
        )}
      >
        <CalendarDays className="size-4 shrink-0 text-gold-dark" aria-hidden="true" />
        <span className={value ? '' : 'text-warmgray'}>{value ? formatDate(atNoon(value)) : 'Choose a date'}</span>
      </button>
      {error && <p id={`${id}-error`} className="mt-1.5 text-xs text-error" role="alert">{error}</p>}

      {open && (
        createPortal(<div
          className="fixed inset-0 z-120 flex items-end bg-espresso/35 p-0 sm:pointer-events-none sm:block sm:bg-transparent"
          onMouseDown={(event) => { if (event.target === event.currentTarget) close() }}
        >
          <div
            ref={panelRef}
            role="dialog"
            aria-label="Choose appointment date"
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                event.preventDefault()
                close()
              } else if (!selectingYear && event.key.startsWith('Arrow')) {
                event.preventDefault()
                const step = event.key === 'ArrowLeft' ? -1 : event.key === 'ArrowRight' ? 1 : event.key === 'ArrowUp' ? -7 : 7
                moveFocus(atNoon(focusedDate), step)
              }
            }}
            style={desktopPosition ? { position: 'fixed', left: desktopPosition.left, top: desktopPosition.top } : undefined}
            className="pointer-events-auto max-h-[90dvh] w-full overflow-y-auto rounded-t-card border border-champagne bg-surface p-3 shadow-pop sm:w-75 sm:max-w-[calc(100vw-16px)] sm:rounded-card motion-reduce:animate-none"
          >
            <div className="mb-2 flex items-center justify-between">
              <button
                type="button"
                aria-label={selectingYear ? 'Previous years' : 'Previous month'}
                disabled={selectingYear ? yearWindowStart <= minYear : !canGoPrevious}
                onClick={() => selectingYear ? shiftYearWindow(-1) : shiftMonth(-1)}
                className="flex size-10 items-center justify-center rounded-control text-espresso hover:bg-gold-light/60 focus-visible:outline-gold disabled:opacity-35"
              >
                <ChevronLeft className="size-4" aria-hidden="true" />
              </button>
              <button
                type="button"
                aria-label={selectingYear ? 'Return to calendar' : 'Choose year'}
                aria-expanded={selectingYear}
                onClick={() => setSelectingYear((current) => !current)}
                className="rounded-control px-2 py-1 text-sm font-semibold text-espresso hover:bg-gold-light/60 focus-visible:outline-2 focus-visible:outline-gold"
              >
                {selectingYear
                  ? `${years[0]}–${years[years.length - 1]}`
                  : new Intl.DateTimeFormat('en-PH', { month: 'long', year: 'numeric' }).format(visibleMonth)}
              </button>
              <button
                type="button"
                aria-label={selectingYear ? 'Next years' : 'Next month'}
                disabled={selectingYear ? yearWindowStart + 11 >= maxYear : !canGoNext}
                onClick={() => selectingYear ? shiftYearWindow(1) : shiftMonth(1)}
                className="flex size-10 items-center justify-center rounded-control text-espresso hover:bg-gold-light/60 focus-visible:outline-gold disabled:opacity-35"
              >
                <ChevronRight className="size-4" aria-hidden="true" />
              </button>
            </div>
            {selectingYear ? (
              <div className="grid grid-cols-3 gap-1" role="grid" aria-label="Choose year">
                {years.map((year) => (
                  <button
                    key={year}
                    ref={(element) => {
                      if (element) yearRefs.current.set(year, element)
                      else yearRefs.current.delete(year)
                    }}
                    type="button"
                    role="gridcell"
                    aria-selected={year === visibleMonth.getFullYear()}
                    tabIndex={year === visibleMonth.getFullYear() ? 0 : -1}
                    disabled={year < minYear || year > maxYear}
                    onClick={() => selectYear(year)}
                    className={cn(
                      'h-10 rounded-control text-sm focus-visible:outline-2 focus-visible:outline-gold disabled:cursor-not-allowed disabled:opacity-30',
                      year === visibleMonth.getFullYear()
                        ? 'bg-gold text-espresso'
                        : 'text-espresso hover:bg-gold-light',
                    )}
                  >
                    {year}
                  </button>
                ))}
              </div>
            ) : (
              <>
                <div className="grid grid-cols-7 text-center text-[12px] font-medium text-warmgray" aria-hidden="true">
                  {WEEKDAYS.map((day) => <span key={day} className="py-1.5">{day}</span>)}
                </div>
                <div className="grid grid-cols-7 gap-y-1" role="grid" aria-label="Calendar">
                  {days.map((date) => {
                    const dateKey = toDateKey(date)
                    const isSelected = dateKey === value
                    const isToday = dateKey === todayKey
                    const isAllowedDate = isAllowed(dateKey)
                    const sameMonth = date.getMonth() === visibleMonth.getMonth()
                    return (
                      <button
                        key={dateKey}
                        ref={(element) => {
                          if (element) dayRefs.current.set(dateKey, element)
                          else dayRefs.current.delete(dateKey)
                        }}
                        type="button"
                        role="gridcell"
                        aria-label={new Intl.DateTimeFormat('en-PH', { dateStyle: 'full' }).format(date)}
                        aria-selected={isSelected}
                        tabIndex={dateKey === focusedDate ? 0 : -1}
                        disabled={!isAllowedDate}
                        onFocus={() => setFocusedDate(dateKey)}
                        onClick={() => selectDate(date)}
                        className="flex h-10 w-full items-center justify-center focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-gold disabled:cursor-not-allowed disabled:opacity-30"
                      >
                        <span className={cn(
                          'flex size-9 items-center justify-center rounded-full text-sm motion-reduce:transition-none',
                          isSelected ? 'bg-gold text-espresso' : 'text-espresso hover:bg-gold-light',
                          isToday && !isSelected && 'ring-1 ring-inset ring-gold',
                          !sameMonth && 'text-warmgray/35',
                        )}>{date.getDate()}</span>
                      </button>
                    )
                  })}
                </div>
              </>
            )}
            <div className="mt-2 flex justify-between border-t border-champagne pt-2">
              <button type="button" disabled={!isAllowed(todayKey)} className="min-h-10 px-3 text-sm font-medium text-gold-dark hover:bg-gold-light/60 disabled:opacity-40" onClick={() => selectDate(atNoon(todayKey))}>Today</button>
              <button type="button" className="min-h-10 px-3 text-sm font-medium text-warmgray hover:bg-gold-light/60" onClick={() => { onChange(''); close() }}>Clear</button>
            </div>
          </div>
        </div>, document.body)
      )}
    </div>
  )
}