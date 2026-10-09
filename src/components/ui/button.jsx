import { cva } from 'class-variance-authority'
import { Slot } from '@radix-ui/react-slot'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

export const buttonVariants = cva(
  [
    'inline-flex items-center justify-center gap-2 rounded-[var(--radius-control)] font-medium',
    'transition-[background-color,border-color,color,box-shadow,transform] duration-150',
    'whitespace-nowrap select-none active:translate-y-px',
    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold',
    'disabled:pointer-events-none disabled:opacity-55',
  ].join(' '),
  {
    variants: {
      variant: {
        // Champagne Gold is the brand primary (spec 01). White on #B8893D sits
        // at ~2.9:1, below WCAG AA for body text, so the hover state moves to
        // Dark Antique Gold (#8F672C) for a legible, higher-contrast rest state.
        primary: 'bg-gold text-white shadow-card hover:bg-gold-dark',
        outline: 'border border-champagne bg-surface text-espresso hover:border-gold/45 hover:bg-gold-light/60',
        subtle: 'bg-gold-light text-espresso hover:bg-champagne',
        ghost: 'text-warmgray hover:bg-gold-light/60 hover:text-espresso',
        danger: 'bg-error text-white shadow-card hover:bg-error/90',
        link: 'text-gold-dark underline-offset-4 hover:underline',
      },
      size: {
        sm: 'h-10 px-3.5 text-[13px]',
        md: 'h-11 px-4 text-sm',
        lg: 'h-12 px-5 text-[15px]',
        icon: 'size-10',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
)

export function Button({
  className,
  variant,
  size,
  asChild = false,
  loading = false,
  loadingText,
  children,
  disabled,
  ...props
}) {
  const Component = asChild ? Slot : 'button'
  const content = loading && loadingText ? loadingText : children

  /**
   * Radix `Slot` requires exactly one child. A `loading && <Loader/>` sibling
   * would still count as a child even when false, so the spinner is only added
   * on the real-button path.
   */
  if (asChild) {
    return (
      <Component className={cn(buttonVariants({ variant, size }), className)} {...props}>
        {content}
      </Component>
    )
  }

  return (
    <Component
      className={cn(buttonVariants({ variant, size }), className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading && <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden="true" />}
      {content}
    </Component>
  )
}
