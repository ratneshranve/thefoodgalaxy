import { Link } from "react-router-dom";
import { Clock, Star } from "lucide-react";
import OptimizedImage from "@food/components/OptimizedImage";
import AddToCartButton from "@food/components/user/AddToCartButton";

const RUPEE_SYMBOL = "\u20B9";

const isVegFood = (item) => {
  const foodType = String(item?.foodType || "").toLowerCase();
  return item?.isVeg === true || (foodType.includes("veg") && !foodType.includes("non"));
};

const getFoodId = (item) => String(item?.id || item?._id || "");

const buildCartItem = (item) => ({
  id: getFoodId(item),
  name: item?.name || "Food item",
  price: Number(item?.price || 0),
  image: item?.image || "",
  restaurant: item?.restaurantName || item?.restaurant || "The Food Galaxy",
  restaurantId: item?.restaurantId || "",
  description: item?.description || "",
  originalPrice: item?.originalPrice || item?.price || 0,
  priceOnOtherPlatforms: item?.priceOnOtherPlatforms ?? null,
  otherPlatformGst: item?.otherPlatformGst ?? null,
  isVeg: isVegFood(item),
  foodType: item?.foodType || (isVegFood(item) ? "Veg" : "Non-Veg"),
});

export default function FoodDiscoveryCard({ item, className = "" }) {
  const id = getFoodId(item);
  const restaurantSlug = item?.restaurantSlug || item?.restaurantId || "";
  const detailTarget = restaurantSlug
    ? `/user/restaurants/${restaurantSlug}${id ? `?dish=${encodeURIComponent(id)}` : ""}`
    : "/user/cart";
  const rating = Number(item?.rating || 0);
  const deliveryTime = item?.estimatedDeliveryTime || item?.deliveryTime || "";

  return (
    <div className={`group overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md dark:border-gray-800 dark:bg-[#151515] ${className}`}>
      <Link to={detailTarget} className="block">
        <div className="relative aspect-[4/3] overflow-hidden bg-gray-100 dark:bg-gray-900">
          <OptimizedImage
            src={item?.image || ""}
            alt={item?.name || "Food item"}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            objectFit="cover"
          />
          <div className="absolute left-2 top-2 flex h-4 w-4 items-center justify-center rounded border border-white bg-white/90 shadow-sm">
            <span className={`h-2 w-2 rounded-full ${isVegFood(item) ? "bg-green-600" : "bg-red-600"}`} />
          </div>
          {rating > 0 && (
            <div className="absolute bottom-2 left-2 flex items-center gap-1 rounded-lg bg-black/75 px-2 py-1 text-[10px] font-bold text-white backdrop-blur">
              <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
              {rating.toFixed(1)}
            </div>
          )}
        </div>
      </Link>

      <div className="space-y-2 p-3">
        <Link to={detailTarget} className="block">
          <h3 className="line-clamp-1 text-sm font-black text-gray-950 dark:text-white sm:text-base">{item?.name || "Food item"}</h3>
          <p className="mt-0.5 line-clamp-1 text-[11px] font-medium text-gray-500 dark:text-gray-400">{item?.restaurantName || item?.categoryName || "The Food Galaxy"}</p>
        </Link>
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-base font-black text-gray-950 dark:text-white">{RUPEE_SYMBOL}{Math.round(Number(item?.price || 0))}</p>
            {deliveryTime ? (
              <p className="mt-0.5 flex items-center gap-1 text-[10px] font-semibold text-gray-500 dark:text-gray-400">
                <Clock className="h-3 w-3" /> {deliveryTime}
              </p>
            ) : null}
          </div>
          <AddToCartButton item={buildCartItem(item)} className="shrink-0" />
        </div>
      </div>
    </div>
  );
}