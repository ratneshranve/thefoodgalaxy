import { Link } from "react-router-dom"
import { X } from "lucide-react"
import { useCart } from "@food/context/CartContext"
import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"

export default function StickyCartCard() {
  const { cart, getCartCount, clearCart } = useCart()
  const [isVisible, setIsVisible] = useState(true)
  const [bottomPosition, setBottomPosition] = useState("bottom-[70px]")
  const cartCount = getCartCount()

  useEffect(() => {
    if (cartCount > 0) {
      setIsVisible(true)
    }
  }, [cartCount])

  useEffect(() => {
    const setInitialPosition = () => {
      if (window.innerWidth >= 768) {
        setBottomPosition("bottom-6")
      } else {
        setBottomPosition("bottom-[70px]")
      }
    }

    setInitialPosition()

    const handleResize = () => {
      if (window.innerWidth >= 768) {
        setBottomPosition("bottom-6")
      } else {
        setBottomPosition("bottom-[70px]")
      }
    }

    window.addEventListener("resize", handleResize)

    return () => {
      window.removeEventListener("resize", handleResize)
    }
  }, [])

  const restaurantImage = cart[0]?.image || "https://images.unsplash.com/photo-1512058564366-18510be2db19?w=200&h=200&fit=crop"

  const cardVariants = {
    initial: {
      opacity: 1,
      scale: 1,
      y: 0,
      rotate: 0,
    },
    animate: {
      opacity: 1,
      scale: 1,
      y: 0,
      rotate: 0,
      transition: {
        type: "spring",
        stiffness: 300,
        damping: 25,
        mass: 0.8,
      },
    },
    exit: {
      opacity: 0,
      scale: 0.8,
      y: 100,
      rotate: -5,
      transition: {
        duration: 0.4,
        ease: [0.4, 0, 0.2, 1],
      },
    },
  }

  if (cartCount === 0) return null

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          className={`fixed ${bottomPosition} md:bottom-6 left-0 right-0 md:left-auto md:right-6 z-50 px-4 md:px-0 pb-4 md:pb-0 pointer-events-none`}
          initial="initial"
          animate="animate"
          exit="exit"
          variants={cardVariants}
        >
          <div className="max-w-7xl md:max-w-none mx-auto md:mx-0 pointer-events-auto">
            <div
              className="rounded-3xl border overflow-hidden md:max-w-md md:w-[400px]"
              style={{
                background: 'linear-gradient(135deg, #ffffff 0%, var(--user-brand-surface) 100%)',
                borderColor: 'rgba(249,168,9,0.35)',
                boxShadow: '0 22px 45px rgba(2,53,14,0.16)'
              }}
            >
              <div className="flex items-center gap-3 p-3 md:p-4">
                <div className="flex-shrink-0">
                  <img
                    src={restaurantImage}
                    alt="Cart item"
                    className="w-14 h-14 md:w-16 md:h-16 rounded-2xl object-cover border-2"
                    style={{ borderColor: 'rgba(249,168,9,0.45)' }}
                  />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="text-sm md:text-base font-semibold" style={{ color: 'var(--user-brand-secondary)' }}>
                    Cart Summary
                  </div>
                  <div className="text-xs md:text-sm" style={{ color: 'rgba(2,53,14,0.62)' }}>
                    Ready to checkout
                  </div>
                </div>

                <Link
                  to="/user/cart"
                  className="flex-shrink-0 text-white px-4 py-2.5 md:px-5 md:py-3 rounded-2xl font-semibold transition-colors"
                  style={{
                    background: 'linear-gradient(135deg, var(--user-brand-primary) 0%, #b20807 100%)',
                    boxShadow: '0 14px 24px rgba(222,11,9,0.28)'
                  }}
                >
                  <div className="text-center">
                    <div className="text-xs md:text-sm opacity-90">View Cart</div>
                    <div className="text-xs md:text-sm font-bold">{cartCount} {cartCount === 1 ? 'item' : 'items'}</div>
                  </div>
                </Link>

                <motion.button
                  onClick={() => {
                    setIsVisible(false)
                    window.setTimeout(() => {
                      clearCart()
                      setIsVisible(true)
                    }, 400)
                  }}
                  className="flex-shrink-0 w-8 h-8 md:w-9 md:h-9 flex items-center justify-center rounded-full transition-colors"
                  style={{ backgroundColor: 'rgba(255,255,255,0.78)' }}
                  whileHover={{ scale: 1.1, rotate: 90 }}
                  whileTap={{ scale: 0.9 }}
                  transition={{ type: "spring", stiffness: 400, damping: 17 }}
                >
                  <X className="h-4 w-4 md:h-5 md:w-5" style={{ color: 'var(--user-brand-primary)' }} />
                </motion.button>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
