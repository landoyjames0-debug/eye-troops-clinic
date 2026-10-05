import { cva } from 'class-variance-authority'
import { cn } from '@/lib/utils'

export const labelVariants = cva('mb-1.5 block text-[13px] font-medium text-espresso')

export function Label({ className, ...props }) {
  return <label className={cn(labelVariants(), className)} {...props} />
}

export const controlVariants = cva(
  [
    'w-full rounded-[var(--radius-control)] border bg-white text-sm text-espresso',
    'placeholder:text-warmgray/55 transition-[border-color,box-shadow]',
    'focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/20',
    'disabled:cursor-not-allowed disabled:bg-ivory disabled:text-warmgray',
  ].join(' '),
  {
    variants: {
      invalid: {
        true: 'border-error focus:border-error focus:ring-error/15',
        false: 'border-champagne',
      },
    },
    defaultVariants: { invalid: false },
  },
)

export function Field({ id, label, hint, error, required, className, children }) {
  return (
    <div className={className}>
      {label && (
        <Label htmlFor={id}>
          {label}
          {required && (
            <span className="ml-0.5 text-error" aria-hidden="true">
              *
            </span>
          )}
        </Label>
      )}
      {children}
      {error ? (
        <p id={`${id}-error`} className="mt-1.5 text-xs text-error" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="mt-1.5 text-xs text-warmgray">{hint}</p>
      ) : null}
    </div>
  )
}

/**
 * Shared control shell. A leading adornment (the `₱` symbol) and a trailing
 * control (reveal password) can be combined; horizontal padding is derived
 * from which sides are occupied so the text never collides with either.
 *
 * `className` styles the input itself, matching the rest of the form controls.
 */
function Control({ id, error, leading, trailing, inputRef, className, ...props }) {
  const describedBy = error ? `${id}-error` : undefined

  return (
    <div className="relative">
      <input
        ref={inputRef}
        id={id}
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={describedBy}
        className={cn(
          controlVariants({ invalid: Boolean(error) }),
          'h-11',
          leading ? 'pl-8' : 'px-3.5',
          trailing ? 'pr-11' : leading ? 'pr-3.5' : 'px-3.5',
          className,
        )}
        {...props}
      />
      {leading && (
        <span
          className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-sm text-warmgray"
          aria-hidden="true"
        >
          {leading}
        </span>
      )}
      {trailing && (
        <span className="absolute inset-y-0 right-0 flex items-center pr-2 text-warmgray">
          {trailing}
        </span>
      )}
    </div>
  )
}

export function Input({
  label,
  hint,
  error,
  required,
  containerClassName,
  className,
  id,
  leading,
  trailing,
  inputRef,
  ...props
}) {
  return (
    <Field
      id={id ?? ''}
      label={label}
      hint={hint}
      error={error}
      required={required}
      className={containerClassName}
    >
      <Control
        id={id}
        error={error}
        leading={leading}
        trailing={trailing}
        inputRef={inputRef}
        className={className}
        {...props}
      />
    </Field>
  )
}

export function Textarea({
  label,
  hint,
  error,
  required,
  containerClassName,
  className,
  id,
  rows = 3,
  ...props
}) {
  return (
    <Field
      id={id ?? ''}
      label={label}
      hint={hint}
      error={error}
      required={required}
      className={containerClassName}
    >
      <textarea
        id={id}
        rows={rows}
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        className={cn(controlVariants({ invalid: Boolean(error) }), 'resize-y px-3.5 py-2.5', className)}
        {...props}
      />
    </Field>
  )
}

export { Select } from '@/components/Select'
