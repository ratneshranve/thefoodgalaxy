import React, { useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { setLocation } from '@/app/slices/locationSlice'
import { useLocation } from '@food/hooks/useLocation'
import { useZone } from '@food/hooks/useZone'


export default function LocationGuard({ children }) {
  const dispatch = useDispatch()
  const { isLocationResolved } = useSelector((state) => state.location)
  
  // We only use the hooks here ONCE globally.
  const { location: coords, loading: locationLoading } = useLocation()
  const { zoneId, zoneStatus } = useZone(coords)

  useEffect(() => {
    // Unblock the app once location is fetched (or fallback is provided) 
    // AND zone status is determined (not 'loading').
    if (coords && !locationLoading && zoneStatus !== 'loading') {
      dispatch(setLocation({
        coords,
        zoneId: zoneId || null,
        address: coords?.address || coords?.formattedAddress || ''
      }))
    }
  }, [coords, zoneId, zoneStatus, locationLoading, dispatch])

  if (!isLocationResolved) {
    // Show the premium loader while location is being fetched for the very first time
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 flex flex-col items-center justify-center">
        {/* We can reuse the PizzaTransition visual manually or just show a loading state */}
        <div className="relative w-32 h-32 flex items-center justify-center animate-pulse">
          <div className="absolute inset-0 border-4 border-primary/20 rounded-full" />
          <div className="absolute inset-0 border-4 border-t-primary rounded-full animate-spin" />
        </div>
        <p className="mt-6 text-sm font-black uppercase tracking-widest text-primary">Locating You...</p>
      </div>
    )
  }

  return children
}
