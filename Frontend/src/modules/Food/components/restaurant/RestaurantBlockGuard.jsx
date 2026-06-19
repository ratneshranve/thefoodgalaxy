import { useState, useEffect } from "react"
import { Outlet, useNavigate } from "react-router-dom"
import { restaurantAPI } from "@food/api"
import { Loader2, ShieldX } from "lucide-react"
import { clearModuleAuth } from "@food/utils/auth"

export default function RestaurantBlockGuard() {
  const [status, setStatus] = useState("loading")
  const [reason, setReason] = useState("")
  const navigate = useNavigate()

  useEffect(() => {
    let isMounted = true
    let intervalId = null

    const checkStatus = async () => {
      try {
        const response = await restaurantAPI.getCurrentRestaurant()
        const restaurant = response?.data?.data?.restaurant || response?.data?.restaurant
        
        if (isMounted) {
          if (restaurant?.status === "rejected" || restaurant?.isActive === false) {
            setStatus("blocked")
            setReason(restaurant?.rejectionReason || "Disabled by admin")
            // If they are blocked, clear the interval so we stop checking
            if (intervalId) clearInterval(intervalId)
          } else {
            setStatus("active")
          }
        }
      } catch (error) {
        if (isMounted) {
          if (error?.response?.status === 401) {
            clearModuleAuth("restaurant")
            navigate("/food/restaurant/login", { replace: true })
          } else {
            // Keep active on network errors to avoid blocking randomly
            if (status !== "blocked") setStatus("active")
          }
        }
      }
    }

    // Initial check
    checkStatus()

    // Poll every 30 seconds for real-time blocking
    intervalId = setInterval(checkStatus, 30000)

    return () => {
      isMounted = false
      if (intervalId) clearInterval(intervalId)
    }
  }, [navigate, status])

  if (status === "loading") {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600 mb-4" />
        <p className="text-slate-500 font-medium">Checking account status...</p>
      </div>
    )
  }

  if (status === "blocked") {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 p-6">
        <div className="w-24 h-24 bg-red-100 text-red-600 rounded-full flex items-center justify-center mb-6 shadow-sm">
          <ShieldX className="w-12 h-12" />
        </div>
        <h1 className="text-2xl font-bold text-slate-900 mb-3 text-center">Account Blocked</h1>
        <p className="text-slate-600 text-center max-w-md mb-8 text-base leading-relaxed">
          You are blocked by Admin. Please contact Admin for further assistance.
        </p>
        <button
          onClick={() => {
            clearModuleAuth("restaurant")
            navigate("/food/restaurant/login", { replace: true })
          }}
          className="px-8 py-3 bg-slate-900 text-white rounded-xl font-medium hover:bg-slate-800 transition-colors shadow-sm"
        >
          Logout
        </button>
      </div>
    )
  }

  return <Outlet />
}
