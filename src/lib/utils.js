import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

/**
 * Conditional classes with later Tailwind utilities winning over earlier
 * conflicting ones, so a caller's className always overrides the default.
 */
export function cn(...inputs) {
  return twMerge(clsx(inputs))
}
