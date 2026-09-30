import { useState, useMemo } from 'react'
import { toast } from 'sonner'
import { Save } from 'lucide-react'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input, Textarea } from '@/components/ui/input'
import { ErrorNote } from '@/components/ui/feedback'
import { updateOrder } from '@/services/orders.service'
import { formatPeso } from '@/utils/format'
import { AppError } from '@/utils/errors'

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
  const [initialForm] = useState(() => blankForm(order))
  const [form, setForm] = useState(() => blankForm(order))
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)

  const hasUnsavedChanges = useMemo(
    () => !formEquals(form, initialForm),
    [form, initialForm]
  )

  if (!order) return null

  const handleClose = () => {
    if (saving) return
    if (hasUnsavedChanges) {
      return
    }
    onClose()
  }

  const handleSubmit = async (event) => {
    event.preventDefault()

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

    setSaving(true)
    try {
      await updateOrder(order.id, { description: form.description, total_amount: amount })
      toast.success('Order updated', { description: order.order_number })
      onSaved()
      onClose()
    } catch (caught) {
      toast.error('Could not update the order', {
        description: caught instanceof AppError ? caught.message : 'Please try again.',
      })
    } finally {
      setSaving(false)
    }
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