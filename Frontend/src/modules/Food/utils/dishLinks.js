// Helpers for food cards shown outside a restaurant page (home, under-250, search).

const getRestaurantRef = (item) => {
  const restaurantId =
    item?.restaurantId && typeof item.restaurantId === "object"
      ? item.restaurantId._id || item.restaurantId.id
      : item?.restaurantId
  return String(item?.restaurantSlug || restaurantId || item?.restaurant_id || "").trim()
}

/**
 * Path to the dish on its restaurant page. With `open: true` the dish sheet
 * (including the variant picker) opens automatically.
 * Returns null when the restaurant is unknown.
 */
export const getDishDetailPath = (item, { open = false } = {}) => {
  const restaurantRef = getRestaurantRef(item)
  if (!restaurantRef) return null
  const params = new URLSearchParams()
  const dishId = String(item?.id || item?._id || "").trim()
  if (dishId) params.set("dish", dishId)
  if (open) params.set("open", "1")
  const query = params.toString()
  return `/food/user/restaurants/${encodeURIComponent(restaurantRef)}${query ? `?${query}` : ""}`
}

export const foodHasVariants = (item) => {
  const variants = Array.isArray(item?.variants) && item.variants.length > 0
    ? item.variants
    : item?.variations
  return Array.isArray(variants) && variants.length > 0
}
