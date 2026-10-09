import { cn } from '@/lib/utils'
import { Link } from 'react-router-dom'
import { ArrowUpRight } from 'lucide-react'

export function PageHeader({ title, description, action }) {
  return (
    <div className="mb-7 flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
      <div className="min-w-0">
        <h1 className="font-display text-[clamp(1.5rem,2.5vw+0.5rem,1.875rem)] leading-[1.15] font-bold tracking-tight text-espresso">
          {title}
        </h1>
        {description && <p className="mt-1.5 text-sm text-warmgray">{description}</p>}
      </div>
      {action}
    </div>
  )
}

/**
 * KPI Card for dashboard summaries.
 * Structure:
 * - small context label (TODAY, MONTH, OUTSTANDING, OPERATIONS)
 * - Card title
 * - Large value with icon
 * - Supporting description
 */
export function StatTile({
  contextLabel,
  label,
  value,
  icon: Icon,
  tone = 'neutral',
  description,
  className,
  to,
  ariaLabel,
  ...props
}) {
  const toneStyles = {
    neutral: {
      iconBg: 'bg-gradient-to-br from-gold-light to-champagne',
      iconColor: 'text-gold-dark',
      valueColor: 'text-espresso',
      borderColor: 'border-champagne',
      descColor: 'text-warmgray',
      accentBar: 'bg-gold',
    },
    success: {
      iconBg: 'bg-gradient-to-br from-success/15 to-success/5',
      iconColor: 'text-success',
      valueColor: 'text-success',
      borderColor: 'border-success/20',
      descColor: 'text-warmgray',
      accentBar: 'bg-success',
    },
    warning: {
      iconBg: 'bg-gradient-to-br from-warning/15 to-warning/5',
      iconColor: 'text-warning',
      valueColor: 'text-warning',
      borderColor: 'border-warning/20',
      descColor: 'text-warmgray',
      accentBar: 'bg-warning',
    },
    error: {
      iconBg: 'bg-gradient-to-br from-error/15 to-error/5',
      iconColor: 'text-error',
      valueColor: 'text-error',
      borderColor: 'border-error/20',
      descColor: 'text-warmgray',
      accentBar: 'bg-error',
    },
    gold: {
      iconBg: 'bg-gradient-to-br from-gold-light to-gold/15',
      iconColor: 'text-gold-dark',
      valueColor: 'text-gold-dark',
      borderColor: 'border-gold/30',
      descColor: 'text-warmgray',
      accentBar: 'bg-gold',
    },
  }

  const styles = toneStyles[tone] || toneStyles.neutral

  const Tile = to ? Link : 'div'

  return (
    <Tile
      {...props}
      {...(to ? { to, 'aria-label': ariaLabel ?? `${label}: ${value}` } : {})}
      className={cn(
        'relative overflow-hidden rounded-card border bg-surface p-5 shadow-card min-h-37.5 transition-all duration-200 hover:shadow-raised',
        styles.borderColor,
        to && 'group cursor-pointer hover:-translate-y-0.5 hover:border-gold/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:ring-offset-surface',
        className,
      )}
    >
      {/* Colored accent bar at top */}
      <div className={cn('absolute inset-x-0 top-0 h-0.75', styles.accentBar)} />

      <div className="flex items-start justify-between gap-2.5">
        <div className="min-w-0 flex-1">
          {contextLabel && (
            <p className="text-[10px] font-semibold tracking-[0.15em] text-gold-dark uppercase mb-1.5">
              {contextLabel}
            </p>
          )}
          <p className="text-[12px] font-semibold tracking-tight text-espresso mb-2">
            {label}
          </p>
          <p
            className={cn(
              'tabular font-display leading-none font-bold tracking-tight truncate max-w-full',
              styles.valueColor,
              'text-[clamp(1.5rem,2.2vw+0.5rem,1.875rem)]',
            )}
          >
            {value}
          </p>
          {description && (
            <p className={cn('mt-1.5 text-[11px] leading-relaxed', styles.descColor, to && 'pr-5')}>
              {description}
            </p>
          )}
        </div>
        {Icon && (
          <span
            className={cn(
              'flex size-10 shrink-0 items-center justify-center rounded-xl',
              styles.iconBg,
              styles.iconColor,
            )}
            aria-hidden="true"
          >
            <Icon className="size-5" strokeWidth={1.7} />
          </span>
        )}
      </div>
      {to && <ArrowUpRight className="absolute right-4 bottom-4 size-4 text-gold-dark opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100 motion-reduce:transition-none" aria-hidden="true" />}
    </Tile>
  )
}

export function SectionTitle({ children, description, action, className }) {
  return (
    <div
      className={cn(
        'mb-3 flex flex-wrap items-start justify-between gap-x-4 gap-y-2',
        className,
      )}
    >
      <div className="min-w-0">
        <h2 className="font-display text-[18px] font-semibold tracking-tight text-espresso">
          {children}
        </h2>
        {description && <p className="mt-1 text-[13px] text-warmgray">{description}</p>}
      </div>
      {action}
    </div>
  )
}

export function Avatar({ name, className }) {
  const letters = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('')

  return (
    <span
      className={cn(
        'flex size-9 shrink-0 items-center justify-center rounded-full bg-gold-light text-xs font-semibold text-gold-dark',
        className,
      )}
      aria-hidden="true"
    >
      {letters}
    </span>
  )
}