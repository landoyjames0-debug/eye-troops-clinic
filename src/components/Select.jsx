import {
  Children,
  isValidElement,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react'
import { createPortal } from 'react-dom'
import { Check, ChevronDown, Search, X } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Normalizes options from both `options` prop and JSX `children` (<option> tags).
 */
function normalizeOptions(options, children) {
  if (Array.isArray(options)) {
    return options.map((opt) => {
      if (typeof opt === 'string' || typeof opt === 'number') {
        return { value: String(opt), label: String(opt), disabled: false }
      }
      return {
        value: String(opt.value ?? ''),
        label: String(opt.label ?? opt.value ?? ''),
        icon: opt.icon ?? null,
        disabled: Boolean(opt.disabled),
      }
    })
  }

  if (children) {
    const list = []
    Children.forEach(children, (child) => {
      if (isValidElement(child) && child.type === 'option') {
        list.push({
          value: String(child.props.value ?? child.props.children ?? ''),
          label: String(child.props.children ?? child.props.value ?? ''),
          disabled: Boolean(child.props.disabled),
        })
      }
    })
    return list
  }

  return []
}

export function Select({
  value = '',
  onChange,
  options,
  children,
  placeholder = 'Select an option',
  id: explicitId,
  name,
  disabled = false,
  error = false,
  required = false,
  label,
  hint,
  searchable,
  className,
  containerClassName,
  'aria-describedby': ariaDescribedBy,
  ...props
}) {
  const generatedId = useId()
  const id = explicitId || generatedId
  const listboxId = `${id}-listbox`
  const labelId = `${id}-label`
  const errorId = `${id}-error`
  const hintId = `${id}-hint`

  const triggerRef = useRef(null)
  const listboxRef = useRef(null)
  const searchInputRef = useRef(null)
  const searchTimeoutRef = useRef(null)
  const searchBufferRef = useRef('')

  const [isOpen, setIsOpen] = useState(false)
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0, width: 0, placement: 'bottom' })
  const [isMobile, setIsMobile] = useState(false)
  const [highlightedIndex, setHighlightedIndex] = useState(-1)
  const [query, setQuery] = useState('')

  const normalizedOptions = useMemo(
    () => normalizeOptions(options, children),
    [options, children],
  )

  const selectedOption = useMemo(
    () => normalizedOptions.find((opt) => String(opt.value) === String(value)) ?? null,
    [normalizedOptions, value],
  )

  const filteredOptions = useMemo(() => {
    if (!query.trim()) return normalizedOptions
    const clean = query.trim().toLowerCase()
    return normalizedOptions.filter((opt) => opt.label.toLowerCase().includes(clean))
  }, [normalizedOptions, query])

  // Detect mobile screen width (< 640px)
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 640)
    checkMobile()
    window.addEventListener('resize', checkMobile, { passive: true })
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  // Position the floating popover on desktop
  const updatePosition = useCallback(() => {
    if (!triggerRef.current || isMobile) return
    const rect = triggerRef.current.getBoundingClientRect()
    const spaceBelow = window.innerHeight - rect.bottom
    const spaceAbove = rect.top
    const popoverHeight = 240
    const placement = spaceBelow < popoverHeight && spaceAbove > spaceBelow ? 'top' : 'bottom'
    const width = Math.min(Math.max(rect.width, 160), window.innerWidth - 16)
    const maxLeft = Math.max(8, window.innerWidth - width - 8)
    const left = Math.min(Math.max(8, rect.left), maxLeft)

    setDropdownPos({
      top: placement === 'bottom' ? rect.bottom + 4 : rect.top - 4,
      left,
      width,
      placement,
    })
  }, [isMobile])

  const openDropdown = useCallback(() => {
    if (disabled) return
    updatePosition()
    setIsOpen(true)
    setQuery('')
    const initialIndex = normalizedOptions.findIndex((opt) => String(opt.value) === String(value))
    setHighlightedIndex(initialIndex >= 0 ? initialIndex : 0)
  }, [disabled, updatePosition, normalizedOptions, value])

  const closeDropdown = useCallback(() => {
    setIsOpen(false)
    setQuery('')
    setHighlightedIndex(-1)
  }, [])

  const triggerChange = useCallback(
    (nextValue) => {
      if (!onChange) return
      const syntheticEvent = {
        target: { value: nextValue, id, name },
        currentTarget: { value: nextValue, id, name },
        value: nextValue,
      }
      onChange(syntheticEvent, nextValue)
    },
    [onChange, id, name],
  )

  const selectOption = useCallback(
    (option) => {
      if (!option || option.disabled) return
      triggerChange(option.value)
      closeDropdown()
      triggerRef.current?.focus()
    },
    [triggerChange, closeDropdown],
  )

  // Scroll highlighted item into view
  useEffect(() => {
    if (!isOpen || highlightedIndex < 0 || !listboxRef.current) return
    const item = listboxRef.current.querySelector(`[data-index="${highlightedIndex}"]`)
    if (item) {
      item.scrollIntoView({ block: 'nearest' })
    }
  }, [isOpen, highlightedIndex])

  // Recalculate position on scroll/resize when open
  useEffect(() => {
    if (!isOpen || isMobile) return
    updatePosition()
    const handleScrollOrResize = () => updatePosition()
    window.addEventListener('resize', handleScrollOrResize, { passive: true })
    window.addEventListener('scroll', handleScrollOrResize, { passive: true, capture: true })
    return () => {
      window.removeEventListener('resize', handleScrollOrResize)
      window.removeEventListener('scroll', handleScrollOrResize, { capture: true })
    }
  }, [isOpen, isMobile, updatePosition])

  // Close on outside pointer interaction
  useEffect(() => {
    if (!isOpen) return
    const handlePointerDown = (event) => {
      if (
        triggerRef.current?.contains(event.target) ||
        listboxRef.current?.contains(event.target)
      ) {
        return
      }
      closeDropdown()
    }
    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [isOpen, closeDropdown])

  // Keyboard navigation on trigger button
  const handleTriggerKeyDown = (event) => {
    if (disabled) return

    if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(event.key)) {
      event.preventDefault()
      if (!isOpen) {
        openDropdown()
      } else if (event.key === 'Enter' || event.key === ' ') {
        if (highlightedIndex >= 0 && filteredOptions[highlightedIndex]) {
          selectOption(filteredOptions[highlightedIndex])
        }
      }
      return
    }

    if (isOpen) {
      if (event.key === 'Escape') {
        event.preventDefault()
        closeDropdown()
        return
      }

      if (event.key === 'Tab') {
        closeDropdown()
        return
      }

      if (event.key === 'ArrowDown') {
        event.preventDefault()
        setHighlightedIndex((prev) => {
          let next = prev + 1
          while (next < filteredOptions.length && filteredOptions[next].disabled) next++
          return next < filteredOptions.length ? next : prev
        })
        return
      }

      if (event.key === 'ArrowUp') {
        event.preventDefault()
        setHighlightedIndex((prev) => {
          let next = prev - 1
          while (next >= 0 && filteredOptions[next].disabled) next--
          return next >= 0 ? next : prev
        })
        return
      }

      if (event.key === 'Home') {
        event.preventDefault()
        const first = filteredOptions.findIndex((opt) => !opt.disabled)
        if (first >= 0) setHighlightedIndex(first)
        return
      }

      if (event.key === 'End') {
        event.preventDefault()
        for (let i = filteredOptions.length - 1; i >= 0; i--) {
          if (!filteredOptions[i].disabled) {
            setHighlightedIndex(i)
            break
          }
        }
        return
      }
    }

    // Type-ahead matching
    if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
      window.clearTimeout(searchTimeoutRef.current)
      searchBufferRef.current += event.key.toLowerCase()
      searchTimeoutRef.current = window.setTimeout(() => {
        searchBufferRef.current = ''
      }, 500)

      const matchIndex = filteredOptions.findIndex(
        (opt) =>
          !opt.disabled &&
          opt.label.toLowerCase().startsWith(searchBufferRef.current),
      )
      if (matchIndex >= 0) {
        if (!isOpen) {
          selectOption(filteredOptions[matchIndex])
        } else {
          setHighlightedIndex(matchIndex)
        }
      }
    }
  }

  const isSearchEnabled = searchable ?? normalizedOptions.length > 8

  return (
    <div className={cn('relative min-w-0', containerClassName)}>
      {label && (
        <label
          id={labelId}
          htmlFor={id}
          className="mb-1.5 block text-[13px] font-medium text-espresso"
        >
          {label} {required && <span className="text-error" aria-hidden="true">*</span>}
        </label>
      )}

      {/* Trigger Button */}
      <button
        ref={triggerRef}
        type="button"
        id={id}
        name={name}
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={listboxId}
        aria-labelledby={label ? labelId : undefined}
        aria-invalid={Boolean(error) || undefined}
        aria-describedby={
          [error ? errorId : null, hint ? hintId : null, ariaDescribedBy]
            .filter(Boolean)
            .join(' ') || undefined
        }
        disabled={disabled}
        onClick={isOpen ? closeDropdown : openDropdown}
        onKeyDown={handleTriggerKeyDown}
        className={cn(
          'group flex h-11 w-full items-center justify-between rounded-control border bg-surface px-3.5 text-left text-sm text-espresso transition-all duration-150',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-1 focus-visible:ring-offset-surface',
          'disabled:cursor-not-allowed disabled:bg-ivory disabled:text-warmgray/60 disabled:border-champagne/80',
          error
            ? 'border-error text-error focus-visible:ring-error'
            : 'border-champagne hover:border-gold/60',
          className,
        )}
        {...props}
      >
        <span className="flex min-w-0 items-center gap-2 truncate">
          {selectedOption?.icon && (
            <span className="shrink-0 text-warmgray">{selectedOption.icon}</span>
          )}
          {selectedOption ? (
            <span className="truncate text-espresso">{selectedOption.label}</span>
          ) : (
            <span className="truncate text-warmgray/60">{placeholder}</span>
          )}
        </span>
        <ChevronDown
          className={cn(
            'size-4 shrink-0 text-warmgray transition-transform duration-200 motion-reduce:transition-none',
            isOpen && 'rotate-180 text-gold-dark',
          )}
          aria-hidden="true"
        />
      </button>

      {/* Floating Popover / Mobile Bottom Sheet */}
      {isOpen &&
        createPortal(
          isMobile ? (
            /* Mobile Bottom Sheet (< 640px) */
            <div className="fixed inset-0 z-150 flex flex-col justify-end">
              <div
                className="fixed inset-0 bg-espresso/40 backdrop-blur-xs transition-opacity duration-200"
                onClick={closeDropdown}
                aria-hidden="true"
              />
              <div
                ref={listboxRef}
                id={listboxId}
                role="listbox"
                aria-label={label ?? placeholder}
                className="relative z-160 max-h-[75vh] w-full rounded-t-2xl border-t border-champagne bg-surface p-4 shadow-pop transition-transform duration-200 flex flex-col motion-reduce:transition-none"
              >
                {/* Pull handle */}
                <div className="mx-auto mb-2 h-1.5 w-12 rounded-full bg-champagne" aria-hidden="true" />
                <div className="mb-3 flex items-center justify-between border-b border-champagne/60 pb-2">
                  <h3 className="text-sm font-semibold text-espresso">{label ?? placeholder}</h3>
                  <button
                    type="button"
                    onClick={closeDropdown}
                    className="flex size-8 items-center justify-center rounded-control text-warmgray hover:bg-ivory hover:text-espresso"
                    aria-label="Close options"
                  >
                    <X className="size-4" aria-hidden="true" />
                  </button>
                </div>

                {isSearchEnabled && (
                  <div className="relative mb-3">
                    <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-warmgray" aria-hidden="true" />
                    <input
                      ref={searchInputRef}
                      type="text"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Search..."
                      className="h-10 w-full rounded-control border border-champagne bg-ivory/50 pl-9 pr-3 text-sm text-espresso focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold"
                    />
                  </div>
                )}

                <div className="divide-y divide-champagne/40 overflow-y-auto max-h-[50vh] scrollbar-none">
                  {filteredOptions.length === 0 ? (
                    <div className="p-4 text-center text-sm text-warmgray">No options found</div>
                  ) : (
                    filteredOptions.map((opt, index) => {
                      const isSelected = String(opt.value) === String(value)
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          role="option"
                          data-index={index}
                          aria-selected={isSelected}
                          disabled={opt.disabled}
                          onClick={() => selectOption(opt)}
                          className={cn(
                            'flex min-h-12 w-full items-center justify-between px-3 py-3 text-left text-[15px] transition-colors',
                            isSelected ? 'font-semibold text-gold-dark bg-gold-light/40' : 'text-espresso active:bg-ivory',
                            opt.disabled && 'cursor-not-allowed opacity-40',
                          )}
                        >
                          <span className="flex items-center gap-2.5 truncate">
                            {opt.icon && <span className="shrink-0">{opt.icon}</span>}
                            <span className="truncate">{opt.label}</span>
                          </span>
                          {isSelected && <Check className="size-4.5 shrink-0 text-gold-dark" aria-hidden="true" />}
                        </button>
                      )
                    })
                  )}
                </div>
              </div>
            </div>
          ) : (
            /* Desktop Popover (>= 640px) */
            <div
              ref={listboxRef}
              id={listboxId}
              role="listbox"
              aria-label={label ?? placeholder}
              style={{
                position: 'fixed',
                top: dropdownPos.placement === 'bottom' ? dropdownPos.top : undefined,
                bottom: dropdownPos.placement === 'top' ? window.innerHeight - dropdownPos.top : undefined,
                left: dropdownPos.left,
                width: dropdownPos.width,
              }}
              className="z-150 max-h-60 overflow-hidden rounded-lg border border-champagne bg-surface p-1 shadow-pop flex flex-col text-sm animate-in fade-in-50 zoom-in-95 duration-100 motion-reduce:animate-none"
            >
              {isSearchEnabled && (
                <div className="relative p-1.5 border-b border-champagne/60">
                  <Search className="pointer-events-none absolute left-3.5 top-1/2 size-3.5 -translate-y-1/2 text-warmgray" aria-hidden="true" />
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search..."
                    className="h-8 w-full rounded-md border border-champagne bg-ivory/50 pl-8 pr-2.5 text-xs text-espresso focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold"
                  />
                </div>
              )}

              <div className="overflow-y-auto py-1 scrollbar-none">
                {filteredOptions.length === 0 ? (
                  <div className="p-3 text-center text-xs text-warmgray">No options found</div>
                ) : (
                  filteredOptions.map((opt, index) => {
                    const isSelected = String(opt.value) === String(value)
                    const isHighlighted = highlightedIndex === index

                    return (
                      <div
                        key={opt.value}
                        role="option"
                        data-index={index}
                        aria-selected={isSelected}
                        aria-disabled={opt.disabled || undefined}
                        onClick={() => selectOption(opt)}
                        onMouseEnter={() => !opt.disabled && setHighlightedIndex(index)}
                        className={cn(
                          'relative flex min-h-10 cursor-pointer select-none items-center justify-between rounded-md px-3 py-2 text-sm transition-colors motion-reduce:transition-none',
                          isSelected ? 'font-semibold text-gold-dark' : 'text-espresso',
                          isHighlighted ? 'bg-gold-light' : 'hover:bg-ivory',
                          opt.disabled && 'cursor-not-allowed opacity-40 hover:bg-transparent',
                        )}
                      >
                        <span className="flex min-w-0 items-center gap-2 truncate">
                          {opt.icon && <span className="shrink-0 text-warmgray">{opt.icon}</span>}
                          <span className="truncate">{opt.label}</span>
                        </span>
                        {isSelected && (
                          <Check className="size-4 shrink-0 text-gold-dark" aria-hidden="true" />
                        )}
                      </div>
                    )
                  })
                )}
              </div>
            </div>
          ),
          document.body,
        )}

      {/* Field Error & Hint */}
      {error && typeof error === 'string' && (
        <p id={errorId} className="mt-1.5 text-xs text-error" role="alert">
          {error}
        </p>
      )}
      {hint && (
        <p id={hintId} className="mt-1 text-xs text-warmgray">
          {hint}
        </p>
      )}
    </div>
  )
}

export default Select
