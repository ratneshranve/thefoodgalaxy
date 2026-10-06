import { useEffect, useRef, useState } from "react"
import { ArrowDown, Loader2 } from "lucide-react"

const TRIGGER_DISTANCE = 70
const MAX_PULL = 110
const IGNORE_SELECTOR = [
  "[data-no-pull-refresh]",
  "input",
  "textarea",
  "select",
  "[contenteditable='true']",
  "[role='dialog']",
  ".gm-style",
  ".leaflet-container",
  "canvas",
].join(",")

const findScrollableAncestor = (node) => {
  let el = node instanceof Element ? node : null
  while (el && el !== document.body && el !== document.documentElement) {
    const style = window.getComputedStyle(el)
    if (style.position === "fixed") return { fixed: true }
    const overflowY = style.overflowY
    if ((overflowY === "auto" || overflowY === "scroll") && el.scrollHeight > el.clientHeight) {
      return { el }
    }
    el = el.parentElement
  }
  return { el: document.scrollingElement || document.documentElement }
}

/**
 * Pull-to-refresh for the restaurant and delivery apps (bugs #40 / #116).
 * Triggers only when the scrollable area under the finger is already at the top
 * and the gesture is mostly vertical. Fixed overlays (sheets, dialogs, nav bars),
 * maps and form fields are ignored.
 */
export default function PullToRefresh({ onRefresh, enabled = true }) {
  const [pull, setPull] = useState(0)
  const [refreshing, setRefreshing] = useState(false)
  const onRefreshRef = useRef(onRefresh)
  const gestureRef = useRef(null)
  const pullRef = useRef(0)
  const refreshingRef = useRef(false)

  useEffect(() => {
    onRefreshRef.current = onRefresh
  }, [onRefresh])

  useEffect(() => {
    if (!enabled || typeof window === "undefined") return undefined

    const reset = () => {
      gestureRef.current = null
      pullRef.current = 0
      setPull(0)
    }

    const onTouchStart = (e) => {
      if (refreshingRef.current || e.touches.length !== 1) return
      const target = e.target
      if (target instanceof Element && target.closest(IGNORE_SELECTOR)) return
      const { el, fixed } = findScrollableAncestor(target)
      if (fixed || !el || el.scrollTop > 0) return
      gestureRef.current = {
        startX: e.touches[0].clientX,
        startY: e.touches[0].clientY,
        scroller: el,
        active: false,
      }
    }

    const onTouchMove = (e) => {
      const gesture = gestureRef.current
      if (!gesture) return
      const dx = e.touches[0].clientX - gesture.startX
      const dy = e.touches[0].clientY - gesture.startY
      if (!gesture.active) {
        if (Math.abs(dx) > Math.abs(dy) || dy <= 0 || gesture.scroller.scrollTop > 0) {
          if (Math.abs(dx) > 10 || dy < -10) gestureRef.current = null
          return
        }
        if (dy < 12) return
        gesture.active = true
      }
      if (gesture.scroller.scrollTop > 0 || dy <= 0) {
        reset()
        return
      }
      const next = Math.min(MAX_PULL, (dy - 12) * 0.5)
      pullRef.current = next
      setPull(next)
      if (e.cancelable) e.preventDefault()
    }

    const onTouchEnd = async () => {
      const gesture = gestureRef.current
      gestureRef.current = null
      if (!gesture?.active) return
      const reached = pullRef.current >= TRIGGER_DISTANCE * 0.5
      pullRef.current = 0
      if (!reached) {
        setPull(0)
        return
      }
      refreshingRef.current = true
      setRefreshing(true)
      setPull(TRIGGER_DISTANCE * 0.5)
      try {
        await onRefreshRef.current?.()
      } catch {
        /* the page shows its own errors */
      } finally {
        refreshingRef.current = false
        setRefreshing(false)
        setPull(0)
      }
    }

    document.addEventListener("touchstart", onTouchStart, { passive: true })
    document.addEventListener("touchmove", onTouchMove, { passive: false })
    document.addEventListener("touchend", onTouchEnd)
    document.addEventListener("touchcancel", onTouchEnd)
    return () => {
      document.removeEventListener("touchstart", onTouchStart)
      document.removeEventListener("touchmove", onTouchMove)
      document.removeEventListener("touchend", onTouchEnd)
      document.removeEventListener("touchcancel", onTouchEnd)
    }
  }, [enabled])

  if (pull <= 0 && !refreshing) return null

  const ready = pull >= TRIGGER_DISTANCE * 0.5
  return (
    <div
      className="pointer-events-none fixed inset-x-0 z-[1000] flex justify-center"
      style={{ top: `calc(env(safe-area-inset-top) + ${Math.round(Math.max(8, pull))}px)` }}
      aria-live="polite"
    >
      <div className="flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 bg-white shadow-lg">
        {refreshing ? (
          <Loader2 className="h-5 w-5 animate-spin text-[#7e3866]" />
        ) : (
          <ArrowDown
            className="h-5 w-5 text-[#7e3866] transition-transform"
            style={{ transform: `rotate(${ready ? 180 : 0}deg)` }}
          />
        )}
        <span className="sr-only">{refreshing ? "Refreshing" : "Pull to refresh"}</span>
      </div>
    </div>
  )
}
