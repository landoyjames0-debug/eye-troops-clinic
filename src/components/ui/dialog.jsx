import * as DialogPrimitive from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

export const Dialog = DialogPrimitive.Root
export const DialogTrigger = DialogPrimitive.Trigger
export const DialogClose = DialogPrimitive.Close

const overlayClasses =
  'fixed inset-0 z-50 bg-espresso/35 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0'

/**
 * Standard modal sizes:
 * - sm: 400px  (simple confirmations, single-field forms)
 * - md: 480px  (standard forms)
 * - lg: 640px  (complex forms, multi-section)
 * - xl: 800px  (very large forms, receipt previews)
 */
const sizeClasses = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  full: 'max-w-[calc(100vw-1.5rem)]',
}

const contentClasses = [
  'fixed left-1/2 top-1/2 z-50 w-[calc(100vw-1.5rem)] sm:w-[calc(100vw-2rem)]',
  '-translate-x-1/2 -translate-y-1/2',
  'rounded-card border border-champagne bg-surface shadow-pop',
  'max-h-[90dvh] flex flex-col overflow-hidden',
].join(' ')

const headerClasses =
  'flex items-start justify-between gap-4 border-b border-champagne px-4 py-3.5 sm:px-6 sm:py-4 shrink-0'

const bodyClasses = 'flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-5'

const footerClasses =
  'flex flex-wrap justify-end gap-2.5 border-t border-champagne bg-ivory/70 px-4 py-3 sm:px-6 sm:py-3.5 shrink-0'

export function DialogContent({
  title,
  description,
  children,
  footer,
  size = 'md',
  className,
  showClose = true,
  closeOnOverlayClick = true,
}) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay
        className={overlayClasses}
        onClick={closeOnOverlayClick ? undefined : (e) => e.preventDefault()}
      />
      <DialogPrimitive.Content
        className={cn(contentClasses, sizeClasses[size], className)}
      >
        <header className={headerClasses}>
          <div className="min-w-0">
            <DialogPrimitive.Title className="font-display text-lg font-semibold tracking-tight text-espresso">
              {title}
            </DialogPrimitive.Title>
            {description && (
              <DialogPrimitive.Description className="mt-1 text-[13px] leading-relaxed text-warmgray">
                {description}
              </DialogPrimitive.Description>
            )}
          </div>
          {showClose && (
            <DialogPrimitive.Close
              className={cn(
                '-mt-1 -mr-1.5 flex size-9 shrink-0 items-center justify-center',
                'rounded-control',
                'text-warmgray transition-colors',
                'hover:bg-ivory hover:text-espresso',
                'focus:outline-none focus:ring-2 focus:ring-gold/20 focus:ring-offset-2 focus:ring-offset-surface'
              )}
              aria-label="Close dialog"
            >
              <X className="size-4" aria-hidden="true" />
            </DialogPrimitive.Close>
          )}
        </header>

        <div className={bodyClasses}>{children}</div>

        {footer && <footer className={footerClasses}>{footer}</footer>}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  )
}

/**
 * A specialized dialog for full-screen mobile forms with sticky footer.
 * Use for complex forms that need more space on mobile.
 */
export function FullScreenDialogContent({
  title,
  description,
  children,
  footer,
  className,
  showClose = true,
}) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className={overlayClasses} />
      <DialogPrimitive.Content
        className={cn(
          'fixed inset-0 z-50 flex flex-col',
          'bg-surface border border-champagne',
          'rounded-card sm:rounded-none sm:border-none sm:shadow-pop',
          'max-h-full',
          className,
        )}
      >
        <header className={cn(headerClasses, 'bg-surface/95 backdrop-blur-sm')}>
          <div className="min-w-0">
            <DialogPrimitive.Title className="font-display text-lg font-semibold tracking-tight text-espresso">
              {title}
            </DialogPrimitive.Title>
            {description && (
              <DialogPrimitive.Description className="mt-1 text-[13px] leading-relaxed text-warmgray">
                {description}
              </DialogPrimitive.Description>
            )}
          </div>
          {showClose && (
            <DialogPrimitive.Close
              className={cn(
                '-mt-1 -mr-1.5 flex size-9 shrink-0 items-center justify-center',
                'rounded-control',
                'text-warmgray transition-colors',
                'hover:bg-ivory hover:text-espresso',
                'focus:outline-none focus:ring-2 focus:ring-gold/20 focus:ring-offset-2 focus:ring-offset-surface'
              )}
              aria-label="Close dialog"
            >
              <X className="size-4" aria-hidden="true" />
            </DialogPrimitive.Close>
          )}
        </header>

        <div className={bodyClasses}>{children}</div>

        {footer && (
          <footer className={cn(footerClasses, 'bg-surface/95 backdrop-blur-sm')}>
            {footer}
          </footer>
        )}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  )
}
