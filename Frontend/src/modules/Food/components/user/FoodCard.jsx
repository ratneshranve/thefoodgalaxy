import React from "react"
import { motion } from "framer-motion"
import { Plus, Minus, Star, Heart, Flame } from "lucide-react"
import { Button } from "@food/components/ui/button"
import OptimizedImage from "@food/components/OptimizedImage"
import { useCart } from "@food/context/CartContext"
import { isModuleAuthenticated } from "@food/utils/auth"
import { useNavigate, useLocation } from "react-router-dom"
import { toast } from "sonner"

const RUPEE_SYMBOL = "\u20B9"

const FoodCard = ({
  item,
  onClick,
  compact = false,
  className = "",
}) => {
  const { addToCart, isInCart, getCartItem, updateQuantity } = useCart()
  const navigate = useNavigate()
  const location = useLocation()

  if (!item) return null

  const itemId = String(item.id || item._id || "")
  const inCart = isInCart(itemId)
  const cartItem = getCartItem(itemId)
  const quantity = cartItem?.quantity || 0

  const foodType = String(item.foodType || "").toLowerCase()
  const isVeg = item.isVeg !== undefined 
    ? item.isVeg 
    : (foodType.includes("veg") && !foodType.includes("non"))

  const itemPrice = Number(item.price || 0)
  const originalPrice = Number(item.originalPrice || item.mrp || 0)
  const hasDiscount = originalPrice > itemPrice

  const imageUrl =
    item.image ||
    item.imageUrl ||
    item.profileImage ||
    (Array.isArray(item.images) ? item.images[0] : "") ||
    ""

  const handleAddToCart = (e) => {
    e.preventDefault()
    e.stopPropagation()

    if (!isModuleAuthenticated("user")) {
      toast.error("Please login to add items to cart")
      navigate("/user/auth/login", { state: { from: location.pathname } })
      return
    }

    addToCart({
      ...item,
      id: itemId,
      itemId,
      price: itemPrice,
      isVeg,
      image: imageUrl,
      restaurant: item.restaurant || item.restaurantName || item.restaurant?.restaurantName || item.restaurant?.name || "The Food Galaxy",
      restaurantId: item.restaurantId || item.restaurant_id || item.restaurant?._id || "",
    })
  }

  const handleIncrease = (e) => {
    e.preventDefault()
    e.stopPropagation()
    updateQuantity(itemId, quantity + 1)
  }

  const handleDecrease = (e) => {
    e.preventDefault()
    e.stopPropagation()
    updateQuantity(itemId, quantity - 1)
  }

  return (
    <motion.div
      whileHover={{ y: -4, transition: { duration: 0.2 } }}
      className={`group relative bg-white dark:bg-[#161616] rounded-2xl overflow-hidden border border-gray-100 dark:border-gray-800 shadow-sm hover:shadow-md transition-all duration-300 flex flex-col ${className}`}
      onClick={onClick}
    >
      {/* Image Container */}
      <div className={`relative w-full overflow-hidden bg-gray-100 dark:bg-gray-900 ${compact ? "h-32 sm:h-36" : "h-40 sm:h-48"}`}>
        {imageUrl ? (
          <OptimizedImage
            src={imageUrl}
            alt={item.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-400">
            <span className="text-xs uppercase font-bold tracking-wider">No Image</span>
          </div>
        )}

        {/* Veg / Non-Veg Indicator Badge */}
        <div className="absolute top-2.5 left-2.5 z-10 bg-white/90 dark:bg-black/80 backdrop-blur-md p-1 rounded-md border border-black/5 shadow-sm">
          {isVeg ? (
            <div className="h-3.5 w-3.5 rounded border border-green-600 flex items-center justify-center">
              <div className="h-1.5 w-1.5 rounded-full bg-green-600" />
            </div>
          ) : (
            <div className="h-3.5 w-3.5 rounded border border-red-600 flex items-center justify-center">
              <div className="h-1.5 w-1.5 rounded-full bg-red-600" />
            </div>
          )}
        </div>

        {/* Discount Badge */}
        {hasDiscount && (
          <div className="absolute top-2.5 right-2.5 z-10 bg-red-600 text-white text-[10px] font-extrabold px-2 py-0.5 rounded-full shadow-md uppercase tracking-wider">
            {Math.round(((originalPrice - itemPrice) / originalPrice) * 100)}% OFF
          </div>
        )}
      </div>

      {/* Item Info Content */}
      <div className="p-3.5 flex-1 flex flex-col justify-between">
        <div>
          <h4 className="text-sm sm:text-base font-bold text-gray-900 dark:text-white line-clamp-1 group-hover:text-primary transition-colors">
            {item.name}
          </h4>

          {item.description && (
            <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-1 mt-0.5">
              {item.description}
            </p>
          )}
        </div>

        {/* Price and Add Button Bar */}
        <div className="mt-3 flex items-center justify-between gap-2 pt-2 border-t border-gray-100 dark:border-gray-800/80">
          <div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-base sm:text-lg font-extrabold text-gray-900 dark:text-white">
                {RUPEE_SYMBOL}{Math.round(itemPrice)}
              </span>
              {hasDiscount && (
                <span className="text-xs text-gray-400 line-through">
                  {RUPEE_SYMBOL}{Math.round(originalPrice)}
                </span>
              )}
            </div>
          </div>

          {/* Action Button: ADD / Counter */}
          {quantity > 0 ? (
            <div
              className="flex items-center bg-primary text-white rounded-xl shadow-md overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                className="px-2 py-1 hover:bg-black/20 transition-colors"
                onClick={handleDecrease}
              >
                <Minus className="w-3.5 h-3.5" />
              </button>
              <span className="px-2 text-xs font-bold min-w-[1.25rem] text-center">
                {quantity}
              </span>
              <button
                type="button"
                className="px-2 py-1 hover:bg-black/20 transition-colors"
                onClick={handleIncrease}
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <Button
              size="sm"
              onClick={handleAddToCart}
              className="rounded-xl h-8 px-4 text-xs font-bold uppercase tracking-wider bg-white dark:bg-black border border-primary text-primary hover:bg-primary hover:text-white shadow-sm transition-all duration-300 active:scale-95 flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" />
              ADD
            </Button>
          )}
        </div>
      </div>
    </motion.div>
  )
}

export default React.memo(FoodCard)
