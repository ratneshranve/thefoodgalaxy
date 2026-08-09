import { useState, useRef } from "react"
import { useNavigate, Link } from "react-router-dom"
import { motion } from "framer-motion"
import { ShieldCheck, Truck, Star, Heart, ArrowRight, Loader2, ShieldQuestion } from "lucide-react"
import { Button } from "@food/components/ui/button"
import { toast } from "sonner"
import { deliveryAPI } from "@food/api"
import { clearModuleAuth } from "@food/utils/auth"
import { loadBusinessSettings, getCachedSettings, resolveMediaUrl } from "@food/utils/businessSettings"
import { useEffect } from "react"

const DEFAULT_COUNTRY_CODE = "+91"

export default function DeliverySignIn() {
  const navigate = useNavigate()
  const [phone, setPhone] = useState(() => {
    const draft = localStorage.getItem("delivery_draft_phone")
    if (draft) return draft;
    const stored = localStorage.getItem("deliveryAuthData")
    if (stored) {
      try {
        const data = JSON.parse(stored)
        return data.phone ? data.phone.replace("+91", "").trim() : ""
      } catch (e) { return "" }
    }
    return ""
  })
  const [loading, setLoading] = useState(false)
  const submitting = useRef(false)
  const [logoUrl, setLogoUrl] = useState(() => {
    const settings = getCachedSettings()
    return resolveMediaUrl(settings?.logo)
  })

  useEffect(() => {
    let active = true
    loadBusinessSettings().then((settings) => {
      if (active && settings) {
        setLogoUrl(resolveMediaUrl(settings.logo))
      }
    })
    return () => {
      active = false
    }
  }, [])

  const validatePhone = (num) => {
    const digits = num.replace(/\D/g, "")
    return digits.length === 10 && ["6", "7", "8", "9"].includes(digits[0])
  }

  const handleSendOTP = async (e) => {
    if (e) e.preventDefault()
    if (!validatePhone(phone)) {
      toast.error("Please enter a valid 10-digit mobile number")
      return
    }
    if (submitting.current) return
    submitting.current = true
    setLoading(true)

    const fullPhone = `${DEFAULT_COUNTRY_CODE} ${phone}`.trim()

    try {
      clearModuleAuth("delivery")
      await deliveryAPI.sendOTP(fullPhone, "login")

      const authData = {
        method: "phone",
        phone: fullPhone,
        isSignUp: false,
        purpose: "login",
        module: "delivery",
      }
      localStorage.setItem("deliveryAuthData", JSON.stringify(authData))
      toast.success("Verification code sent to your phone!")
      navigate("/food/delivery/otp")
    } catch (err) {
      const msg = err?.response?.data?.message || err?.message || "Failed to send OTP."
      toast.error(msg)
    } finally {
      setLoading(false)
      submitting.current = false
    }
  }

  return (
    <div className="min-h-screen min-h-[100dvh] bg-[#FFF9F2] dark:bg-[#0a0a0a] flex flex-col relative overflow-x-hidden overflow-y-auto font-['Poppins'] select-none">
      {/* Soft Ambient Background Elements */}
      <div className="absolute top-[-20%] left-[-10%] w-[80vw] sm:w-[70vw] h-[80vw] sm:h-[70vw] rounded-full bg-[#FFE4C4]/40 dark:bg-primary/5 blur-[80px] sm:blur-[100px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[70vw] sm:w-[60vw] h-[70vw] sm:h-[60vw] rounded-full bg-[#E0F7FA]/50 dark:bg-blue-900/10 blur-[80px] sm:blur-[100px] pointer-events-none" />
      
      {/* Floating Decorative Elements (Hiding or downsizing on narrow screens to avoid clutter) */}
      <motion.div animate={{ y: [0, -15, 0], rotate: [0, 5, 0] }} transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }} className="absolute top-[8%] sm:top-[15%] left-[4%] sm:left-[8%] opacity-20 sm:opacity-30 dark:opacity-10 pointer-events-none">
        <span className="text-2xl sm:text-4xl text-orange-500">🍕</span>
      </motion.div>
      <motion.div animate={{ y: [0, 20, 0], rotate: [0, -10, 0] }} transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }} className="absolute top-[18%] sm:top-[25%] right-[5%] sm:right-[10%] opacity-20 sm:opacity-30 dark:opacity-10 pointer-events-none">
        <span className="text-2xl sm:text-4xl">🛵</span>
      </motion.div>
      <motion.div animate={{ y: [0, -10, 0], scale: [1, 1.1, 1] }} transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }} className="absolute bottom-[18%] sm:bottom-[20%] left-[5%] sm:left-[12%] opacity-20 sm:opacity-30 dark:opacity-10 pointer-events-none">
        <span className="text-2xl sm:text-4xl">⭐</span>
      </motion.div>
      <motion.div animate={{ y: [0, 15, 0], rotate: [0, 15, 0] }} transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }} className="absolute bottom-[10%] sm:bottom-[15%] right-[6%] sm:right-[15%] opacity-20 sm:opacity-30 dark:opacity-10 pointer-events-none">
        <span className="text-3xl sm:text-5xl">📍</span>
      </motion.div>

      {/* Main Content Container */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 xs:px-6 py-6 xs:py-8 sm:py-12 relative z-10 w-full max-w-md mx-auto my-auto">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="w-full flex flex-col items-center"
        >
          {logoUrl && (
            <div className="relative mb-4 sm:mb-6 flex justify-center">
              <div className="absolute inset-0 bg-blue-400/20 rounded-full blur-[30px] sm:blur-[40px] scale-150 pointer-events-none" />
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", stiffness: 200, damping: 20 }}
                className="relative w-24 h-24 xs:w-28 xs:h-28 sm:w-36 sm:h-36 rounded-full bg-white shadow-[0_8px_30px_rgb(0,0,0,0.12)] overflow-hidden border-4 border-white flex items-center justify-center"
                style={{ borderRadius: '50%', WebkitMaskImage: '-webkit-radial-gradient(white, black)' }}
              >
                <img 
                  src={logoUrl} 
                  alt="Logo" 
                  className="w-full h-full object-cover scale-[1.05]"
                  style={{ borderRadius: '50%' }}
                />
              </motion.div>
            </div>
          )}

          {/* Typography Section */}
          <div className="text-center mb-6 sm:mb-8 px-1">
            <h1 className="text-xl xs:text-2xl sm:text-[32px] font-black text-[#3c2a21] dark:text-white leading-tight tracking-tight mb-1.5 sm:mb-2 font-['Outfit']">
              Deliver smiles, <br className="hidden xs:inline" /> earn on your schedule.
            </h1>
            <h2 className="text-base xs:text-lg sm:text-[22px] text-[#5e4b3c] dark:text-gray-300 font-semibold mb-1">
              Delivery Partner Login
            </h2>
            <p className="text-xs xs:text-sm text-[#8c7a6b] dark:text-gray-400 font-medium">
              Login with your mobile number
            </p>
          </div>

          <form onSubmit={handleSendOTP} className="w-full space-y-4 sm:space-y-6">
            {/* Pill-shaped Glassmorphic Input */}
            <div className="relative group">
              <div className="absolute -inset-1 bg-gradient-to-r from-orange-100 to-blue-100 dark:from-gray-800 dark:to-gray-800 rounded-full blur opacity-50 group-hover:opacity-100 transition duration-500"></div>
              <div className="relative flex items-center bg-white/80 dark:bg-[#1a1a1a]/90 backdrop-blur-xl border border-white/60 dark:border-gray-800 rounded-full p-1.5 sm:p-2 shadow-[0_8px_25px_rgb(0,0,0,0.04)]">
                
                {/* Prefix Section */}
                <div className="flex items-center pl-3 pr-2 sm:pl-4 sm:pr-3 border-r border-gray-200 dark:border-gray-700 shrink-0">
                  <img src="https://flagcdn.com/w20/in.png" alt="India" className="w-4 xs:w-5 h-auto mr-1.5 sm:mr-2 rounded-sm shrink-0" />
                  <span className="text-sm sm:text-base font-bold text-gray-800 dark:text-gray-200 mr-1 sm:mr-2">+91</span>
                </div>

                {/* Input Field */}
                <input
                  type="tel"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  required
                  autoFocus
                  value={phone}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, "").slice(0, 10);
                    setPhone(val);
                    localStorage.setItem("delivery_draft_phone", val);
                  }}
                  maxLength={10}
                  className="flex-1 bg-transparent border-0 outline-none text-gray-900 dark:text-white font-bold text-base sm:text-lg placeholder:text-gray-400 placeholder:font-normal text-sm sm:text-base py-2 pl-3 sm:pl-4 pr-3 min-w-0"
                  style={{ boxShadow: "none", border: "none", outline: "none" }}
                  placeholder="Enter Number"
                />
              </div>
            </div>

            {/* Gradient CTA Button */}
            <button
              type="submit"
              disabled={loading || phone.length < 10}
              className="w-full py-3.5 sm:py-4 bg-gradient-to-r from-[#4CB8C4] to-[#3CD3AD] hover:from-[#3BA0AB] hover:to-[#2BB896] disabled:from-gray-300 disabled:to-gray-300 dark:disabled:from-gray-800 dark:disabled:to-gray-800 disabled:text-gray-500 text-white rounded-full font-bold text-sm xs:text-base sm:text-[17px] shadow-[0_12px_25px_-8px_rgba(76,184,196,0.5)] transition-all active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 sm:w-6 sm:h-6 animate-spin" />
              ) : (
                <span>Send OTP to Register / Login</span>
              )}
            </button>
          </form>

          {/* Support Link */}
          <div className="mt-5 sm:mt-6">
            <Link 
              to="/food/delivery/support"
              className="flex items-center justify-center gap-2 px-4 xs:px-6 py-2 sm:py-2.5 bg-white/60 dark:bg-gray-800/60 hover:bg-white dark:hover:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-full text-xs xs:text-sm font-bold text-gray-700 dark:text-gray-300 shadow-sm transition-all"
            >
              <ShieldQuestion className="w-4 h-4 text-orange-500 shrink-0" />
              Need Help? Support
            </Link>
          </div>

          {/* Footer Terms */}
          <div className="mt-6 sm:mt-8 text-center max-w-[290px] xs:max-w-none mx-auto">
            <p className="text-[11px] xs:text-xs text-gray-500 font-medium leading-relaxed">
              By continuing, you agree to our{" "}
              <Link to="/food/delivery/profile/terms" className="text-gray-800 dark:text-gray-300 font-bold hover:text-[#4CB8C4] underline underline-offset-2 mx-0.5">Terms</Link>
              &amp;
              <Link to="/food/delivery/profile/privacy" className="text-gray-800 dark:text-gray-300 font-bold hover:text-[#4CB8C4] underline underline-offset-2 ml-0.5">Privacy Policy</Link>
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  )
}

