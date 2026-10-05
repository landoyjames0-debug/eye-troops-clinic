/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react'
import { ConfirmDialog } from '@/components/ConfirmDialog'

const ConfirmContext = createContext(null)

export function ConfirmProvider({ children }) {
  const triggerRef = useRef(null)
  const [dialog, setDialog] = useState({
    open: false,
    title: 'Confirm',
    message: 'Are you sure?',
    confirmLabel: 'Confirm',
    cancelLabel: 'Cancel',
    variant: 'default',
    loading: false,
    error: '',
    onConfirm: null,
    onCancel: null,
  })

  const confirm = useCallback(
    (options = {}) =>
      new Promise((resolve) => {
        const {
          title = 'Confirm',
          message = 'Are you sure?',
          confirmLabel = 'Confirm',
          cancelLabel = 'Cancel',
          variant = 'default',
          onConfirm,
          onCancel,
          errorMessage = 'Something went wrong, please try again.',
        } = options

        triggerRef.current = document.activeElement

        const closeDialog = () => {
          setDialog((prev) => ({ ...prev, open: false, loading: false, error: '' }))
          triggerRef.current?.focus?.()
        }

        const handleConfirm = async () => {
          if (dialog.loading) return

          setDialog((prev) => ({ ...prev, loading: true, error: '' }))

          try {
            if (typeof onConfirm === 'function') {
              await onConfirm()
            }

            closeDialog()
            resolve(true)
          } catch (caught) {
            const nextError = caught?.message || errorMessage
            setDialog((prev) => ({
              ...prev,
              loading: false,
              error: nextError,
              open: true,
            }))
            resolve(false)
          }
        }

        const handleCancel = () => {
          closeDialog()
          if (typeof onCancel === 'function') {
            onCancel()
          }
          resolve(false)
        }

        setDialog({
          open: true,
          title,
          message,
          confirmLabel,
          cancelLabel,
          variant,
          loading: false,
          error: '',
          onConfirm: handleConfirm,
          onCancel: handleCancel,
        })
      }),
    [dialog.loading],
  )

  const value = useMemo(() => confirm, [confirm])

  return (
    <ConfirmContext.Provider value={value}>
      {children}
      <ConfirmDialog
        open={dialog.open}
        title={dialog.title}
        message={dialog.message}
        confirmLabel={dialog.confirmLabel}
        cancelLabel={dialog.cancelLabel}
        variant={dialog.variant}
        loading={dialog.loading}
        error={dialog.error}
        onConfirm={dialog.onConfirm}
        onCancel={dialog.onCancel}
      />
    </ConfirmContext.Provider>
  )
}

export function useConfirm() {
  const context = useContext(ConfirmContext)
  if (!context) {
    throw new Error('useConfirm must be used inside <ConfirmProvider>.')
  }
  return context
}
