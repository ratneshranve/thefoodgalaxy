import React, { useState, useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { Loader2 } from 'lucide-react'

// Route changes during app start-up (first render + automatic redirects such as
// "/food/restaurant" -> "/food/restaurant/login") must not flash the spinner,
// otherwise a loader appears right after the native splash (bugs #1-3).
const APP_BOOT_GRACE_MS = 2500
const appBootedAt = typeof performance !== 'undefined' ? performance.now() : Date.now()
const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now())

/**
 * Lightweight route-change loader (CSS only).
 * Avoids framer-motion AnimatePresence — it can throw removeChild errors
 * inside device simulators / StrictMode when the overlay unmounts quickly.
 */
export default function PageLoader() {
  const [isNavigating, setIsNavigating] = useState(false)
  const location = useLocation()
  const isFirstRenderRef = useRef(true)

  useEffect(() => {
    if (isFirstRenderRef.current) {
      isFirstRenderRef.current = false
      return undefined
    }
    if (now() - appBootedAt < APP_BOOT_GRACE_MS) {
      return undefined
    }

    if (
      location.pathname.includes('/under-250') ||
      location.pathname.includes('/restaurants/') ||
      location.pathname.includes('/terms') ||
      location.pathname.includes('/privacy') ||
      location.pathname.includes('/support')
    ) {
      setIsNavigating(false)
      return undefined
    }

    setIsNavigating(true)
    const timer = setTimeout(() => setIsNavigating(false), 500)
    return () => clearTimeout(timer)
  }, [location.pathname])

  if (!isNavigating) return null

  return (
    <div
      className="fixed inset-0 z-[999999] bg-white/40 dark:bg-black/40 backdrop-blur-[1px] flex items-center justify-center animate-in fade-in duration-200"
      role="status"
      aria-live="polite"
      aria-label="Loading page"
    >
      <div className="bg-white dark:bg-[#1a1a1a] p-4 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-800">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    </div>
  )
}
