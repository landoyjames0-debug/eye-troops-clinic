import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { AlertTriangle, Info, Loader2 } from 'lucide-react'

const VARIANT_META = {
  default: {
    icon: Info,
    iconClassName: 'bg-gold-light text-gold-dark',
    buttonClassName: 'bg-gold text-espresso hover:bg-[color:var(--color-gold)]',
  },
  danger: {
    icon: AlertTriangle,
    iconClassName: 'bg-error/10 text-error',
    buttonClassName: 'bg-error text-white hover:brightness-95',
  },
}

export function ConfirmDialog({
  open,
  title = 'Confirm',
  message = 'Are you sure?',
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'default',
  loading = false,
  confirmDisabled = false,
  error = '',
  onConfirm,
  onCancel,
  onClose,
}) {
  const backdropRef = useRef(null)
  const dialogRef = useRef(null)
  const cancelButtonRef = useRef(null)
  const previousFocusRef = useRef(null)
  const handleCancel = onCancel || onClose

  useEffect(() => {
    if (!open) return

    previousFocusRef.current = document.activeElement
    cancelButtonRef.current?.focus()

    const handleKeyDown = (event) => {
      if (event.key === 'Escape' && !loading && handleCancel) {
        event.preventDefault()
        handleCancel()
        return
      }

      if (event.key === 'Enter' && !loading && !confirmDisabled && onConfirm) {
        const target = event.target
        const isDialog = target === dialogRef.current || dialogRef.current?.contains(target)
        if (isDialog && target !== cancelButtonRef.current) {
          event.preventDefault()
          onConfirm()
        }
      }

      if (event.key === 'Tab' && dialogRef.current) {
        const focusables = dialogRef.current.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        )
        const first = focusables[0]
        const last = focusables[focusables.length - 1]

        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault()
          last?.focus()
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault()
          first?.focus()
        }
      }
    }

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', handleKeyDown)
      previousFocusRef.current?.focus?.()
    }
  }, [confirmDisabled, loading, onCancel, onConfirm, open])

  if (!open) return null

  const variantMeta = VARIANT_META[variant] ?? VARIANT_META.default
  const Icon = variantMeta.icon

  return createPortal(
    <div
      ref={backdropRef}
      className="fixed inset-0 z-100 flex items-center justify-center bg-[rgba(53,42,32,0.48)] p-4 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (loading) return
        if (event.target === backdropRef.current && handleCancel) {
          handleCancel()
        }
      }}
    >
      <div
        ref={dialogRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-message"
        className="confirm-dialog flex max-h-[90dvh] w-full max-w-md flex-col overflow-hidden rounded-card border border-champagne bg-surface shadow-pop sm:rounded-card md:rounded-card"
        style={{
          // Mobile bottom sheet: full width, bottom anchored, rounded top only
          // Desktop: centered, rounded all corners
        }}
      >
        <div className="flex flex-1 items-start gap-3 overflow-y-auto border-b border-champagne px-5 py-4">
          <span
            className={`flex size-11 shrink-0 items-center justify-center rounded-full ${variantMeta.iconClassName}`}
            aria-hidden="true"
          >
            <Icon className="size-5" strokeWidth={2} />
          </span>

          <div className="min-w-0 flex-1">
            <h2 id="confirm-dialog-title" className="text-base font-semibold text-espresso">
              {title}
            </h2>
            <p id="confirm-dialog-message" className="mt-1 text-sm leading-relaxed text-warmgray">
              {message}
            </p>
          </div>
        </div>

        {error && (
          <div className="shrink-0 border-b border-error/20 bg-error/5 px-5 py-3 text-sm text-error" role="alert">
            {error}
          </div>
        )}

        <div className="flex shrink-0 items-center justify-end gap-2.5 px-5 py-4">
          <button
            ref={cancelButtonRef}
            type="button"
            onClick={() => !loading && handleCancel?.()}
            disabled={loading || confirmDisabled}
            className="rounded-control border border-champagne bg-surface px-3.5 py-2 text-sm font-medium text-espresso transition-colors hover:bg-ivory disabled:cursor-not-allowed disabled:opacity-60"
          >
            {cancelLabel}
          </button>

          <button
            type="button"
            onClick={() => !loading && onConfirm?.()}
            disabled={loading || confirmDisabled}
            className={`inline-flex items-center justify-center gap-2 rounded-control px-3.5 py-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-70 ${variantMeta.buttonClassName}`}
          >
            {loading && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
