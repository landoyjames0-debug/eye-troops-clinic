import { createContext, use, useCallback, useEffect, useMemo, useState } from 'react'

const ThemeContext = createContext(null)

function getStoredTheme() {
  try {
    const storedTheme = window.localStorage.getItem('theme')
    return ['light', 'dark', 'system'].includes(storedTheme) ? storedTheme : 'system'
  } catch {
    return 'system'
  }
}

function getSystemTheme() {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function ThemeProvider({ children }) {
  const [preference, setPreference] = useState(getStoredTheme)
  const [systemTheme, setSystemTheme] = useState(getSystemTheme)
  const theme = preference === 'system' ? systemTheme : preference

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const handleSystemThemeChange = (event) => {
      setSystemTheme(event.matches ? 'dark' : 'light')
    }

    media.addEventListener('change', handleSystemThemeChange)
    return () => media.removeEventListener('change', handleSystemThemeChange)
  }, [])

  useEffect(() => {
    const root = document.documentElement
    root.classList.toggle('dark', theme === 'dark')
    root.dataset.theme = theme
    root.style.colorScheme = theme
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', theme === 'dark' ? '#191714' : '#FBF5EC')
  }, [theme])

  const setTheme = useCallback((nextTheme) => {
    if (!['light', 'dark', 'system'].includes(nextTheme)) return
    try {
      window.localStorage.setItem('theme', nextTheme)
    } catch {
      // Keep the in-memory theme usable when storage is unavailable.
    }
    setPreference(nextTheme)
  }, [])

  const toggleTheme = useCallback(() => {
    setTheme(theme === 'dark' ? 'light' : 'dark')
  }, [setTheme, theme])

  const value = useMemo(
    () => ({ theme, preference, setTheme, toggleTheme }),
    [theme, preference, setTheme, toggleTheme],
  )
  return <ThemeContext value={value}>{children}</ThemeContext>
}

// oxlint-disable-next-line react/only-export-components
export function useTheme() {
  const context = use(ThemeContext)
  if (!context) throw new Error('useTheme must be used inside <ThemeProvider>.')
  return context
}