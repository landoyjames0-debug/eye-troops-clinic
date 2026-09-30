import { cn } from '@/lib/utils'

export function Card({ className, ...props }) {
  return (
    <div
      className={cn(
        'min-w-0 rounded-[var(--radius-card)] border border-champagne bg-surface shadow-card transition-shadow duration-200 hover:shadow-raised',
        className,
      )}
      {...props}
    />
  )
}

export function CardHeader({ title, description, action, className }) {
  return (
    <div className={cn('flex items-start justify-between gap-4', className)}>
      <div className="min-w-0">
        <h2 className="text-base font-semibold tracking-tight text-espresso">{title}</h2>
        {description && <p className="mt-1 text-[13px] text-warmgray">{description}</p>}
      </div>
      {action}
    </div>
  )
}

export function CardContent({ className, ...props }) {
  return <div className={cn('px-5 pb-5', className)} {...props} />
}

export function Table({ className, ...props }) {
  return (
    <div className="w-full overflow-x-auto">
      <table className={cn('w-full caption-bottom border-collapse text-sm', className)} {...props} />
    </div>
  )
}

export function THead({ className, ...props }) {
  return <thead className={cn('border-b border-champagne bg-ivory/70', className)} {...props} />
}

export function TBody({ className, ...props }) {
  return <tbody className={cn('divide-y divide-champagne/70', className)} {...props} />
}

export function TR({ className, ...props }) {
  return <tr className={cn('transition-colors hover:bg-gold-light/25', className)} {...props} />
}

export function TH({ className, ...props }) {
  return (
    <th
      scope="col"
      className={cn(
        'px-4 py-3 text-left text-[11px] font-semibold tracking-wider text-warmgray uppercase whitespace-nowrap',
        className,
      )}
      {...props}
    />
  )
}

export function TD({ className, ...props }) {
  return <td className={cn('px-4 py-3.5 align-middle text-espresso', className)} {...props} />
}
