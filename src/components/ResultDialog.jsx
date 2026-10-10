import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown, X } from 'lucide-react'
import './ResultDialog.css'

const CLOSE_KEYS = ['Escape']

export default function ResultDialog({
  open,
  type = 'success',
  title,
  message,
  details,
  primaryLabel,
  secondaryLabel,
  onPrimary,
  onClose,
  autoCloseMs,
}) {
  const backdropRef = useRef(null)
  const dialogRef = useRef(null)
  const primaryRef = useRef(null)
  const previousFocusRef = useRef(null)
  const autoCloseRef = useRef(null)
  const remainingRef = useRef(autoCloseMs)
  const startedAtRef = useRef(0)
  const [paused, setPaused] = useState(false)

  useEffect(() => {
    if (!open) return undefined

    previousFocusRef.current = document.activeElement
    primaryRef.current?.focus()
    const previousOverflow = document.body.style.overflow
    const previousHtmlOverflow = document.documentElement.style.overflow
    document.body.style.overflow = 'hidden'
    document.documentElement.style.overflow = 'hidden'

    const handleKeyDown = (event) => {
      if (CLOSE_KEYS.includes(event.key)) {
        event.preventDefault()
        onClose?.()
        return
      }

      if (event.key === 'Enter' && !event.target.closest('button, summary, a')) {
        event.preventDefault()
        onPrimary?.()
        return
      }

      if (event.key === 'Tab' && dialogRef.current) {
        const focusable = dialogRef.current.querySelectorAll(
          'button:not([disabled]), summary, a[href], [tabindex]:not([tabindex="-1"])',
        )
        const first = focusable[0]
        const last = focusable[focusable.length - 1]
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault()
          last?.focus()
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault()
          first?.focus()
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      document.documentElement.style.overflow = previousHtmlOverflow
      document.removeEventListener('keydown', handleKeyDown)
      previousFocusRef.current?.focus?.()
    }
  }, [onClose, onPrimary, open])

  useEffect(() => {
    if (!open || type !== 'success' || !autoCloseMs || paused) return undefined

    startedAtRef.current = Date.now()
    autoCloseRef.current = window.setTimeout(() => onClose?.(), remainingRef.current)
    return () => {
      window.clearTimeout(autoCloseRef.current)
      remainingRef.current = Math.max(
        0,
        remainingRef.current - (Date.now() - startedAtRef.current),
      )
    }
  }, [autoCloseMs, onClose, open, paused, type])

  if (!open) return null

  const isSuccess = type === 'success'
  const titleId = 'result-dialog-title'
  const messageId = 'result-dialog-message'

  return createPortal(
    <div
      ref={backdropRef}
      className="result-dialog-backdrop"
      onMouseDown={(event) => {
        if (event.target === backdropRef.current) onClose?.()
      }}
    >
      <section
        ref={dialogRef}
        role={isSuccess ? 'dialog' : 'alertdialog'}
        aria-live={isSuccess ? 'polite' : 'assertive'}
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={messageId}
        className={`result-dialog result-dialog--${type}`}
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        onFocus={() => setPaused(true)}
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) setPaused(false)
        }}
      >
        <div className={`result-dialog__icon result-dialog__icon--${type}`} aria-hidden="true">
          {isSuccess ? (
            <svg className="result-dialog__check" viewBox="0 0 48 48" fill="none">
              <path d="m13 24 7 7 15-16" />
            </svg>
          ) : (
            <X className="size-8" strokeWidth={2.5} />
          )}
        </div>

        <h2 id={titleId} className="result-dialog__title">{title}</h2>
        <p id={messageId} className="result-dialog__message">{message}</p>

        {details && (
          <details className="result-dialog__details">
            <summary>
              <span>Show details</span>
              <ChevronDown className="size-4" aria-hidden="true" />
            </summary>
            <pre>{details}</pre>
          </details>
        )}

        <div className="result-dialog__actions">
          <button
            ref={primaryRef}
            type="button"
            className="result-dialog__primary"
            onClick={onPrimary}
          >
            {primaryLabel ?? (isSuccess ? 'Continue' : 'Try again')}
          </button>
          {secondaryLabel && (
            <button type="button" className="result-dialog__secondary" onClick={onClose}>
              {secondaryLabel}
            </button>
          )}
        </div>

        {isSuccess && autoCloseMs > 0 && (
          <div className="result-dialog__progress" aria-hidden="true">
            <span
              style={{ animationDuration: `${autoCloseMs}ms`, animationPlayState: paused ? 'paused' : 'running' }}
            />
          </div>
        )}
      </section>
    </div>,
    document.body,
  )
}