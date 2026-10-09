import { Moon, Sun } from 'lucide-react'
import { useTheme } from '@/hooks/use-theme'

export function ThemeToggle({ className = '' }) {
  const { theme, toggleTheme } = useTheme()
  const label = 'Toggle theme'
  const Icon = theme === 'dark' ? Sun : Moon

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={label}
      aria-pressed={theme === 'dark'}
      title={label}
      className={`flex size-11 shrink-0 items-center justify-center rounded-xl border border-champagne bg-surface text-warmgray transition-colors hover:bg-gold-light hover:text-espresso focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold ${className}`.trim()}
    >
      <Icon className="size-4.5" strokeWidth={1.8} aria-hidden="true" />
    </button>
  )
}