import { useEffect, useState } from 'react'
import { Banknote, Building2, Check, MoreHorizontal, Smartphone } from 'lucide-react'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

/** Payment methods supported by the clinic, with their Lucide icon. */
export const PAYMENT_METHOD_OPTIONS = [
  { value: 'Cash', label: 'Cash', description: 'Cash received at the counter', icon: Banknote },
  { value: 'GCash', label: 'GCash', description: 'GCash mobile wallet', icon: Smartphone },
  { value: 'Maya', label: 'Maya', description: 'Maya mobile wallet', icon: Smartphone },
  { value: 'Bank Transfer', label: 'Bank transfer', description: 'Online bank transfer', icon: Building2 },
  { value: 'Other', label: 'Other', description: 'Another payment method', icon: MoreHorizontal },
]

export function paymentMethodOption(value) {
  return PAYMENT_METHOD_OPTIONS.find((option) => option.value === value) ?? PAYMENT_METHOD_OPTIONS[0]
}

/**
 * Right-hand drawer for picking a single payment method. Selection is local
 * until Confirm, so opening or closing this drawer never records a payment or
 * saves the visit.
 */
export function PaymentMethodDrawer({ open, method, onClose, onSelect }) {
  const [draft, setDraft] = useState(method)

  useEffect(() => {
    if (open) setDraft(method)
  }, [open, method])

  const confirmSelection = () => {
    onSelect(draft)
    onClose()
  }

  return (
    <Sheet open={open} onOpenChange={(next) => { if (!next) onClose() }}>
      <SheetContent
        title="Payment method"
        description="Choose how this payment is collected."
        className="max-w-115"
        footer={
          <>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="button" onClick={confirmSelection}>
              <Check className="size-4" aria-hidden="true" />
              Confirm selection
            </Button>
          </>
        }
      >
        <div role="radiogroup" aria-label="Payment method" className="space-y-2.5">
          {PAYMENT_METHOD_OPTIONS.map((option) => {
            const Icon = option.icon
            const selected = draft === option.value
            return (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => setDraft(option.value)}
                className={cn(
                  'flex w-full items-center gap-3.5 rounded-control border px-3.5 py-3 text-left transition-colors',
                  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold',
                  selected
                    ? 'border-gold bg-gold-light/60 ring-1 ring-gold/25'
                    : 'border-champagne bg-surface hover:border-gold/45 hover:bg-ivory',
                )}
              >
                <span
                  className={cn(
                    'flex size-10 shrink-0 items-center justify-center rounded-lg',
                    selected ? 'bg-gold/15 text-gold-dark' : 'bg-ivory text-warmgray',
                  )}
                >
                  <Icon className="size-5" strokeWidth={1.8} aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-espresso">{option.label}</span>
                  <span className="block text-[12px] text-warmgray">{option.description}</span>
                </span>
                {selected && <Check className="size-4 shrink-0 text-gold-dark" aria-hidden="true" />}
              </button>
            )
          })}
        </div>
      </SheetContent>
    </Sheet>
  )
}
