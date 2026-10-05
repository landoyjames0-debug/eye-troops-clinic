import { useState } from 'react'
import { Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/input'
import { Select } from '@/components/Select'
import { DatePicker } from '@/components/DatePicker'
import {
  fromVisitDateTimeParts,
  parseInputDateTime,
  toInputDateTime,
} from '@/utils/dates'
import { formatTime } from '@/utils/format'

const HOURS_12 = Array.from({ length: 12 }, (_, index) => index + 1)
const MINUTES = Array.from({ length: 12 }, (_, index) => index * 5)

export function VisitDateTimeField({ id = 'visitDate', label, value, onChange, error, required, hint, maxDate }) {
  const parsedDate = value ? new Date(value) : null
  const localValue = value && /(?:Z|[+-]\d{2}:\d{2})$/.test(value) && !Number.isNaN(parsedDate?.getTime())
    ? toInputDateTime(parsedDate)
    : value
  const parts = parseInputDateTime(localValue)
  const dateValue = value ? parts.date : ''
  const today = maxDate ?? toInputDateTime().slice(0, 10)
  const errorId = `${id}-date-error`
  const hintId = `${id}-hint`
  const [nowNote, setNowNote] = useState('')

  const emit = (patch) => {
    const next = { ...parts, ...patch }
    onChange(next.date ? fromVisitDateTimeParts(next) : '')
    setNowNote('')
  }

  const setNow = () => {
    const now = new Date()
    const currentTime = now.getTime()
    now.setSeconds(0, 0)
    now.setMinutes(Math.round(now.getMinutes() / 5) * 5)
    if (now.getTime() > currentTime) now.setMinutes(now.getMinutes() - 5)
    const valueNow = toInputDateTime(now)
    onChange(valueNow)
    setNowNote(`Set to ${formatTime(now)}`)
  }

  return (
    <fieldset className="min-w-0 sm:col-span-2">
      <legend className="mb-1.5 text-[13px] font-medium text-espresso">
        {label} {required && <span className="text-error" aria-hidden="true">*</span>}
      </legend>
      <div className="grid grid-cols-4 gap-2 sm:grid-cols-[minmax(180px,1.4fr)_minmax(72px,.6fr)_minmax(78px,.65fr)_minmax(78px,.65fr)_auto]">
        <div className="col-span-4 min-w-0 sm:col-span-1">
          <DatePicker
            id={`${id}-date`}
            label="Date"
            required={false}
            value={dateValue}
            onChange={(date) => emit({ date })}
            maxDate={today}
            error={error}
            aria-describedby={hint ? hintId : undefined}
          />
        </div>
        <div>
          <Label htmlFor={`${id}-hour`} className="mb-1 block text-[12px] text-warmgray">Hour</Label>
          <Select
            id={`${id}-hour`}
            value={parts.hour12}
            onChange={(event) => emit({ hour12: parseInt(event.target.value, 10) })}
            error={Boolean(error)}
            aria-describedby={error ? errorId : hint ? hintId : undefined}
            className="h-10 px-2 text-[13px] tabular"
          >
            {HOURS_12.map((hour) => <option key={hour} value={hour}>{hour}</option>)}
          </Select>
        </div>
        <div>
          <Label htmlFor={`${id}-minute`} className="mb-1 block text-[12px] text-warmgray">Minute</Label>
          <Select
            id={`${id}-minute`}
            value={parts.minutes}
            onChange={(event) => emit({ minutes: parseInt(event.target.value, 10) })}
            error={Boolean(error)}
            aria-describedby={error ? errorId : hint ? hintId : undefined}
            className="h-10 px-2 text-[13px] tabular"
          >
            {parts.minutes % 5 !== 0 && <option value={parts.minutes}>{String(parts.minutes).padStart(2, '0')}</option>}
            {MINUTES.map((minute) => <option key={minute} value={minute}>{String(minute).padStart(2, '0')}</option>)}
          </Select>
        </div>
        <div>
          <Label htmlFor={`${id}-ampm`} className="mb-1 block text-[12px] text-warmgray">Period</Label>
          <Select
            id={`${id}-ampm`}
            value={parts.ampm}
            onChange={(event) => emit({ ampm: event.target.value })}
            error={Boolean(error)}
            aria-describedby={error ? errorId : hint ? hintId : undefined}
            className="h-10 px-2 text-[13px] tabular"
          >
            <option value="AM">AM</option>
            <option value="PM">PM</option>
          </Select>
        </div>
        <div className="col-span-1 flex flex-col justify-end">
          <span className="mb-1 hidden text-[12px] text-transparent sm:block" aria-hidden="true">Now</span>
          <Button type="button" variant="outline" size="md" onClick={setNow} className="h-10 min-h-10 px-3">
            <Clock className="size-4" aria-hidden="true" /> Now
          </Button>
        </div>
      </div>
      {error && <p id={errorId} className="mt-1.5 text-xs text-error" role="alert">{error}</p>}
      {nowNote && <p className="mt-1 text-xs text-success" aria-live="polite">{nowNote}</p>}
      {hint && <p id={hintId} className="mt-1.5 text-xs text-warmgray">{hint}</p>}
    </fieldset>
  )
}
