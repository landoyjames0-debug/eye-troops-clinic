import { useEffect, useRef, useState } from 'react'
import './CustomCursor.css'

const FINE_POINTER_QUERY = '(hover: hover) and (pointer: fine)'

function getCursorMode(target) {
  if (!target) return 'default'

  if (target.closest('[disabled], [aria-disabled="true"]')) {
    return 'disabled'
  }

  if (
    target.closest('input, textarea, select, [contenteditable="true"], [contenteditable=""], [data-cursor="hide"]')
  ) {
    return 'input'
  }

  if (target.closest('a, button, [role="button"], summary, [data-cursor="interactive"]')) {
    return 'interactive'
  }

  return 'default'
}

export default function CustomCursor() {
  const ringRef = useRef(null)
  const dotRef = useRef(null)
  const [isEnabled, setIsEnabled] = useState(() => {
    if (typeof window === 'undefined') return false
    return window.matchMedia(FINE_POINTER_QUERY).matches
  })
  const [isVisible, setIsVisible] = useState(false)
  const [cursorMode, setCursorMode] = useState('default')
  const [isPressed, setIsPressed] = useState(false)
  const reduceMotionRef = useRef(false)

  useEffect(() => {
    const matches = window.matchMedia(FINE_POINTER_QUERY)
    reduceMotionRef.current = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    const handleChange = (event) => setIsEnabled(event.matches)

    matches.addEventListener('change', handleChange)
    return () => matches.removeEventListener('change', handleChange)
  }, [])

  useEffect(() => {
    if (!isEnabled) {
      return undefined
    }

    const body = document.body
    const previousCursor = body.style.cursor
    body.style.cursor = 'none'

    let frameId = 0
    let currentX = window.innerWidth / 2
    let currentY = window.innerHeight / 2
    let targetX = currentX
    let targetY = currentY

    const render = () => {
      if (reduceMotionRef.current) {
        currentX = targetX
        currentY = targetY
      } else {
        currentX += (targetX - currentX) * 0.2
        currentY += (targetY - currentY) * 0.2
      }

      if (dotRef.current) {
        dotRef.current.style.transform = `translate3d(${currentX}px, ${currentY}px, 0)`
      }

      if (ringRef.current) {
        ringRef.current.style.transform = `translate3d(${currentX}px, ${currentY}px, 0)`
      }

      frameId = window.requestAnimationFrame(render)
    }

    const setPosition = (event) => {
      targetX = event.clientX
      targetY = event.clientY
      setIsVisible(true)
    }

    const updateTargetFromEvent = (event) => {
      const nextMode = getCursorMode(event.target)
      setCursorMode(nextMode)
      setIsVisible(!(nextMode === 'input'))
    }

    const handlePointerMove = (event) => {
      setPosition(event)
      updateTargetFromEvent(event)
    }

    const handlePointerOver = (event) => {
      updateTargetFromEvent(event)
    }

    const handleCursorMode = (event) => {
      body.style.cursor = getCursorMode(event.target) === 'input' ? previousCursor : 'none'
    }

    const handlePointerDown = () => setIsPressed(true)
    const handlePointerUp = () => setIsPressed(false)
    const handlePointerLeave = () => {
      setIsVisible(false)
      setCursorMode('default')
    }

    document.addEventListener('pointermove', handlePointerMove)
    document.addEventListener('pointerover', handlePointerOver)
    document.addEventListener('pointerover', handleCursorMode)
    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('pointerup', handlePointerUp)
    document.addEventListener('pointerleave', handlePointerLeave)
    window.addEventListener('blur', handlePointerLeave)
    frameId = window.requestAnimationFrame(render)

    return () => {
      window.cancelAnimationFrame(frameId)
      document.removeEventListener('pointermove', handlePointerMove)
      document.removeEventListener('pointerover', handlePointerOver)
      document.removeEventListener('pointerover', handleCursorMode)
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('pointerup', handlePointerUp)
      document.removeEventListener('pointerleave', handlePointerLeave)
      window.removeEventListener('blur', handlePointerLeave)
      body.style.cursor = previousCursor
    }
  }, [isEnabled])

  if (!isEnabled) return null

  return (
    <div
      aria-hidden="true"
      className={`custom-cursor custom-cursor--${cursorMode} ${isVisible ? 'is-visible' : 'is-hidden'} ${isPressed ? 'is-pressed' : ''}`}
    >
      <span ref={ringRef} className="custom-cursor__ring" />
      <span ref={dotRef} className="custom-cursor__dot" />
    </div>
  )
}