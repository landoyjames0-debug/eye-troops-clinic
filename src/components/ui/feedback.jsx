import { AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

export function Skeleton({ className }) {
  return <div className={cn('animate-pulse rounded-md bg-champagne/45', className)} />
}

export function SkeletonRows({ rows = 5, columns = 5 }) {
  return (
    <tbody className="divide-y divide-champagne/70">
      {Array.from({ length: rows }, (_, rowIndex) => (
        <tr key={rowIndex}>
          {Array.from({ length: columns }, (_, colIndex) => (
            <td key={colIndex} className="px-4 py-3.5">
              <Skeleton className="h-4 w-full" />
            </td>
          ))}
        </tr>
      ))}
    </tbody>
  )
}

export function SkeletonCards({ count = 3, className }) {
  return (
    <div className={cn('grid gap-4 sm:grid-cols-2 xl:grid-cols-3', className)}>
      {Array.from({ length: count }, (_, index) => (
        <div
          key={index}
          className="rounded-[var(--radius-card)] border border-champagne bg-surface p-5 shadow-card"
        >
          <Skeleton className="h-3 w-24" />
          <Skeleton className="mt-3.5 h-7 w-32" />
          <Skeleton className="mt-2.5 h-3 w-40" />
        </div>
      ))}
    </div>
  )
}

export function EmptyState({ icon: Icon, title, description, action, className }) {
  return (
    <div className={cn('flex flex-col items-center px-6 py-14 text-center', className)}>
      {Icon && (
        <span className="flex size-11 items-center justify-center rounded-xl bg-gold-light/70 text-gold-dark">
          <Icon className="size-5" strokeWidth={1.6} aria-hidden="true" />
        </span>
      )}
      <p className="mt-4 text-[15px] font-semibold text-espresso">{title}</p>
      {description && <p className="mt-1.5 max-w-sm text-[13px] text-warmgray">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

export function ErrorNote({ message, className }) {
  return (
    <div
      role="alert"
      className={cn(
        'flex items-start gap-2.5 rounded-[var(--radius-control)] border border-error/25 bg-error/5 px-3.5 py-2.5 text-[13px] text-error',
        className,
      )}
    >
      <AlertCircle className="mt-px size-4 shrink-0" strokeWidth={1.8} aria-hidden="true" />
      <span>{message}</span>
    </div>
  )
}
