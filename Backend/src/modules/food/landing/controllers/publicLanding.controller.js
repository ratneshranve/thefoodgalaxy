import { getPublicGourmetRestaurants } from '../services/gourmet.service.js';
import { getLandingSettings } from '../services/landingSettings.service.js';
import { FoodHeroBanner } from '../models/heroBanner.model.js';
import { FoodUnder250Banner } from '../models/under250Banner.model.js';
import { FoodDiningBanner } from '../models/diningBanner.model.js';
import { FoodExploreIcon } from '../models/exploreIcon.model.js';
import { FoodRestaurant } from '../../restaurant/models/restaurant.model.js';
import { FoodItem } from '../../admin/models/food.model.js';
import { sendResponse } from '../../../../utils/response.js';
import mongoose from 'mongoose';

/** Public hero banners for user home: active only, sorted, with linkedRestaurants populated for click-through */
export const getPublicHeroBannersController = async (req, res, next) => {
    try {
        const { zoneId } = req.query;
        let docs = await FoodHeroBanner.find({ isActive: true })
            .sort({ sortOrder: 1, createdAt: -1 })
            .populate({
                path: 'linkedRestaurantIds',
                select: '_id restaurantName slug area city rating cuisines profileImage pureVegRestaurant zoneId',
                model: 'FoodRestaurant'
            })
            .lean();

        if (zoneId && mongoose.Types.ObjectId.isValid(zoneId)) {
            const targetZone = String(zoneId);
            docs = (docs || []).filter(banner => {
                const linked = banner.linkedRestaurantIds || [];
                if (linked.length === 0) return true;
                return linked.some(r => String(r.zoneId || '') === targetZone);
            });
        }

        const banners = (docs || []).map((b) => {
            const { linkedRestaurantIds, ...rest } = b;
            return {
                ...rest,
                linkedRestaurants: Array.isArray(linkedRestaurantIds) ? linkedRestaurantIds : [],
                imageUrl: b.imageUrl
            };
        });
        return sendResponse(res, 200, 'Hero banners fetched', { banners });
    } catch (error) {
        next(error);
    }
};

export const getPublicUnder250BannersController = async (req, res, next) => {
    try {
        const { zoneId } = req.query;
        const query = { isActive: true };
        if (zoneId) {
            query.$or = [
                { zoneId: String(zoneId) },
                { zoneId: { $in: [null, ""] } },
                { zoneId: { $exists: false } }
            ];
        }
        const docs = await FoodUnder250Banner.find(query).sort({ sortOrder: 1, createdAt: -1 }).lean();
        return sendResponse(res, 200, 'Under 250 banners fetched', { banners: docs });
    } catch (error) {
        next(error);
    }
};

export const getPublicDiningBannersController = async (req, res, next) => {
    try {
        const docs = await FoodDiningBanner.find({ isActive: true }).sort({ sortOrder: 1, createdAt: -1 }).lean();
        return sendResponse(res, 200, 'Dining banners fetched', { banners: docs });
    } catch (error) {
        next(error);
    }
};

export const getPublicExploreIconsController = async (req, res, next) => {
    try {
        const docs = await FoodExploreIcon.find({ isActive: true }).sort({ sortOrder: 1, createdAt: -1 }).lean();
        const items = docs.map(({ targetPath, sortOrder, ...rest }) => ({ ...rest, link: targetPath, order: sortOrder }));
        return sendResponse(res, 200, 'Explore icons fetched', { items });
    } catch (error) {
        next(error);
    }
};


export const getPublicGourmetController = async (req, res, next) => {
    try {
        const { zoneId } = req.query;
        const docs = await getPublicGourmetRestaurants();
        let restaurants = (docs || []).map((d) => ({
            ...(d.restaurant || {}),
            _id: d.restaurant?._id || d.restaurantId,
            zoneId: d.restaurant?.zoneId,
            priority: d.priority
        })).filter((r) => r && r._id);
        
        if (zoneId && mongoose.Types.ObjectId.isValid(zoneId)) {
            restaurants = restaurants.filter(r => String(r.zoneId || '') === String(zoneId));
        }
        
        return sendResponse(res, 200, 'Gourmet restaurants fetched', { restaurants });
    } catch (error) {
        next(error);
    }
};

