import { cva } from 'class-variance-authority'
import { cn } from '@/lib/utils'
import { statusLabel } from '@/utils/strings'

/**
 * Badges are small rounded rectangles (6px), not pills — pills read as generic
 * dashboard chrome. Colour always carries a text label as well, so status is
 * never communicated by colour alone.
 */
export const badgeVariants = cva(
  'inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap',
  {
    variants: {
      variant: {
        neutral: 'bg-ivory text-warmgray ring-1 ring-champagne/70 ring-inset',
        gold: 'bg-gold-light text-gold-dark',
        success: 'bg-success/10 text-success',
        warning: 'bg-warning/12 text-warning',
        error: 'bg-error/10 text-error',
        outline: 'border border-champagne text-warmgray',
      },
    },
    defaultVariants: { variant: 'neutral' },
  },
)

export function Badge({ variant, className, ...props }) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />
}

const STATUS_VARIANT = {
  ORDERED: 'neutral',
  IN_LAB: 'gold',
  READY_FOR_PICKUP: 'warning',
  CLAIMED: 'success',
  CANCELLED: 'error',
  COMPLETED: 'success',
  VOIDED: 'neutral',
  REFUNDED: 'warning',
  PAID: 'success',
  PARTIAL: 'warning',
  UNPAID: 'error',
  OVERDUE: 'error',
}

const STATUS_DOT = {
  ORDERED: 'bg-warmgray',
  IN_LAB: 'bg-gold',
  READY_FOR_PICKUP: 'bg-warning',
  CLAIMED: 'bg-success',
  CANCELLED: 'bg-error',
  COMPLETED: 'bg-success',
  VOIDED: 'bg-warmgray',
  REFUNDED: 'bg-warning',
  PAID: 'bg-success',
  PARTIAL: 'bg-warning',
  UNPAID: 'bg-error',
  OVERDUE: 'bg-error',
}

export function StatusBadge({ status, className }) {
  const variant = STATUS_VARIANT[status] ?? 'neutral'
  const dot = STATUS_DOT[status] ?? 'bg-warmgray'

  return (
    <Badge variant={variant} className={className}>
      <span className={cn('size-1.5 rounded-full', dot)} aria-hidden="true" />
      {statusLabel(status)}
    </Badge>
  )
}
