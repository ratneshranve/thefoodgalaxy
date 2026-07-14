import { Plus, Minus } from "lucide-react"
import { Button } from "@food/components/ui/button"
import { useCart } from "@food/context/CartContext"
import { isModuleAuthenticated } from "@food/utils/auth"
import { useNavigate, useLocation } from "react-router-dom"
import { toast } from "sonner"

export default function AddToCartButton({ item, className = "", compact = false, label = null }) {
  const { addToCart, isInCart, getCartItem, updateQuantity } = useCart()
  const inCart = isInCart(item.id)
  const cartItem = getCartItem(item.id)
  const navigate = useNavigate()
  const location = useLocation()

  const handleAddToCart = (e) => {
    e.preventDefault()
    e.stopPropagation()

    if (!isModuleAuthenticated('user')) {
      toast.error("Please login to add items to cart")
      navigate('/user/auth/login', { state: { from: location.pathname } })
      return
    }

    addToCart(item)
  }

  const handleIncrease = (e) => {
    e.preventDefault()
    e.stopPropagation()
    updateQuantity(item.id, (cartItem?.quantity || 0) + 1)
  }

  const handleDecrease = (e) => {
    e.preventDefault()
    e.stopPropagation()
    updateQuantity(item.id, (cartItem?.quantity || 0) - 1)
  }

  if (inCart) {
    return (
      <div className={`flex items-center gap-2 ${className}`} onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}>
        <div
          className={`flex items-center gap-1 text-white rounded-xl shadow-sm ${compact ? "px-0.5" : ""}`}
          style={{
            background: 'linear-gradient(135deg, var(--user-brand-primary) 0%, #b20807 100%)',
            boxShadow: '0 10px 20px rgba(222,11,9,0.22)'
          }}
        >
          <Button
            variant="ghost"
            size="icon"
            className={`${compact ? "h-7 w-5" : "h-8 w-6"} text-white hover:text-white`}
            style={{ backgroundColor: 'transparent' }}
            onClick={handleDecrease}
          >
            <Minus className={`${compact ? "h-3.5 w-3.5" : "h-4 w-4"}`} />
          </Button>
          <span className={`${compact ? "px-0.5 text-xs min-w-[0.75rem]" : "px-1 text-sm min-w-[1rem]"} font-bold text-center text-white`}>
            {cartItem?.quantity || 0}
          </span>
          <Button
            variant="ghost"
            size="icon"
            className={`${compact ? "h-7 w-5" : "h-8 w-6"} text-white hover:text-white`}
            style={{ backgroundColor: 'transparent' }}
            onClick={handleIncrease}
          >
            <Plus className={`${compact ? "h-3.5 w-3.5" : "h-4 w-4"}`} />
          </Button>
        </div>
      </div>
    )
  }

  return (
    <Button
      size="sm"
      onClick={handleAddToCart}
      className={`${compact ? "h-8 px-3 text-xs rounded-xl" : "rounded-xl"} text-white font-bold shadow-md transition-all active:scale-95 ${className}`}
      style={{
        background: 'linear-gradient(135deg, var(--user-brand-primary) 0%, #b20807 100%)',
        boxShadow: '0 12px 24px rgba(222,11,9,0.22)'
      }}
    >
      {label || (compact ? "Add" : "Add to Cart")}
    </Button>
  )
}
