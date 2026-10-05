import { useCallback, useEffect, useRef, useState } from 'react'

const STORAGE_KEY = 'sidebar'

function readPreference() {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === 'expanded' ? 'expanded' : 'collapsed'
  } catch {
    return 'collapsed'
  }
}

export function useSidebar() {
  const [preference, setPreference] = useState(readPreference)
  const [isHovered, setIsHovered] = useState(false)
  const [isFocused, setIsFocused] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  const enterTimerRef = useRef(null)
  const leaveTimerRef = useRef(null)

  const pinned = preference === 'expanded'
  const expanded = pinned || isHovered || isFocused || mobileOpen

  const savePreference = (nextPreference) => {
    setPreference(nextPreference)
    try {
      window.localStorage.setItem(STORAGE_KEY, nextPreference)
    } catch {
      // Keep the sidebar usable when storage is unavailable.
    }
  }

  const clearTimers = useCallback(() => {
    if (enterTimerRef.current) {
      clearTimeout(enterTimerRef.current)
      enterTimerRef.current = null
    }
    if (leaveTimerRef.current) {
      clearTimeout(leaveTimerRef.current)
      leaveTimerRef.current = null
    }
  }, [])

  useEffect(() => {
    return () => clearTimers()
  }, [clearTimers])

  const handlePointerEnter = useCallback(
    (e) => {
      // Ignore touch events so coarse pointers don't trigger hover expansion
      if (e?.pointerType === 'touch') return
      if (typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches) return

      if (leaveTimerRef.current) {
        clearTimeout(leaveTimerRef.current)
        leaveTimerRef.current = null
      }

      if (pinned || isHovered) return

      enterTimerRef.current = setTimeout(() => {
        setIsHovered(true)
        enterTimerRef.current = null
      }, 120) // 120ms enter delay
    },
    [pinned, isHovered],
  )

  const handlePointerLeave = useCallback(
    (e) => {
      if (e?.pointerType === 'touch') return

      if (enterTimerRef.current) {
        clearTimeout(enterTimerRef.current)
        enterTimerRef.current = null
      }

      if (pinned) return

      leaveTimerRef.current = setTimeout(() => {
        setIsHovered(false)
        leaveTimerRef.current = null
      }, 200) // 200ms leave delay
    },
    [pinned],
  )

  const handleFocus = useCallback(() => {
    clearTimers()
    setIsFocused(true)
  }, [clearTimers])

  const handleBlur = useCallback((e) => {
    // Check if newly focused target is outside the sidebar
    if (e?.currentTarget && e?.relatedTarget && e.currentTarget.contains(e.relatedTarget)) {
      return
    }
    setIsFocused(false)
  }, [])

  const toggle = useCallback(() => {
    if (typeof window !== 'undefined' && !window.matchMedia('(min-width: 768px)').matches) {
      setMobileOpen((prev) => !prev)
    } else {
      if (pinned) {
        savePreference('collapsed')
        setIsHovered(false)
      } else {
        savePreference('expanded')
      }
    }
  }, [pinned])

  const togglePin = useCallback(() => {
    if (pinned) {
      savePreference('collapsed')
    } else {
      savePreference('expanded')
    }
  }, [pinned])

  const close = useCallback((force = false) => {
    clearTimers()
    setIsHovered(false)
    setIsFocused(false)
    setMobileOpen(false)
    if (force) {
      savePreference('collapsed')
    }
  }, [clearTimers])

  return {
    expanded,
    pinned,
    isHovered,
    isFocused,
    mobileOpen,
    handlePointerEnter,
    handlePointerLeave,
    handleFocus,
    handleBlur,
    toggle,
    togglePin,
    close,
  }
}

export default useSidebar