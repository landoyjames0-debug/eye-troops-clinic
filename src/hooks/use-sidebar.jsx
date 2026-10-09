import { useCallback, useEffect, useRef, useState } from 'react'

const STORAGE_KEY = 'sidebar'

// 'expanded' means the user pinned the rail open; 'collapsed' (or anything
// else) means it rides the hover/focus state. The preference is persisted so
// a pinned rail survives navigation and refreshes.
function readPreference() {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === 'expanded' ? 'expanded' : 'collapsed'
  } catch {
    return 'collapsed'
  }
}

function savePreference(nextPreference) {
  try {
    window.localStorage.setItem(STORAGE_KEY, nextPreference)
  } catch {
    // Keep the in-memory preference usable if storage is unavailable.
  }
}

function getScreenMode() {
  if (typeof window === 'undefined') {
    return { isMobile: false, isTablet: false, isDesktop: true }
  }
  const width = window.innerWidth
  return {
    isMobile: width < 768,
    isTablet: width >= 768 && width < 1024,
    isDesktop: width >= 1024,
  }
}

export function useSidebar() {
  const [preference, setPreference] = useState(readPreference)
  const [screenMode, setScreenMode] = useState(getScreenMode)
  const [isHovered, setIsHovered] = useState(false)
  const [isFocused, setIsFocused] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [tabletOpen, setTabletOpen] = useState(false)

  const enterTimerRef = useRef(null)
  const leaveTimerRef = useRef(null)

  useEffect(() => {
    const handleResize = () => {
      const mode = getScreenMode()
      setScreenMode(mode)
      if (mode.isDesktop) {
        setMobileOpen(false)
        setTabletOpen(false)
      } else if (mode.isTablet) {
        setMobileOpen(false)
      } else {
        setTabletOpen(false)
      }
    }
    window.addEventListener('resize', handleResize, { passive: true })
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // Pinning is a desktop-only, persistent preference. On tablet the rail is
  // toggled open/closed; on mobile it is a slide-out drawer.
  const pinned = screenMode.isDesktop && preference === 'expanded'

  const expanded = screenMode.isMobile
    ? mobileOpen
    : screenMode.isTablet
      ? tabletOpen || isFocused
      : pinned || isHovered || isFocused

  const updatePreference = useCallback((next) => {
    setPreference(next)
    savePreference(next)
  }, [])

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

  useEffect(() => clearTimers, [clearTimers])

  const handlePointerEnter = useCallback(
    (event) => {
      // Only a fine pointer on desktop may hover-expand the rail.
      if (event?.pointerType === 'touch') return
      if (typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches) return
      if (!screenMode.isDesktop) return

      if (leaveTimerRef.current) {
        clearTimeout(leaveTimerRef.current)
        leaveTimerRef.current = null
      }
      if (pinned || isHovered) return

      enterTimerRef.current = setTimeout(() => {
        setIsHovered(true)
        enterTimerRef.current = null
      }, 100)
    },
    [pinned, isHovered, screenMode.isDesktop],
  )

  const handlePointerLeave = useCallback(
    (event) => {
      if (event?.pointerType === 'touch') return
      if (!screenMode.isDesktop) return

      if (enterTimerRef.current) {
        clearTimeout(enterTimerRef.current)
        enterTimerRef.current = null
      }
      if (pinned) return

      leaveTimerRef.current = setTimeout(() => {
        setIsHovered(false)
        leaveTimerRef.current = null
      }, 180)
    },
    [pinned, screenMode.isDesktop],
  )

  // Expand for keyboard focus and for text inputs (which match :focus-visible
  // even when clicked). A mouse click on a button or link must not leave the
  // rail stuck open after the pointer leaves.
  const handleFocus = useCallback(
    (event) => {
      const target = event?.target
      if (target && typeof target.matches === 'function') {
        try {
          if (!target.matches(':focus-visible')) return
        } catch {
          // Older engines: fall through and treat focus as keyboard focus.
        }
      }
      clearTimers()
      setIsFocused(true)
    },
    [clearTimers],
  )

  const handleBlur = useCallback((event) => {
    if (event?.currentTarget && event?.relatedTarget && event.currentTarget.contains(event.relatedTarget)) {
      return
    }
    setIsFocused(false)
  }, [])

  const toggle = useCallback(() => {
    if (screenMode.isMobile) {
      setMobileOpen((prev) => !prev)
    } else if (screenMode.isTablet) {
      setTabletOpen((prev) => !prev)
    } else if (pinned) {
      updatePreference('collapsed')
      setIsHovered(false)
    } else {
      updatePreference('expanded')
    }
  }, [screenMode, pinned, updatePreference])

  const togglePin = useCallback(() => {
    if (!screenMode.isDesktop) return
    updatePreference(pinned ? 'collapsed' : 'expanded')
  }, [screenMode.isDesktop, pinned, updatePreference])

  const close = useCallback(
    (force = false) => {
      clearTimers()
      setIsHovered(false)
      setIsFocused(false)
      setMobileOpen(false)
      setTabletOpen(false)
      if (force && screenMode.isDesktop) {
        updatePreference('collapsed')
      }
    },
    [clearTimers, screenMode.isDesktop, updatePreference],
  )

  return {
    expanded,
    pinned,
    isHovered,
    isFocused,
    mobileOpen,
    tabletOpen,
    isMobile: screenMode.isMobile,
    isTablet: screenMode.isTablet,
    isDesktop: screenMode.isDesktop,
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
