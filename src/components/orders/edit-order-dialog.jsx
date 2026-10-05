import { useState, useMemo } from 'react'
import { Save } from 'lucide-react'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input, Textarea } from '@/components/ui/input'
import { ErrorNote } from '@/components/ui/feedback'
import { useConfirm } from '@/hooks/use-confirm'
import { useResultDialog } from '@/hooks/use-result-dialog'
import { useSupabaseHealth } from '@/hooks/use-supabase-health'
import { updateOrder } from '@/services/orders.service'
import { formatPeso } from '@/utils/format'

function blankForm(order) {
  return {
    description: order?.description ?? '',
    total_amount: order ? String(order.total_amount) : '',
  }
}

function formEquals(a, b) {
  return (
    a.description === b.description &&
    a.total_amount === b.total_amount
  )
}

/** Corrects an order's items and total. The balance is re-derived afterwards. */
export function EditOrderDialog({ order, onClose, onSaved }) {
  const confirm = useConfirm()
  const resultDialog = useResultDialog()
  const { isOnline } = useSupabaseHealth()
  const [initialForm] = useState(() => blankForm(order))
  const [form, setForm] = useState(() => blankForm(order))
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)

  const hasUnsavedChanges = useMemo(
    () => !formEquals(form, initialForm),
    [form, initialForm]
  )

  const persist = async () => {
    const amount = Number(form.total_amount)
    setSaving(true)
    try {
      await updateOrder(order.id, { description: form.description, total_amount: amount })
      resultDialog.success({
        title: 'Order updated',
        message: `Order ${order.order_number} was updated successfully.`,
      })
      onSaved()
      onClose()
    } catch (caught) {
      resultDialog.error({
        title: 'Could not update the order',
        message: caught?.message ?? 'Please check your connection and try again.',
        details: caught?.cause?.message,
        retryLabel: 'Try again',
        onRetry: persist,
      })
    } finally {
      setSaving(false)
    }
  }

  if (!order) return null

  const handleClose = () => {
    if (saving) return
    if (hasUnsavedChanges) {
      void confirm({
        title: 'Discard unsaved changes?',
        message: `Leave ${order.order_number} without saving your updates?`,
        confirmLabel: 'Discard changes',
        cancelLabel: 'Keep editing',
        variant: 'default',
        onConfirm: onClose,
        errorMessage: 'Could not close the form. Please try again.',
      })
      return
    }
    onClose()
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (!isOnline) return

    const amount = Number(form.total_amount)
    const nextErrors = {}
    if (!form.total_amount.trim() || Number.isNaN(amount)) {
      nextErrors.total_amount = 'Enter the order total.'
    } else if (amount <= 0) {
      nextErrors.total_amount = 'Total must be greater than zero.'
    } else if (amount < Number(order.paid)) {
      nextErrors.total_amount = `Total cannot be below the ${formatPeso(order.paid)} already paid.`
    }
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return

    void confirm({
      title: 'Save order changes?',
      message: `Update ${order.order_number} with the revised total and notes?`,
      confirmLabel: 'Save changes',
      variant: 'default',
      onConfirm: persist,
      errorMessage: 'Could not update the order. Please try again.',
    })
  }

  return (
    <Dialog
      open
      onOpenChange={handleClose}
    >
      <DialogContent
        title="Edit Order"
        description={`Update the order information for ${order.order_number} while preserving its history.`}
        size="lg"
        footer={
          <>
            <Button type="button" variant="outline" onClick={handleClose} disabled={saving}>
              Cancel
            </Button>
            <Button
              type="submit"
              form="edit-order-form"
              loading={saving}
              loadingText="Saving"
              disabled={!isOnline}
            >
              <Save className="size-4" aria-hidden="true" />
              Save Changes
            </Button>
          </>
        }
      >
        <form id="edit-order-form" onSubmit={handleSubmit} className="space-y-4" noValidate>
          {errors._general && <ErrorNote message={errors._general} />}

          <Textarea
            id="order_description"
            label="Items"
            rows={3}
            value={form.description}
            onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
            hint="One line per item, exactly as it should read on the receipt."
          />

          <Input
            id="order_total"
            label="Order total *"
            inputMode="decimal"
            leading="₱"
            value={form.total_amount}
            onChange={(event) => setForm((prev) => ({ ...prev, total_amount: event.target.value }))}
            error={errors.total_amount}
            hint={`${formatPeso(order.paid)} already paid`}
            required
          />
        </form>
      </DialogContent>
    </Dialog>
  )
}