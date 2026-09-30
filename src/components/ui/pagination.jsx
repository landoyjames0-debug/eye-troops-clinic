import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

/**
 * Page numbers to show: the first and last page, a window around the current
 * page, and a `'gap'` marker wherever the sequence jumps. Keeping the ends
 * visible means a long roster still shows where it begins and ends.
 */
function pageWindow(page, pageCount) {
  const wanted = new Set([1, pageCount, page, page - 1, page + 1])
  if (page <= 3) [1, 2, 3, 4].forEach((value) => wanted.add(value))
  if (page >= pageCount - 2) {
    ;[pageCount - 3, pageCount - 2, pageCount - 1, pageCount].forEach((value) => wanted.add(value))
  }

  const sorted = [...wanted].filter((value) => value >= 1 && value <= pageCount).sort((a, b) => a - b)
  const out = []
  let previous = 0
  for (const value of sorted) {
    if (value - previous > 1) out.push('gap')
    out.push(value)
    previous = value
  }
  return out
}

/**
 * Reusable pagination footer. Desktop shows the numeric page list, mobile
 * collapses it to a compact "3 / 12" indicator — business records are never
 * paginated with infinite scroll.
 */
export function Pagination({
  page,
  pageCount,
  total,
  pageSize,
  onPageChange,
  itemLabel = 'record',
  ariaLabel = 'pagination',
  className,
}) {
  if (!total) return null

  const from = (page - 1) * pageSize + 1
  const to = Math.min(page * pageSize, total)
  const plural = total === 1 ? itemLabel : `${itemLabel}s`

  return (
    <div
      className={cn(
        'flex flex-wrap items-center justify-between gap-3 border-t border-champagne px-5 py-3.5',
        className,
      )}
    >
      <p className="tabular text-[13px] text-warmgray">
        Showing <span className="font-medium text-espresso">{from}</span>–
        <span className="font-medium text-espresso">{to}</span> of{' '}
        <span className="font-medium text-espresso">{total}</span> {plural}
      </p>

      {pageCount > 1 && (
        <nav className="flex items-center gap-1.5" aria-label={ariaLabel}>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1}
            aria-label={`${ariaLabel}: previous page`}
          >
            <ChevronLeft className="size-4" aria-hidden="true" />
            <span className="hidden sm:inline">Previous</span>
          </Button>

          <span className="tabular px-2 text-[13px] text-warmgray sm:hidden">
            {page} / {pageCount}
          </span>

          <ul className="hidden items-center gap-1 sm:flex">
            {pageWindow(page, pageCount).map((entry, index) =>
              entry === 'gap' ? (
                <li key={`gap-${index}`} className="px-1 text-warmgray" aria-hidden="true">
                  …
                </li>
              ) : (
                <li key={entry}>
                  <button
                    type="button"
                    onClick={() => onPageChange(entry)}
                    aria-current={entry === page ? 'page' : undefined}
                    aria-label={`Page ${entry}`}
                    className={cn(
                      'tabular flex size-10 items-center justify-center rounded-[var(--radius-control)] border text-[13px] font-medium transition-colors',
                      'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold',
                      entry === page
                        ? 'border-gold bg-gold font-semibold text-white shadow-sm'
                        : 'border-champagne bg-white text-espresso hover:bg-gold-light/60',
                    )}
                  >
                    {entry}
                  </button>
                </li>
              ),
            )}
          </ul>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onPageChange(page + 1)}
            disabled={page >= pageCount}
            aria-label={`${ariaLabel}: next page`}
          >
            <span className="hidden sm:inline">Next</span>
            <ChevronRight className="size-4" aria-hidden="true" />
          </Button>
        </nav>
      )}
    </div>
  )
}