export const getPublicLandingSettingsController = async (req, res, next) => {
    try {
        const { zoneId } = req.query;
        const settings = await getLandingSettings();
        const restaurantIds = settings?.recommendedRestaurantIds || [];
        const foodIds = settings?.recommendedFoodIds || [];
        let recommendedRestaurants = [];
        let recommendedFoods = [];

        if (Array.isArray(restaurantIds) && restaurantIds.length > 0) {
            const query = { _id: { $in: restaurantIds }, status: 'approved' };
            if (zoneId && mongoose.Types.ObjectId.isValid(zoneId)) {
                query.zoneId = new mongoose.Types.ObjectId(zoneId);
            }
            recommendedRestaurants = await FoodRestaurant.find(query)
                .select('restaurantName area city profileImage coverImages menuImages slug rating cuisines pureVegRestaurant')
                .lean();
        }

        if (Array.isArray(foodIds) && foodIds.length > 0) {
            const foodQuery = {
                _id: { $in: foodIds },
                approvalStatus: 'approved',
                isAvailable: { $ne: false }
            };
            const restaurantQuery = { status: 'approved' };
            if (zoneId && mongoose.Types.ObjectId.isValid(zoneId)) {
                restaurantQuery.zoneId = new mongoose.Types.ObjectId(zoneId);
            }
            const activeRestaurantIds = await FoodRestaurant.find(restaurantQuery).distinct('_id');
            foodQuery.restaurantId = { $in: activeRestaurantIds };

            const foods = await FoodItem.find(foodQuery)
                .select('restaurantId categoryId categoryName name description price priceOnOtherPlatforms variants image foodType isAvailable approvalStatus')
                .lean();
            const restaurantMap = new Map(
                (await FoodRestaurant.find({ _id: { $in: foods.map((food) => food.restaurantId).filter(Boolean) } })
                    .select('restaurantName profileImage coverImages menuImages rating estimatedDeliveryTime estimatedDeliveryTimeMinutes')
                    .lean())
                    .map((restaurant) => [String(restaurant._id), restaurant])
            );
            const foodMap = new Map(foods.map((food) => [String(food._id), food]));
            recommendedFoods = foodIds
                .map((id) => foodMap.get(String(id)))
                .filter(Boolean)
                .map((food) => {
                    const restaurant = restaurantMap.get(String(food.restaurantId)) || {};
                    const image = food.image || restaurant.profileImage || restaurant.coverImages?.[0] || restaurant.menuImages?.[0] || '';
                    const variantPrices = Array.isArray(food.variants) ? food.variants.map((variant) => Number(variant.price)).filter(Number.isFinite) : [];
                    const price = variantPrices.length ? Math.min(...variantPrices) : Number(food.price || 0);
                    return {
                        id: food._id,
                        _id: food._id,
                        restaurantId: food.restaurantId,
                        restaurantName: restaurant.restaurantName || '',
                        categoryId: food.categoryId || null,
                        categoryName: food.categoryName || '',
                        name: food.name,
                        description: food.description || '',
                        price,
                        priceOnOtherPlatforms: food.priceOnOtherPlatforms ?? null,
                        image,
                        foodType: food.foodType || 'Non-Veg',
                        isAvailable: food.isAvailable !== false,
                        rating: Number(restaurant.rating) || 0,
                        estimatedDeliveryTime: restaurant.estimatedDeliveryTime || '',
                        estimatedDeliveryTimeMinutes: restaurant.estimatedDeliveryTimeMinutes || null
                    };
                });
        }

        const payload = {
            ...settings,
            recommendedRestaurantIds: undefined,
            recommendedFoodIds: undefined,
            recommendedRestaurants,
            recommendedFoods
        };
        return sendResponse(res, 200, 'Landing settings fetched', payload);
    } catch (error) {
        next(error);
    }
};