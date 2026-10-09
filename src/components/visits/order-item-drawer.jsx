import { useEffect, useState } from 'react'
import { Eye, Glasses, Minus, Plus, Wrench } from 'lucide-react'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input, Label } from '@/components/ui/input'
import { ChoiceGroup } from '@/components/ui/choice-group'
import { useConfirm } from '@/hooks/use-confirm'
import { ORDER_ITEM_TYPES, LENS_TYPE_OPTIONS, LENS_COATING_OPTIONS } from '@/lib/constants'
import { formatPeso } from '@/utils/format'
import { cn } from '@/lib/utils'

const CATEGORY_META = {
  Glasses: { icon: Glasses, placeholder: 'e.g. Ray-Ban RB2140' },
  'Contact Lens': { icon: Eye, placeholder: 'e.g. Acuvue Oasys' },
  Services: { icon: Wrench, placeholder: 'e.g. Frame adjustment' },
}

function newDraft() {
  return {
    type: 'Glasses',
    name: '',
    lensType: 'Single Vision',
    lensOption: 'Not applicable',
    quantity: '1',
    unitPrice: '',
  }
}

function toDraft(item) {
  if (!item) return newDraft()
  return {
    type: item.type ?? 'Glasses',
    name: item.name ?? '',
    lensType: item.lensType ?? 'Single Vision',
    lensOption: item.lensOption ?? 'Not applicable',
    quantity: String(item.quantity ?? '1'),
    unitPrice: item.unitPrice ?? '',
  }
}

function draftTotal(draft) {
  const quantity = Math.max(parseInt(draft.quantity, 10) || 0, 0)
  const price = Number(draft.unitPrice) || 0
  return quantity * price
}

/**
 * Right-hand drawer for adding or editing one order line item. The draft is
 * local, so Cancel (or Escape) never touches the visit form until the item is
 * saved; unsaved edits are confirmed before discarding.
 */
