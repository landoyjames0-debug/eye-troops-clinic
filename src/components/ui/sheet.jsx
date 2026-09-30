import * as DialogPrimitive from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Right-hand drawer. Used for Patient details and Order details so the
 * underlying list stays visible; on small screens it becomes a full-width
 * panel.
 */
export const Sheet = DialogPrimitive.Root
export const SheetTrigger = DialogPrimitive.Trigger
export const SheetClose = DialogPrimitive.Close

export function SheetContent({ title, description, children, footer, className }) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-espresso/40 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
      <DialogPrimitive.Content
        className={cn(
          'fixed inset-y-0 right-0 z-50 flex w-full max-w-[520px] flex-col',
          'border-l border-champagne bg-surface shadow-pop',
          'data-[state=open]:animate-in data-[state=open]:slide-in-from-right',
          className,
        )}
      >
        <header className="flex items-start justify-between gap-4 border-b border-champagne px-6 py-4">
          <div className="min-w-0">
            <DialogPrimitive.Title className="font-display text-lg font-semibold tracking-tight text-espresso">
              {title}
            </DialogPrimitive.Title>
            {description && (
              <DialogPrimitive.Description className="mt-1 text-[13px] text-warmgray">
                {description}
              </DialogPrimitive.Description>
            )}
          </div>
          <DialogPrimitive.Close
            className="-mt-1 -mr-1.5 rounded-[var(--radius-control)] p-2 text-warmgray transition-colors hover:bg-ivory hover:text-espresso"
            aria-label="Close"
          >
            <X className="size-4" aria-hidden="true" />
          </DialogPrimitive.Close>
        </header>

        <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>

        {footer && (
          <footer className="flex flex-wrap justify-end gap-2.5 border-t border-champagne bg-ivory/70 px-6 py-3.5">
            {footer}
          </footer>
        )}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  )
}
