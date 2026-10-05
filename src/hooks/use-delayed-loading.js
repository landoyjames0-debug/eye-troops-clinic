import { useEffect, useRef, useState } from 'react'

export function useDelayedLoading(isLoading, { delay = 180, minVisible = 200, slowAfter = 4000 } = {}) {
  const [visible, setVisible] = useState(false)
  const [slow, setSlow] = useState(false)
  const visibleRef = useRef(false)
  const visibleSinceRef = useRef(0)

  useEffect(() => {
    let showTimer
    let slowTimer
    let hideTimer

    if (isLoading) {
      if (!visibleRef.current) {
        showTimer = window.setTimeout(() => {
          visibleRef.current = true
          visibleSinceRef.current = Date.now()
          setVisible(true)
        }, delay)
      }
      slowTimer = window.setTimeout(() => setSlow(true), slowAfter)
    } else {
      setSlow(false)
      const elapsed = visibleRef.current ? Date.now() - visibleSinceRef.current : minVisible
      const remaining = visibleRef.current ? Math.max(minVisible - elapsed, 0) : 0
      hideTimer = window.setTimeout(() => {
        visibleRef.current = false
        visibleSinceRef.current = 0
        setVisible(false)
        setSlow(false)
      }, remaining)
    }

    return () => {
      window.clearTimeout(showTimer)
      window.clearTimeout(slowTimer)
      window.clearTimeout(hideTimer)
    }
  }, [delay, isLoading, minVisible, slowAfter])

  return { visible, slow: visible && slow }
}