export function OrderItemDrawer({ open, item, onClose, onSave }) {
  const confirm = useConfirm()
  const isEdit = Boolean(item)
  const [draft, setDraft] = useState(() => toDraft(item))
  const [errors, setErrors] = useState({})

  useEffect(() => {
    if (open) {
      setDraft(toDraft(item))
      setErrors({})
    }
  }, [open, item])

  const patch = (changes) => setDraft((prev) => ({ ...prev, ...changes }))
  const isGlasses = draft.type === 'Glasses'
  const subtotal = draftTotal(draft)
  const dirty = open && JSON.stringify(draft) !== JSON.stringify(toDraft(item))

  const requestClose = () => {
    if (!dirty) {
      onClose()
      return
    }
    void confirm({
      title: isEdit ? 'Discard changes?' : 'Discard this item?',
      message: 'Your changes to this order item will be lost.',
      confirmLabel: 'Discard',
      cancelLabel: 'Keep editing',
      onConfirm: onClose,
      errorMessage: 'Could not close the item form. Please try again.',
    })
  }

  const handleSave = () => {
    const nextErrors = {}
    const quantity = parseInt(draft.quantity, 10)
    const price = Number(draft.unitPrice)

    if (!Number.isFinite(quantity) || quantity < 1) {
      nextErrors.quantity = 'Quantity must be at least 1.'
    }
    if (draft.unitPrice === '' || Number.isNaN(price)) {
      nextErrors.unitPrice = 'Enter a unit price.'
    } else if (price < 0) {
      nextErrors.unitPrice = 'Price cannot be negative.'
    }

    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return

    onSave({
      type: draft.type,
      name: draft.name.trim(),
      lensType: isGlasses ? draft.lensType : 'Not applicable',
      lensOption: isGlasses ? draft.lensOption : 'Not applicable',
      quantity: String(quantity),
      unitPrice: String(price),
    })
  }

  const changeQuantity = (delta) => {
    const next = Math.max(parseInt(draft.quantity, 10) || 1, 1) + delta
    patch({ quantity: String(Math.max(next, 1)) })
  }

  const placeholder = CATEGORY_META[draft.type]?.placeholder ?? 'Item description'

  return (
    <Sheet open={open} onOpenChange={(next) => { if (!next) requestClose() }}>
      <SheetContent
        title={isEdit ? 'Edit order item' : 'Add order item'}
        description="Choose what the patient is getting, then set the price."
        className="max-w-130"
        footer={
          <>
            <Button type="button" variant="outline" onClick={requestClose}>
              Cancel
            </Button>
            <Button type="button" onClick={handleSave}>
              {isEdit ? 'Save changes' : 'Add item'}
            </Button>
          </>
        }
      >
        <div className="space-y-6">
          <section>
            <p className="text-[11px] font-semibold tracking-wider text-warmgray uppercase">
              Category
            </p>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {ORDER_ITEM_TYPES.map((type) => {
                const meta = CATEGORY_META[type]
                const Icon = meta?.icon ?? Glasses
                const selected = draft.type === type
                return (
                  <button
                    key={type}
                    type="button"
                    aria-pressed={selected}
                    onClick={() =>
                      patch(
                        type === 'Glasses'
                          ? { type }
                          : { type, lensType: 'Not applicable', lensOption: 'Not applicable' },
                      )
                    }
                    className={cn(
                      'flex flex-col items-center gap-1.5 rounded-control border px-2 py-3 text-[12px] font-medium transition-colors',
                      'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold',
                      selected
                        ? 'border-gold bg-gold-light/70 text-espresso ring-1 ring-gold/25'
                        : 'border-champagne bg-surface text-warmgray hover:border-gold/45 hover:text-espresso',
                    )}
                  >
                    <Icon
                      className={cn('size-4', selected ? 'text-gold-dark' : 'text-warmgray')}
                      strokeWidth={1.8}
                      aria-hidden="true"
                    />
                    <span className="text-center leading-tight">{type}</span>
                  </button>
                )
              })}
            </div>
          </section>

          {isGlasses && (
            <section className="space-y-5">
              <ChoiceGroup
                id="drawer-lens-type"
                label="Lens type"
                layout="grid-2"
                value={draft.lensType}
                options={LENS_TYPE_OPTIONS}
                onChange={(value) => patch({ lensType: value })}
              />
              <ChoiceGroup
                id="drawer-lens-option"
                label="Lens options"
                layout="grid-2"
                value={draft.lensOption}
                options={LENS_COATING_OPTIONS}
                onChange={(value) => patch({ lensOption: value })}
              />
            </section>
          )}

          <section className="space-y-4">
            <p className="text-[11px] font-semibold tracking-wider text-warmgray uppercase">
              Details &amp; pricing
            </p>

            <Input
              id="drawer-item-name"
              label="Item description"
              placeholder={placeholder}
              value={draft.name}
              onChange={(event) => patch({ name: event.target.value })}
              hint="Optional — shown on the order record."
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="drawer-qty">Quantity</Label>
                <div className="flex h-11 overflow-hidden rounded-control border border-champagne bg-surface">
                  <button
                    type="button"
                    disabled={(parseInt(draft.quantity, 10) || 1) <= 1}
                    onClick={() => changeQuantity(-1)}
                    aria-label="Decrease quantity"
                    className="flex w-10 shrink-0 items-center justify-center text-warmgray transition-colors hover:bg-gold-light/60 hover:text-espresso focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-gold disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    <Minus className="size-4" aria-hidden="true" />
                  </button>
                  <input
                    id="drawer-qty"
                    type="number"
                    min="1"
                    step="1"
                    inputMode="numeric"
                    value={draft.quantity}
                    onChange={(event) => patch({ quantity: event.target.value })}
                    className="h-full w-full min-w-0 border-x border-champagne bg-transparent text-center text-sm text-espresso focus:border-gold focus:ring-2 focus:ring-gold/20 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => changeQuantity(1)}
                    aria-label="Increase quantity"
                    className="flex w-10 shrink-0 items-center justify-center text-warmgray transition-colors hover:bg-gold-light/60 hover:text-espresso focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-gold"
                  >
                    <Plus className="size-4" aria-hidden="true" />
                  </button>
                </div>
                {errors.quantity && (
                  <p className="mt-1.5 text-xs text-error" role="alert">
                    {errors.quantity}
                  </p>
                )}
              </div>

              <Input
                id="drawer-price"
                label="Unit price"
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                placeholder="0.00"
                leading="₱"
                value={draft.unitPrice}
                onChange={(event) => patch({ unitPrice: event.target.value })}
                error={errors.unitPrice}
              />
            </div>

            <div className="flex items-center justify-between rounded-control border border-champagne bg-ivory/50 px-4 py-3">
              <span className="text-[13px] text-warmgray">Subtotal</span>
              <span className="tabular text-[15px] font-semibold text-espresso">
                {formatPeso(subtotal)}
              </span>
            </div>
          </section>
        </div>
      </SheetContent>
    </Sheet>
  )
}
