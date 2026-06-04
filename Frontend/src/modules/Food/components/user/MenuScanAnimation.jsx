import { useEffect, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"

export default function MenuScanAnimation({ onComplete, duration = 3000 }) {
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    const hideTimer = setTimeout(() => {
      setVisible(false)
    }, duration - 400) // start fade out

    const doneTimer = setTimeout(() => {
      onComplete?.()
    }, duration)

    return () => {
      clearTimeout(hideTimer)
      clearTimeout(doneTimer)
    }
  }, [duration, onComplete])

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4 }}
          className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-white"
        >
          {/* Main Card Container with Rotation */}
          <div className="relative rotate-[-8deg] mb-8">
            {/* Animated Border Wrapper */}
            <div className="relative p-[3px] rounded-[24px] overflow-hidden shadow-2xl">
              {/* Spinning gradient for border */}
              <div 
                className="absolute inset-[-100%] z-0"
                style={{
                  background: 'conic-gradient(from 0deg, transparent 70%, #dc2626 100%)',
                  animation: 'spin-border 0.8s linear infinite'
                }}
              />
              
              {/* Inner Card (White background to mask the center) */}
              <div className="relative z-10 w-[140px] bg-white rounded-[18px] p-3">
                {/* Header Section */}
                <div className="relative mb-3">
                  <div className="w-8 h-8 rounded-full absolute -top-5 -left-5 border-[3px] border-white shadow-sm bg-gray-50 z-20"></div>
                  <div className="text-center ml-1">
                    <h2 className="font-bold text-[11px] tracking-widest text-black font-serif uppercase border-b border-black/80 inline-block px-0.5">Restaurant</h2>
                    <p className="text-[7px] tracking-[0.2em] text-gray-500 mt-0.5">MENU</p>
                  </div>
                </div>

                {/* Menu Items */}
                <div className="space-y-2">
                  {/* Breakfast */}
                  <div>
                    <h3 className="text-[9px] font-bold text-slate-700 mb-1 ml-1.5">Breakfast</h3>
                    <div className="flex items-center justify-between ml-1.5">
                      <div className="space-y-1 flex-1 pr-2">
                        <div className="h-0.5 w-full bg-slate-200 rounded-full" />
                        <div className="h-0.5 w-4/5 bg-slate-200 rounded-full" />
                        <div className="h-0.5 w-3/4 bg-slate-200 rounded-full" />
                      </div>
                      <div className="w-6 h-6 rounded-full border border-slate-100 shadow-sm flex-shrink-0 bg-white"></div>
                    </div>
                  </div>

                  {/* Mains */}
                  <div>
                    <h3 className="text-[9px] font-bold text-slate-700 mb-1 ml-1.5">Mains</h3>
                    <div className="flex items-center justify-between ml-1.5">
                      <div className="space-y-1 flex-1 pr-2">
                        <div className="h-0.5 w-full bg-slate-200 rounded-full" />
                        <div className="h-0.5 w-5/6 bg-slate-200 rounded-full" />
                        <div className="h-0.5 w-3/4 bg-slate-200 rounded-full" />
                      </div>
                      <div className="w-6 h-6 rounded-full border border-slate-100 shadow-sm flex-shrink-0 bg-white"></div>
                    </div>
                  </div>

                  {/* Salads */}
                  <div>
                    <h3 className="text-[9px] font-bold text-slate-700 mb-1 ml-1.5">Salads</h3>
                    <div className="flex items-center justify-between ml-1.5">
                      <div className="space-y-1 flex-1 pr-2">
                        <div className="h-0.5 w-full bg-slate-200 rounded-full" />
                        <div className="h-0.5 w-3/4 bg-slate-200 rounded-full" />
                      </div>
                      <div className="w-6 h-6 rounded-full border border-slate-100 shadow-sm flex-shrink-0 bg-white"></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Text Below */}
          <div className="text-center mt-6">
            <h1 className="text-2xl font-black text-[#dc2626] uppercase tracking-wide leading-tight">
              Offline Menu<br />
              Price Matched
            </h1>
          </div>

          <style>{`
            @keyframes spin-border {
              100% {
                transform: rotate(360deg);
              }
            }
          `}</style>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
