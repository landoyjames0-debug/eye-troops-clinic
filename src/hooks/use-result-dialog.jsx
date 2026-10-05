/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react'
import ResultDialog from '@/components/ResultDialog'

const ResultDialogContext = createContext(null)

export function ResultDialogProvider({ children }) {
  const activeRef = useRef(null)
  const queueRef = useRef([])
  const [active, setActive] = useState(null)

  const showNext = useCallback(() => {
    if (activeRef.current) return
    const next = queueRef.current.shift() ?? null
    activeRef.current = next
    setActive(next)
  }, [])

  const enqueue = useCallback((options) => {
    const item = {
      id: `${Date.now()}-${Math.random()}`,
      type: options.type,
      title: options.title,
      message: options.message,
      details: options.details,
      primaryLabel: options.primaryLabel ?? (options.type === 'success' ? 'Continue' : options.retryLabel ?? 'Try again'),
      secondaryLabel: options.secondaryLabel ?? (options.type === 'error' ? 'Close' : undefined),
      autoCloseMs: options.autoCloseMs,
      onPrimaryAction: options.type === 'error' ? options.onRetry : options.onPrimary,
    }

    if (activeRef.current) queueRef.current.push(item)
    else {
      activeRef.current = item
      setActive(item)
    }
  }, [])

  const close = useCallback(() => {
    if (!activeRef.current) return
    activeRef.current = null
    setActive(null)
    window.setTimeout(showNext, 0)
  }, [showNext])

  const primary = useCallback(() => {
    const action = activeRef.current?.onPrimaryAction
    close()
    if (typeof action === 'function') {
      window.setTimeout(() => {
        Promise.resolve(action()).catch((caught) => {
          enqueue({
            type: 'error',
            title: 'Action failed',
            message: 'The action could not be completed. Please try again.',
            details: caught?.message,
          })
        })
      }, 0)
    }
  }, [close, enqueue])

  const api = useMemo(() => ({
    success: (options) => enqueue({ ...options, type: 'success' }),
    error: (options) => enqueue({ ...options, type: 'error' }),
  }), [enqueue])

  return (
    <ResultDialogContext.Provider value={api}>
      {children}
      <ResultDialog
        key={active?.id}
        open={Boolean(active)}
        type={active?.type}
        title={active?.title}
        message={active?.message}
        details={active?.details}
        primaryLabel={active?.primaryLabel}
        secondaryLabel={active?.secondaryLabel}
        autoCloseMs={active?.autoCloseMs}
        onPrimary={primary}
        onClose={close}
      />
    </ResultDialogContext.Provider>
  )
}

export function useResultDialog() {
  const context = useContext(ResultDialogContext)
  if (!context) throw new Error('useResultDialog must be used inside <ResultDialogProvider>.')
  return context
}