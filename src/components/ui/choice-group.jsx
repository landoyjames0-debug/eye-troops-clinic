import { cn } from '@/lib/utils'
import { Field } from '@/components/ui/input'

function normalizeOption(option) {
  if (typeof option === 'string') {
    return { value: option, label: option, icon: null }
  }
  return {
    value: option.value,
    label: option.label ?? option.value,
    icon: option.icon ?? null,
  }
}

/**
 * Tap-friendly option picker that matches clinic cards — no native `<select>` menu.
 */
export function ChoiceGroup({
  id,
  label,
  hint,
  error,
  required,
  value,
  onChange,
  options,
  layout = 'wrap',
  size = 'default',
  labelPosition = 'stacked',
  className,
}) {
  const compact = size === 'compact'

  const layoutClass =
    layout === 'grid-2'
      ? 'grid grid-cols-2 gap-2'
      : layout === 'grid-3'
        ? 'grid grid-cols-2 gap-2 sm:grid-cols-3'
        : layout === 'scroll'
          ? 'flex flex-nowrap gap-1.5 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden'
          : 'flex flex-wrap gap-2'

  const chipClass = cn(
    'inline-flex shrink-0 items-center justify-center gap-1.5 rounded-md border font-medium transition-all duration-150',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/30',
    compact ? 'min-h-8 px-2.5 py-1 text-[12px]' : 'min-h-10 gap-2 px-3 py-2 text-[13px]',
    layout.startsWith('grid') && 'w-full text-left sm:justify-start',
  )

  const chips = (
    <div
      role="radiogroup"
      aria-label={label || undefined}
      aria-invalid={error ? 'true' : undefined}
      aria-describedby={error ? `${id}-error` : undefined}
      className={cn(layoutClass, labelPosition === 'inline' && 'min-w-0 flex-1')}
    >
      {options.map((raw) => {
        const option = normalizeOption(raw)
        const selected = value === option.value
        const Icon = option.icon
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(option.value)}
            className={cn(
              chipClass,
              selected
                ? 'border-gold bg-gold-light text-espresso ring-1 ring-gold/25'
                : 'border-champagne bg-white text-warmgray hover:border-gold/45 hover:bg-ivory hover:text-espresso',
            )}
          >
            {Icon && (
              <Icon
                className={cn(
                  'shrink-0',
                  compact ? 'size-3.5' : 'size-4',
                  selected ? 'text-gold-dark' : 'text-warmgray',
                )}
                strokeWidth={2}
                aria-hidden="true"
              />
            )}
            <span className="leading-snug whitespace-nowrap">{option.label}</span>
          </button>
        )
      })}
    </div>
  )

  if (labelPosition === 'inline') {
    return (
      <div className={cn('flex min-w-0 items-center gap-2.5', className)}>
        {label && (
          <span
            id={`${id}-label`}
            className="w-17 shrink-0 text-[11px] font-semibold tracking-wide text-warmgray uppercase"
          >
            {label}
          </span>
        )}
        {chips}
      </div>
    )
  }

  return (
    <Field
      id={id ?? ''}
      label={label}
      hint={hint}
      error={error}
      required={required}
      className={className}
    >
      {chips}
    </Field>
  )
}
