import { Link, useLocation } from "react-router-dom"
import { Tag, User, Home as HomeIcon, ShoppingBag } from "lucide-react"
import { useState, useEffect } from "react"
import { getPublicLandingSettings } from "@food/api"
import { useAppLocation } from "@food/hooks/useAppLocation"

export default function BottomNavigation() {
  const location = useLocation()
  const pathname = location.pathname
  const { zoneId } = useAppLocation()
  const [under250PriceLimit, setUnder250PriceLimit] = useState(250)

  useEffect(() => {
    let cancelled = false
    getPublicLandingSettings(zoneId || null)
      .then((settings) => {
        if (cancelled || !settings) return
        if (typeof settings.under250PriceLimit === 'number') {
          setUnder250PriceLimit(settings.under250PriceLimit)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setUnder250PriceLimit(250)
        }
      })
    return () => { cancelled = true }
  }, [zoneId])

  const isUnder250 = pathname === "/food/under-250" || pathname.startsWith("/food/user/under-250")
  const isOrders = pathname === "/food/orders" || pathname.startsWith("/food/user/orders")
  const isProfile = pathname === "/food/profile" || pathname.startsWith("/food/user/profile")
  const isHome =
    !isUnder250 &&
    !isOrders &&
    !isProfile &&
    (pathname === "/food" ||
      pathname === "/food/" ||
      pathname === "/food/user" ||
      (pathname.startsWith("/food/user") &&
        !pathname.includes("/dining") &&
        !pathname.includes("/under-250") &&
        !pathname.includes("/profile")))

  const activeStyles = {
    backgroundColor: 'var(--user-brand-nav-active)',
    color: 'var(--user-brand-primary)',
    boxShadow: '0 10px 24px var(--user-brand-card-shadow)'
  }

  const iconColor = (active) => active ? 'var(--user-brand-primary)' : '#64748b'

  return (
    <div
      className="md:hidden fixed bottom-3 left-3 right-3 rounded-[2rem] z-50 shadow-[0_16px_40px_rgba(2,53,14,0.15)] border overflow-hidden"
      style={{
        background: 'linear-gradient(180deg, #ffffff 0%, var(--user-brand-surface) 100%)',
        borderColor: 'rgba(2,53,14,0.08)'
      }}
    >
      <div className="flex items-center justify-between px-2 py-1.5">
        <Link
          to="/food/user/"
          className="flex flex-col items-center justify-center gap-1 w-[22%] py-2 rounded-[1.5rem] transition-all duration-300"
          style={isHome ? activeStyles : { color: '#64748b' }}
        >
          <HomeIcon className="h-5 w-5" style={{ color: iconColor(isHome) }} strokeWidth={isHome ? 2.5 : 2} />
          <span className="text-[10px] sm:text-xs font-bold" style={{ color: iconColor(isHome) }}>
            Home
          </span>
        </Link>

        <Link
          to="/food/user/under-250"
          className="flex flex-col items-center justify-center gap-1 w-[22%] py-2 rounded-[1.5rem] transition-all duration-300"
          style={isUnder250 ? activeStyles : { color: '#64748b' }}
        >
          <Tag className="h-5 w-5" style={{ color: iconColor(isUnder250) }} strokeWidth={isUnder250 ? 2.5 : 2} />
          <span className="text-[10px] sm:text-xs font-bold" style={{ color: iconColor(isUnder250) }}>
            Under ?{under250PriceLimit}
          </span>
        </Link>

        <Link
          to="/food/user/orders"
          className="flex flex-col items-center justify-center gap-1 w-[22%] py-2 rounded-[1.5rem] transition-all duration-300"
          style={isOrders ? activeStyles : { color: '#64748b' }}
        >
          <ShoppingBag className="h-5 w-5" style={{ color: iconColor(isOrders) }} strokeWidth={isOrders ? 2.5 : 2} />
          <span className="text-[10px] sm:text-xs font-bold" style={{ color: iconColor(isOrders) }}>
            Orders
          </span>
        </Link>

        <Link
          to="/food/user/profile"
          className="flex flex-col items-center justify-center gap-1 w-[22%] py-2 rounded-[1.5rem] transition-all duration-300"
          style={isProfile ? activeStyles : { color: '#64748b' }}
        >
          <User className="h-5 w-5" style={{ color: iconColor(isProfile) }} strokeWidth={isProfile ? 2.5 : 2} />
          <span className="text-[10px] sm:text-xs font-bold" style={{ color: iconColor(isProfile) }}>
            Profile
          </span>
        </Link>
      </div>
    </div>
  )
}
