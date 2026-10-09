import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Clock3, RefreshCw, X } from 'lucide-react'
import { Select } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { ErrorNote, Skeleton } from '@/components/ui/feedback'
import { listAppointments } from '@/lib/appointments'
import { APPOINTMENT_STATUS, normalizeAppointmentStatus } from '@/lib/appointment-status'
import { toDateKey } from '@/utils/dates'
import { formatTime } from '@/utils/format'
import { cn } from '@/lib/utils'

export const OPEN = '09:00'
export const CLOSE = '18:00'
export const STEP = 30

function minutesOf(time) {
  const [hours, minutes] = time.split(':').map(Number)
  return hours * 60 + minutes
}

function timeFromMinutes(minutes) {
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`
}

function localDateTime(dateKey, time) {
  const [year, month, day] = dateKey.split('-').map(Number)
  const [hours, minutes] = time.split(':').map(Number)
  return new Date(year, month - 1, day, hours, minutes)
}

function fromClockParts(hour, minute, period) {
  let hour24 = Number(hour) % 12
  if (period === 'PM') hour24 += 12
  return `${String(hour24).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
}

export function TimeSlotPicker({ date, value, duration, onChange, error, disabled = false, excludeAppointmentId, refreshKey = 0 }) {
  const [appointments, setAppointments] = useState([])
  const [loading, setLoading] = useState(Boolean(date))
  const [loadError, setLoadError] = useState('')
  const [customOpen, setCustomOpen] = useState(false)
  const [slotsOpen, setSlotsOpen] = useState(false)
  const [customHour, setCustomHour] = useState('9')
  const [customMinute, setCustomMinute] = useState('00')
  const [customPeriod, setCustomPeriod] = useState('AM')
  const [focusIndex, setFocusIndex] = useState(0)
  const [now, setNow] = useState(() => new Date())
  const [reloadToken, setReloadToken] = useState(0)
  const [loadedKey, setLoadedKey] = useState('')
  const [popoverPosition, setPopoverPosition] = useState(null)
  const [isMobile, setIsMobile] = useState(false)
  const slotRefs = useRef([])
  const rootRef = useRef(null)
  const triggerRef = useRef(null)
  const popoverRef = useRef(null)
  const wasOpenRef = useRef(false)
  const numericDuration = Number(duration)
  const availabilityKey = `${date}:${excludeAppointmentId ?? ''}:${reloadToken}:${refreshKey}`

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 640)
    checkMobile()
    window.addEventListener('resize', checkMobile, { passive: true })
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  useEffect(() => {
    let active = true
    const load = async () => {
      if (!date) {
        setAppointments([])
        setLoadError('')
        setLoading(false)
        return
      }
      setLoading(true)
      setLoadError('')
      try {
        const nextDate = new Date(`${date}T12:00:00`)
        nextDate.setDate(nextDate.getDate() + 1)
        const rows = await listAppointments({
          from: localDateTime(date, '00:00').toISOString(),
          to: localDateTime(toDateKey(nextDate), '00:00').toISOString(),
        })
        if (active) {
          setAppointments(rows.filter((item) => item.id !== excludeAppointmentId && normalizeAppointmentStatus(item.status) !== APPOINTMENT_STATUS.CANCELLED))
          setLoadedKey(availabilityKey)
        }
      } catch (caught) {
        if (active) setLoadError(caught?.message ?? 'Unable to load appointments right now.')
      } finally {
        if (active) setLoading(false)
      }
    }
    void load()
    return () => { active = false }
  }, [availabilityKey, date, excludeAppointmentId, reloadToken])

  useEffect(() => {
    const intervalId = window.setInterval(() => setNow(new Date()), 60_000)
    return () => window.clearInterval(intervalId)
  }, [])

  useEffect(() => {
    const closeOutside = (event) => {
      if (!rootRef.current?.contains(event.target) && !popoverRef.current?.contains(event.target)) {
        setSlotsOpen(false)
        setCustomOpen(false)
      }
    }
    document.addEventListener('pointerdown', closeOutside)
    return () => document.removeEventListener('pointerdown', closeOutside)
  }, [])

  useEffect(() => {
    if (slotsOpen) {
      wasOpenRef.current = true
    } else if (wasOpenRef.current) {
      wasOpenRef.current = false
      triggerRef.current?.focus()
    }
  }, [slotsOpen])

  const slots = useMemo(() => {
    if (!date || !Number.isFinite(numericDuration)) return []
    const openMinutes = minutesOf(OPEN)
    const closeMinutes = minutesOf(CLOSE)
    const items = []
    for (let startMinutes = openMinutes; startMinutes < closeMinutes; startMinutes += STEP) {
      if (startMinutes + numericDuration > closeMinutes) continue
      const start = localDateTime(date, timeFromMinutes(startMinutes))
      const end = new Date(start.getTime() + numericDuration * 60_000)
      const booked = appointments.some((appointment) => {
        const bookedStart = new Date(appointment.start_at)
        const bookedEnd = new Date(bookedStart.getTime() + Number(appointment.duration_minutes) * 60_000)
        return start < bookedEnd && end > bookedStart
      })
      const past = toDateKey(start) === toDateKey(now) && start <= now
      items.push({ time: timeFromMinutes(startMinutes), booked, past, date: start })
    }
    return items
  }, [appointments, date, now, numericDuration])

  useEffect(() => {
    if (!loading && !loadError && loadedKey === availabilityKey && value && slots.length && !slots.some((slot) => slot.time === value && !slot.booked && !slot.past)) {
      const customStart = /^\d{2}:\d{2}$/.test(value) ? localDateTime(date, value) : null
      const customEnd = customStart && new Date(customStart.getTime() + numericDuration * 60_000)
      const opening = localDateTime(date, OPEN)
      const closing = localDateTime(date, CLOSE)
      const customUnavailable = !customStart ||
        customStart < opening ||
        !customEnd ||
        customEnd > closing ||
        (toDateKey(customStart) === toDateKey(now) && customStart <= now) ||
        appointments.some((appointment) => {
          const bookedStart = new Date(appointment.start_at)
          const bookedEnd = new Date(bookedStart.getTime() + Number(appointment.duration_minutes) * 60_000)
          return customStart < bookedEnd && customEnd > bookedStart
        })
      if (customUnavailable) onChange('')
    }
  }, [appointments, availabilityKey, date, loadError, loadedKey, loading, now, numericDuration, onChange, slots, value])

  const availableCount = slots.filter((slot) => !slot.booked && !slot.past).length
  const firstAvailableIndex = slots.findIndex((slot) => !slot.booked && !slot.past)
  const focusedSlotIndex = slots[focusIndex] && !slots[focusIndex].booked && !slots[focusIndex].past
    ? focusIndex
    : firstAvailableIndex

  useEffect(() => {
    if (!slotsOpen || loading || loadError || loadedKey !== availabilityKey) return
    if (customOpen) {
      popoverRef.current?.querySelector('select')?.focus()
      return
    }
    if (focusedSlotIndex >= 0) slotRefs.current[focusedSlotIndex]?.focus()
  }, [availabilityKey, customOpen, focusedSlotIndex, loadError, loadedKey, loading, slotsOpen])

  const changeCustomTime = () => {
    if (!date) return
    onChange(fromClockParts(customHour, customMinute, customPeriod))
    setCustomOpen(false)
    setSlotsOpen(false)
  }

  const openSlots = () => {
    const rect = triggerRef.current?.getBoundingClientRect()
    if (rect) {
      const width = Math.min(320, window.innerWidth - 16)
      const left = Math.max(8, Math.min(rect.left, window.innerWidth - width - 8))
      const estimatedHeight = 280
      const top = rect.bottom + estimatedHeight + 6 <= window.innerHeight
        ? rect.bottom + 6
        : Math.max(8, rect.top - estimatedHeight - 6)
      setPopoverPosition({ left, top, width })
    }
    setCustomOpen(false)
    setSlotsOpen(true)
  }

  const closeSlots = () => {
    setSlotsOpen(false)
    setCustomOpen(false)
  }

  return (
    <div ref={rootRef} className="relative min-w-0 w-full">
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-[13px] font-medium text-espresso">Time <span className="text-error" aria-hidden="true">*</span></span>
      </div>
      <button
          ref={triggerRef}
          type="button"
          aria-haspopup="dialog"
          aria-expanded={slotsOpen}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={error ? 'appointment-time-error' : undefined}
          disabled={!date || disabled}
          onClick={() => slotsOpen ? closeSlots() : openSlots()}
          className={cn(
            'flex h-11 w-full items-center justify-between gap-2 rounded-control border bg-surface px-3 text-left text-[13px] text-espresso focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/20 disabled:cursor-not-allowed disabled:opacity-60 motion-reduce:transition-none',
            error ? 'border-error' : 'border-champagne hover:border-gold/60',
          )}
        >
          <span className={value && date ? 'whitespace-nowrap' : 'text-warmgray'}>
            {value && date ? formatTime(localDateTime(date, value)) : 'Select time'}
          </span>
          <Clock3 className="size-4 shrink-0 text-gold-dark" aria-hidden="true" />
        </button>

      {slotsOpen && date && createPortal(
        <div className="pointer-events-none fixed inset-0 z-120">
          {isMobile ? (
            /* Mobile Bottom Sheet */
            <div className="flex flex-col justify-end">
              <div
                className="fixed inset-0 bg-espresso/40 backdrop-blur-xs transition-opacity duration-200"
                onClick={closeSlots}
                aria-hidden="true"
              />
              <div
                ref={popoverRef}
                role="dialog"
                aria-label="Choose appointment time"
                className="relative z-160 w-full rounded-t-2xl border-t border-champagne bg-surface p-4 shadow-pop transition-transform duration-200 flex flex-col max-h-[75vh] motion-reduce:transition-none"
              >
                {/* Pull handle */}
                <div className="mx-auto mb-2 h-1.5 w-12 rounded-full bg-champagne" aria-hidden="true" />
                <div className="mb-3 flex items-center justify-between border-b border-champagne/60 pb-2">
                  <h3 className="text-sm font-semibold text-espresso">Choose appointment time</h3>
                  <button
                    type="button"
                    onClick={closeSlots}
                    className="flex size-8 items-center justify-center rounded-control text-warmgray hover:bg-ivory hover:text-espresso"
                    aria-label="Close"
                  >
                    <X className="size-4" aria-hidden="true" />
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto">
                  {customOpen ? (
                    <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto] items-end gap-1.5 pb-4">
                      <Select id="custom-time-hour" label="Hour" value={customHour} onChange={(event) => setCustomHour(event.target.value)} disabled={disabled} options={Array.from({ length: 12 }, (_, index) => String(index + 1))} className="min-w-0 bg-surface px-2 pr-7 text-[13px]" />
                      <Select id="custom-time-minute" label="Minute" value={customMinute} onChange={(event) => setCustomMinute(event.target.value)} disabled={disabled} options={['00', '05', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55']} className="min-w-0 bg-surface px-2 pr-7 text-[13px]" />
                      <Select id="custom-time-period" label="AM/PM" value={customPeriod} onChange={(event) => setCustomPeriod(event.target.value)} disabled={disabled} options={['AM', 'PM']} className="min-w-0 bg-surface px-2 pr-7 text-[13px]" />
                      <Button type="button" size="sm" disabled={!date || disabled} onClick={changeCustomTime} className="h-11 min-h-11 px-2.5">Use</Button>
                    </div>
                  ) : (
                    <div
                      role="group"
                      aria-label="Available appointment time slots"
                      aria-invalid={error ? 'true' : undefined}
                      aria-describedby={error ? 'appointment-time-error' : undefined}
                      aria-busy={loading || undefined}
                      onKeyDown={(event) => {
                        if (!['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp'].includes(event.key)) return
                        event.preventDefault()
                        const direction = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : -1
                        let next = focusedSlotIndex
                        for (let attempt = 0; attempt < slots.length; attempt += 1) {
                          next = (next + direction + slots.length) % slots.length
                          if (!slots[next].booked && !slots[next].past) break
                        }
                        setFocusIndex(next)
                        slotRefs.current[next]?.focus()
                      }}
                      className="max-h-[50vh] overflow-y-auto"
                    >
                      {loading ? (
                        <div className="grid grid-cols-[repeat(auto-fill,minmax(88px,1fr))] gap-1.5">
                          {Array.from({ length: 12 }, (_, index) => <Skeleton key={index} className="h-10 w-full motion-reduce:animate-none" />)}
                        </div>
                      ) : loadError ? (
                        <div className="space-y-2">
                          <ErrorNote message={loadError} />
                          <Button type="button" variant="outline" size="sm" onClick={() => setReloadToken((token) => token + 1)}><RefreshCw className="size-3.5" aria-hidden="true" /> Try again</Button>
                        </div>
                      ) : slots.length === 0 || availableCount === 0 ? (
                        <p className="py-2 text-sm text-warmgray">No slots available on this day. Try another date.</p>
                      ) : (
                        <div className="grid grid-cols-[repeat(auto-fill,minmax(88px,1fr))] gap-1.5">
                          {slots.map((slot, index) => {
                            const unavailable = slot.booked || slot.past
                            return (
                              <button
                                key={slot.time}
                                ref={(element) => { slotRefs.current[index] = element }}
                                type="button"
                                title={slot.booked ? 'Already booked' : slot.past ? 'This time has passed' : undefined}
                                aria-pressed={value === slot.time}
                                disabled={disabled || unavailable}
                                tabIndex={index === focusedSlotIndex ? 0 : -1}
                                onFocus={() => setFocusIndex(index)}
                                onClick={() => { onChange(slot.time); setSlotsOpen(false) }}
                                className={cn(
                                  'h-10 min-w-0 whitespace-nowrap rounded-control border px-2.5 text-[13px] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-gold disabled:cursor-not-allowed disabled:bg-ivory disabled:text-warmgray/55 motion-reduce:transition-none',
                                  value === slot.time ? 'border-gold bg-gold text-espresso' : 'border-champagne bg-surface text-espresso hover:border-gold/60 hover:bg-gold-light/50',
                                )}
                              >
                                {formatTime(slot.date)}
                              </button>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )}
                  <div className="mt-2 border-t border-champagne pt-1">
                    <button
                      type="button"
                      className="min-h-10 px-2 text-xs font-medium text-gold-dark hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold motion-reduce:transition-none"
                      onClick={() => setCustomOpen((current) => !current)}
                    >
                      {customOpen ? 'Back to available slots' : 'Custom time'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* Desktop Popover */
            <div
              ref={popoverRef}
              role="dialog"
              aria-label="Choose appointment time"
              style={popoverPosition ? { position: 'fixed', ...popoverPosition } : undefined}
              onKeyDown={(event) => {
                if (event.key === 'Escape') {
                  event.preventDefault()
                  closeSlots()
                }
              }}
              className="pointer-events-auto max-w-[calc(100vw-16px)] rounded-control border border-champagne bg-surface p-2 shadow-pop motion-reduce:animate-none"
            >
            {customOpen ? (
              <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto] items-end gap-1.5">
                <Select id="custom-time-hour" label="Hour" value={customHour} onChange={(event) => setCustomHour(event.target.value)} disabled={disabled} options={Array.from({ length: 12 }, (_, index) => String(index + 1))} className="min-w-0 bg-surface px-2 pr-7 text-[13px]" />
                <Select id="custom-time-minute" label="Minute" value={customMinute} onChange={(event) => setCustomMinute(event.target.value)} disabled={disabled} options={['00', '05', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55']} className="min-w-0 bg-surface px-2 pr-7 text-[13px]" />
                <Select id="custom-time-period" label="AM/PM" value={customPeriod} onChange={(event) => setCustomPeriod(event.target.value)} disabled={disabled} options={['AM', 'PM']} className="min-w-0 bg-surface px-2 pr-7 text-[13px]" />
                <Button type="button" size="sm" disabled={!date || disabled} onClick={changeCustomTime} className="h-11 min-h-11 px-2.5">Use</Button>
              </div>
            ) : (
            <div
              role="group"
              aria-label="Available appointment time slots"
              aria-invalid={error ? 'true' : undefined}
              aria-describedby={error ? 'appointment-time-error' : undefined}
              aria-busy={loading || undefined}
              onKeyDown={(event) => {
                if (!['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp'].includes(event.key)) return
                event.preventDefault()
                const direction = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : -1
                let next = focusedSlotIndex
                for (let attempt = 0; attempt < slots.length; attempt += 1) {
                  next = (next + direction + slots.length) % slots.length
                  if (!slots[next].booked && !slots[next].past) break
                }
                setFocusIndex(next)
                slotRefs.current[next]?.focus()
              }}
              className="max-h-40 overflow-y-auto"
            >
              {loading ? (
                <div className="grid grid-cols-[repeat(auto-fill,minmax(88px,1fr))] gap-1.5">
                  {Array.from({ length: 12 }, (_, index) => <Skeleton key={index} className="h-8.5 w-full motion-reduce:animate-none" />)}
                </div>
              ) : loadError ? (
                <div className="space-y-2">
                  <ErrorNote message={loadError} />
                  <Button type="button" variant="outline" size="sm" onClick={() => setReloadToken((token) => token + 1)}><RefreshCw className="size-3.5" aria-hidden="true" /> Try again</Button>
                </div>
              ) : slots.length === 0 || availableCount === 0 ? (
                <p className="py-2 text-sm text-warmgray">No slots available on this day. Try another date.</p>
              ) : (
                <div className="grid grid-cols-[repeat(auto-fill,minmax(88px,1fr))] gap-1.5">
                  {slots.map((slot, index) => {
                    const unavailable = slot.booked || slot.past
                    return (
                      <button
                        key={slot.time}
                        ref={(element) => { slotRefs.current[index] = element }}
                        type="button"
                        title={slot.booked ? 'Already booked' : slot.past ? 'This time has passed' : undefined}
                        aria-pressed={value === slot.time}
                        disabled={disabled || unavailable}
                        tabIndex={index === focusedSlotIndex ? 0 : -1}
                        onFocus={() => setFocusIndex(index)}
                        onClick={() => { onChange(slot.time); setSlotsOpen(false) }}
                        className={cn(
                          'h-8.5 min-w-0 whitespace-nowrap rounded-control border px-2.5 text-[13px] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-gold disabled:cursor-not-allowed disabled:bg-ivory disabled:text-warmgray/55 motion-reduce:transition-none',
                          value === slot.time ? 'border-gold bg-gold text-espresso' : 'border-champagne bg-surface text-espresso hover:border-gold/60 hover:bg-gold-light/50',
                        )}
                      >
                        {formatTime(slot.date)}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
            )}
            <div className="mt-2 border-t border-champagne pt-1">
              <button
                type="button"
                className="min-h-10 px-2 text-xs font-medium text-gold-dark hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold motion-reduce:transition-none"
                onClick={() => setCustomOpen((current) => !current)}
              >
                {customOpen ? 'Back to available slots' : 'Custom time'}
              </button>
            </div>
          </div>
        )}
      </div>,
      document.body,
      )}
      {error && <p id="appointment-time-error" className="mt-1.5 text-xs text-error" role="alert">{error}</p>}
    </div>
  )
}