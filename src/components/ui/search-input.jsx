import { memo, useEffect, useRef, useState } from 'react'
import { Loader2, Search, X } from 'lucide-react'
import { cn } from '@/lib/utils'

export const SearchInput = memo(function SearchInput({
  value,
  onChange,
  loading = false,
  disabled = false,
  placeholder = 'Search',
  ariaLabel = 'Search',
  className,
}) {
  const inputRef = useRef(null)
  const [showSpinner, setShowSpinner] = useState(false)

  useEffect(() => {
    if (!loading) {
      setShowSpinner(false)
      return undefined
    }

    const timeoutId = window.setTimeout(() => setShowSpinner(true), 200)
    return () => window.clearTimeout(timeoutId)
  }, [loading])

  const clearSearch = () => {
    onChange('')
    inputRef.current?.focus()
  }

  return (
    <div className={cn('relative w-full sm:max-w-sm', className)}>
      {showSpinner ? (
        <Loader2
          className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 animate-spin text-gold-dark motion-reduce:animate-none"
          aria-hidden="true"
        />
      ) : (
        <Search
          className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-warmgray"
          aria-hidden="true"
        />
      )}
      <input
        ref={inputRef}
        type="text"
        inputMode="search"
        role="searchbox"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.preventDefault()
            clearSearch()
          }
        }}
        placeholder={placeholder}
        aria-label={ariaLabel}
        aria-busy={loading || undefined}
        disabled={disabled}
        autoComplete="off"
        className="h-10 w-full rounded-control border border-champagne bg-ivory/60 pr-10 pl-10 text-sm text-espresso caret-gold-dark transition-colors placeholder:text-warmgray focus:border-gold-dark focus:bg-surface focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-dark focus-visible:ring-offset-2 focus-visible:ring-offset-surface disabled:cursor-not-allowed disabled:opacity-60"
      />
      {value.length > 0 && (
        <button
          type="button"
          onClick={clearSearch}
          disabled={disabled}
          className="absolute top-1/2 right-2.5 flex size-7 -translate-y-1/2 items-center justify-center rounded-md text-warmgray transition-colors hover:bg-champagne/60 hover:text-espresso focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-dark focus-visible:ring-offset-2 focus-visible:ring-offset-surface disabled:cursor-not-allowed disabled:opacity-60"
          aria-label="Clear search"
        >
          <X className="size-4" aria-hidden="true" />
        </button>
      )}
    </div>
  )
})