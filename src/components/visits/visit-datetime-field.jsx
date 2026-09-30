import { Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Field, Label, controlVariants } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import {
  fromVisitDateTimeParts,
  parseInputDateTime,
  toInputDateTime,
} from '@/utils/dates'

const HOURS_12 = Array.from({ length: 12 }, (_, index) => index + 1)
const MINUTES = Array.from({ length: 60 }, (_, index) => index)

function selectClass(invalid) {
  return cn(controlVariants({ invalid }), 'select-chevron h-11 py-0 pl-3 pr-9 tabular')
}

export function VisitDateTimeField({ id = 'visitDate', label, value, onChange, error, required, hint }) {
  const parts = parseInputDateTime(value)

  const emit = (patch) => {
    onChange(fromVisitDateTimeParts({ ...parts, ...patch }))
  }

  const setNow = () => {
    onChange(toInputDateTime(new Date()))
  }

  return (
    <Field id={id} label={label} hint={hint} error={error} required={required} className="sm:col-span-2">
      <div className="rounded-[var(--radius-control)] border border-champagne bg-ivory/30 p-3.5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-[10rem] flex-1">
            <Label htmlFor={`${id}-date`} className="text-[12px] text-warmgray">
              Date
            </Label>
            <input
              id={`${id}-date`}
              type="date"
              value={parts.date}
              onChange={(event) => emit({ date: event.target.value })}
              className={cn(controlVariants({ invalid: Boolean(error) }), 'mt-1 h-11 w-full px-3.5')}
            />
          </div>
          <Button type="button" variant="outline" size="sm" onClick={setNow} className="shrink-0">
            <Clock className="size-4" aria-hidden="true" />
            Now
          </Button>
        </div>

        <div className="mt-3 grid grid-cols-3 gap-2 sm:max-w-md">
          <div>
            <Label htmlFor={`${id}-hour`} className="text-[12px] text-warmgray">
              Hour
            </Label>
            <select
              id={`${id}-hour`}
              value={parts.hour12}
              onChange={(event) => emit({ hour12: parseInt(event.target.value, 10) })}
              className={cn(selectClass(Boolean(error)), 'mt-1 w-full')}
            >
              {HOURS_12.map((hour) => (
                <option key={hour} value={hour}>
                  {hour}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor={`${id}-minute`} className="text-[12px] text-warmgray">
              Minute
            </Label>
            <select
              id={`${id}-minute`}
              value={parts.minutes}
              onChange={(event) => emit({ minutes: parseInt(event.target.value, 10) })}
              className={cn(selectClass(Boolean(error)), 'mt-1 w-full')}
            >
              {MINUTES.map((minute) => (
                <option key={minute} value={minute}>
                  {String(minute).padStart(2, '0')}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor={`${id}-ampm`} className="text-[12px] text-warmgray">
              Period
            </Label>
            <select
              id={`${id}-ampm`}
              value={parts.ampm}
              onChange={(event) => emit({ ampm: event.target.value })}
              className={cn(selectClass(Boolean(error)), 'mt-1 w-full')}
            >
              <option value="AM">AM</option>
              <option value="PM">PM</option>
            </select>
          </div>
        </div>
      </div>
    </Field>
  )
}
