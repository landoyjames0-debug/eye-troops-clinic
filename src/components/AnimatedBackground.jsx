import { useEffect, useRef, useState } from 'react'
import './AnimatedBackground.css'

const ORB_COUNT = 5

export default function AnimatedBackground() {
  const containerRef = useRef(null)
  const [paused, setPaused] = useState(document.visibilityState === 'hidden')

  useEffect(() => {
    const handleVisibility = () => {
      setPaused(document.visibilityState === 'hidden')
    }

    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [])

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    if (media.matches) return undefined

    const root = containerRef.current
    if (!root) return undefined

    let rafId = 0
    let currentX = 0
    let currentY = 0
    let targetX = 0
    let targetY = 0

    const updateParallax = () => {
      if (!document.hidden) {
        currentX += (targetX - currentX) * 0.08
        currentY += (targetY - currentY) * 0.08
        root.style.setProperty('--pointer-shift-x', `${currentX}px`)
        root.style.setProperty('--pointer-shift-y', `${currentY}px`)
      }
      rafId = window.requestAnimationFrame(updateParallax)
    }

    const handlePointerMove = (event) => {
      const maxShift = 26
      targetX = ((event.clientX / window.innerWidth) - 0.5) * maxShift
      targetY = ((event.clientY / window.innerHeight) - 0.5) * maxShift
    }

    const handlePointerLeave = () => {
      targetX = 0
      targetY = 0
    }

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerleave', handlePointerLeave)
    rafId = window.requestAnimationFrame(updateParallax)

    return () => {
      window.cancelAnimationFrame(rafId)
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerleave', handlePointerLeave)
      root.style.removeProperty('--pointer-shift-x')
      root.style.removeProperty('--pointer-shift-y')
    }
  }, [])

  return (
    <div
      ref={containerRef}
      aria-hidden="true"
      className={`animated-background ${paused ? 'is-paused' : ''}`}
    >
      <div className="animated-background__halo" />
      {Array.from({ length: ORB_COUNT }, (_, index) => (
        <span
          key={index}
          className={`animated-background__orb animated-background__orb--${index + 1}`}
        />
      ))}
      <span className="animated-background__ring animated-background__ring--1" />
      <span className="animated-background__ring animated-background__ring--2" />
      <span className="animated-background__ring animated-background__ring--3" />
    </div>
  )
}