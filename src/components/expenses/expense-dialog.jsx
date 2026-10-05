import { useState, useMemo } from 'react'
import { Receipt } from 'lucide-react'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input, Select, Textarea } from '@/components/ui/input'
import { ErrorNote } from '@/components/ui/feedback'
import { useConfirm } from '@/hooks/use-confirm'
import { useResultDialog } from '@/hooks/use-result-dialog'
import { useSupabaseHealth } from '@/hooks/use-supabase-health'
import { createExpense, updateExpense } from '@/services/expenses.service'
import { EXPENSE_CATEGORIES } from '@/lib/constants'
import { AppError } from '@/utils/errors'
import { formatPeso } from '@/utils/format'

function blankForm(expense, defaultDate) {
  return {
    expense_date: expense?.expense_date ?? defaultDate,
    category: expense?.category ?? EXPENSE_CATEGORIES[0],
    amount: expense ? String(expense.amount) : '',
    description: expense?.description ?? '',
  }
}

function formEquals(a, b) {
  return (
    a.expense_date === b.expense_date &&
    a.category === b.category &&
    a.amount === b.amount &&
    a.description === b.description
  )
}

/**
 * One dialog for both "add" and "edit". Pass `expense` to edit an existing
 * entry; omit it to record a new one. The caller supplies a `key` per expense
 * so switching rows remounts the form with the right values.
 */
export function ExpenseDialog({ open, expense = null, defaultDate, onClose, onSaved }) {
  const isEdit = Boolean(expense)
  const confirm = useConfirm()
  const resultDialog = useResultDialog()
  const { isOnline } = useSupabaseHealth()
  const [initialForm] = useState(() => blankForm(expense, defaultDate))
  const [form, setForm] = useState(() => blankForm(expense, defaultDate))
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)

  const hasUnsavedChanges = useMemo(
    () => !formEquals(form, initialForm),
    [form, initialForm]
  )

  const persist = async () => {
    setSaving(true)
    try {
      const payload = {
        expense_date: form.expense_date,
        category: form.category,
        amount: Number(form.amount),
        description: form.description,
      }
      if (isEdit) {
        await updateExpense(expense.id, payload)
        resultDialog.success({
          title: 'Expense updated',
          message: `${form.category} expense was updated successfully.`,
        })
      } else {
        await createExpense(payload)
        resultDialog.success({
          title: 'Expense recorded',
          message: `${formatPeso(payload.amount)} ${form.category.toLowerCase()} expense was recorded successfully.`,
        })
      }
      onSaved()
      onClose()
    } catch (caught) {
      resultDialog.error({
        title: 'Could not save the expense',
        message: caught instanceof AppError ? caught.message : 'Please check your connection and try again.',
        details: caught?.cause?.message ?? caught?.message,
        retryLabel: 'Try again',
        onRetry: persist,
      })
    } finally {
      setSaving(false)
    }
  }

  const handleClose = () => {
    if (saving) return
    if (hasUnsavedChanges) {
      void confirm({
        title: 'Discard unsaved changes?',
        message: `Leave this ${isEdit ? 'expense edit' : 'new expense'} without saving your changes?`,
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

    const amount = Number(form.amount)
    const nextErrors = {}
    if (!form.expense_date) nextErrors.expense_date = 'Expense date is required.'
    if (!form.amount.trim() || Number.isNaN(amount)) {
      nextErrors.amount = 'Enter the amount.'
    } else if (amount <= 0) {
      nextErrors.amount = 'Amount must be greater than ₱0.00.'
    }
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return

    void confirm({
      title: isEdit ? 'Save expense changes?' : 'Record this expense?',
      message: isEdit
        ? `Update ${expense?.category ?? 'this expense'} for ${form.expense_date}?`
        : `Save this ${form.category} expense of ${formatPeso(amount)}?`,
      confirmLabel: isEdit ? 'Save changes' : 'Add expense',
      variant: 'default',
      onConfirm: persist,
      errorMessage: 'Could not save the expense. Please try again.',
    })
  }

  if (!open) return null

  return (
    <Dialog
      open
      onOpenChange={handleClose}
    >
      <DialogContent
        title={isEdit ? 'Edit Expense' : 'Add Expense'}
        description={
          isEdit
            ? 'Correct the date, category, amount, or description.'
            : 'Record a clinic expense for accurate financial tracking.'
        }
        size="md"
        footer={
          <>
            <Button type="button" variant="outline" onClick={handleClose} disabled={saving}>
              Cancel
            </Button>
            <Button
              type="submit"
              form="expense-form"
              loading={saving}
              loadingText="Saving"
              disabled={!isOnline}
            >
              <Receipt className="size-4" aria-hidden="true" />
              {isEdit ? 'Save Changes' : 'Add Expense'}
            </Button>
          </>
        }
      >
        <form id="expense-form" onSubmit={handleSubmit} className="space-y-4" noValidate>
          {errors._general && <ErrorNote message={errors._general} />}

          <Input
            id="expense_date"
            label="Date *"
            type="date"
            value={form.expense_date}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, expense_date: event.target.value }))
            }
            error={errors.expense_date}
            required
          />

          <Select
            id="category"
            label="Category *"
            value={form.category}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, category: event.target.value }))
            }
            required
          >
            {EXPENSE_CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </Select>

          <Input
            id="expense_amount"
            label="Amount *"
            type="number"
            min="0"
            step="0.01"
            inputMode="decimal"
            placeholder="0.00"
            leading="₱"
            value={form.amount}
            onChange={(event) => setForm((prev) => ({ ...prev, amount: event.target.value }))}
            error={errors.amount}
            required
          />

          <Textarea
            id="expense_description"
            label="Description"
            placeholder="Meralco — month to date"
            value={form.description}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, description: event.target.value }))
            }
          />
        </form>
      </DialogContent>
    </Dialog>
  )
}