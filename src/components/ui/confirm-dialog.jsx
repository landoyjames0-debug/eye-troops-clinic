import { AlertTriangle, LogOut, Trash2, Info } from 'lucide-react'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

/**
 * Shared confirmation for destructive or irreversible actions — cancelling an
 * order, voiding a payment, archiving a patient, deleting an expense. Kept
 * deliberately small: one consequence sentence, one escape hatch, one commit.
 */
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  tone = 'danger',
  loading = false,
  loadingText: loadingTextProp,
  onConfirm,
  onClose,
}) {
  if (!open) return null

  const isDanger = tone === 'danger'
  const isWarning = tone === 'warning'
  const isNeutral = tone === 'neutral'

  const Icon = isDanger
    ? AlertTriangle
    : isWarning
      ? Trash2
      : isNeutral
        ? LogOut
        : Info

  const iconBg = isDanger
    ? 'bg-error/10 text-error'
    : isWarning
      ? 'bg-warning/10 text-warning'
      : 'bg-gold-light text-gold-dark'

  const loadingText =
    loadingTextProp ??
    (isDanger ? 'Archiving...' : isWarning ? 'Deleting...' : isNeutral ? 'Signing out...' : 'Confirming...')

  return (
    <Dialog
      open
      onOpenChange={(next) => {
        if (!next && !loading) onClose()
      }}
    >
      <DialogContent
        title={title}
        size="sm"
        footer={
          <>
            <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
              {cancelLabel}
            </Button>
            <Button
              type="button"
              variant={isDanger ? 'danger' : isWarning ? 'danger' : 'primary'}
              onClick={onConfirm}
              loading={loading}
              loadingText={loadingText}
            >
              {confirmLabel}
            </Button>
          </>
        }
      >
        <div className="flex items-start gap-3">
          <span
            className={cn(
              'flex size-9 shrink-0 items-center justify-center rounded-full',
              iconBg
            )}
            aria-hidden="true"
          >
            <Icon className="size-[18px]" />
          </span>
          <p className="pt-1 text-[13px] leading-relaxed text-warmgray">{message}</p>
        </div>
      </DialogContent>
    </Dialog>
  )
}
