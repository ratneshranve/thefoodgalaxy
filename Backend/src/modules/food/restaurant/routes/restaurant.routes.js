import express from 'express';
import mongoose from 'mongoose';
import { getCategories as getAdminCategories, getFoods as getAdminFoods, getRestaurants as getAdminRestaurants } from '../../admin/services/admin.service.js';
import { getFoodDisplayPrice, serializeFoodVariants } from '../../admin/services/foodVariant.service.js';
import { FoodRestaurant } from '../models/restaurant.model.js';
import { FoodItem } from '../../admin/models/food.model.js';
import { FoodAddon } from '../models/foodAddon.model.js';

const router = express.Router();

const normalizeText = (value) => String(value || '').trim().toLowerCase();
const slugify = (value) => normalizeText(value).replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

const resolveRestaurantDocument = async (identifier) => {
  const raw = String(identifier || '').trim();
  if (!raw) return null;

  if (mongoose.Types.ObjectId.isValid(raw)) {
    const byId = await FoodRestaurant.findById(raw).lean();
    if (byId?._id) return byId;
  }

  const bySlug = await FoodRestaurant.findOne({ slug: raw }).lean();
  if (bySlug?._id) return bySlug;

  const restaurants = await FoodRestaurant.find({}).lean();
  const normalizedIdentifier = slugify(raw);
  return restaurants.find((restaurant) => {
    const candidateSlug = slugify(restaurant?.slug || restaurant?.restaurantName || restaurant?.name || '');
    const candidateName = slugify(restaurant?.restaurantName || restaurant?.name || '');
    return candidateSlug === normalizedIdentifier || candidateName === normalizedIdentifier;
  }) || null;
};

const buildPublicRestaurantPayload = (restaurant = {}) => ({
  ...restaurant,
  _id: restaurant._id,
  id: restaurant._id,
  restaurantId: restaurant._id,
  name: restaurant.restaurantName || restaurant.name || 'The Food Galaxy',
  restaurantName: restaurant.restaurantName || restaurant.name || 'The Food Galaxy',
  slug: restaurant.slug || slugify(restaurant.restaurantName || restaurant.name || 'the-food-galaxy'),
  isActive: restaurant.isActive !== false,
  status: restaurant.status || 'approved',
  cuisines: Array.isArray(restaurant.cuisines) ? restaurant.cuisines : [],
  rating: Number(restaurant.rating || 0),
  location: restaurant.location || {},
});

const buildMenuSectionsFromFoods = (foods = []) => {
  const sectionMap = new Map();

  foods.forEach((food) => {
    const sectionName = String(food.categoryName || 'Recommended').trim() || 'Recommended';
    if (!sectionMap.has(sectionName)) {
      sectionMap.set(sectionName, {
        id: slugify(sectionName) || `section-${sectionMap.size + 1}`,
        name: sectionName,
        items: [],
        subsections: [],
      });
    }

    const variants = serializeFoodVariants(food.variants || food.variations || []);

    sectionMap.get(sectionName).items.push({
      id: String(food._id || food.id),
      _id: String(food._id || food.id),
      name: food.name || 'Unnamed Item',
      description: food.description || '',
      price: getFoodDisplayPrice({ ...food, variants }),
      image: food.image || '',
      foodType: food.foodType || 'Non-Veg',
      isAvailable: food.isAvailable !== false,
      preparationTime: food.preparationTime || '',
      variants,
      variations: variants,
      categoryName: food.categoryName || sectionName,
      category: food.categoryName || sectionName,
      isRecommended: false,
    });
  });

  return Array.from(sectionMap.values());
};

router.get('/categories/public', async (req, res, next) => {
  try {
    const data = await getAdminCategories({
      ...req.query,
      isApproved: true,
      limit: req.query?.limit ?? '1000',
    });

    res.status(200).json({
      success: true,
      message: 'Public categories fetched successfully',
      data,
    });
  } catch (error) {
    next(error);
  }
});

router.get('/foods/public', async (req, res, next) => {
  try {
    const data = await getAdminFoods({
      ...req.query,
      singleStoreOnly: 'false',
      limit: req.query?.limit ?? '1000',
    });

    const foods = Array.isArray(data?.foods)
      ? data.foods.filter((food) => {
          if (food?.isAvailable === false) return false;
          const approvalStatus = String(food?.approvalStatus || 'approved').toLowerCase();
          return approvalStatus !== 'rejected' && approvalStatus !== 'pending';
        })
      : [];

    res.status(200).json({
      success: true,
      message: 'Public foods fetched successfully',
      data: {
        ...data,
        foods,
        total: foods.length,
      },
    });
  } catch (error) {
    next(error);
  }
});

router.get('/restaurants', async (req, res, next) => {
  try {
    const data = await getAdminRestaurants({
      ...req.query,
      limit: req.query?.limit ?? '1000',
    });

    const restaurants = Array.isArray(data?.restaurants)
      ? data.restaurants.filter((restaurant) => String(restaurant?.status || 'approved').toLowerCase() !== 'rejected')
      : [];

    res.status(200).json({
      success: true,
      message: 'Public restaurants fetched successfully',
      data: {
        ...data,
        restaurants,
        total: restaurants.length,
      },
    });
  } catch (error) {
    next(error);
  }
});

router.get('/offers', async (_req, res) => {
  res.status(200).json({ success: true, message: 'Public offers fetched successfully', data: { allOffers: [] } });
});

router.get('/restaurants/:idOrSlug', async (req, res, next) => {
  try {
    const restaurant = await resolveRestaurantDocument(req.params.idOrSlug);
    if (!restaurant?._id) {
      return res.status(404).json({ success: false, message: 'Restaurant not found' });
    }

    res.status(200).json({
      success: true,
      message: 'Public restaurant fetched successfully',
      data: buildPublicRestaurantPayload(restaurant),
    });
  } catch (error) {
    next(error);
  }
});

router.get('/restaurants/:idOrSlug/menu', async (req, res, next) => {
  try {
    const restaurant = await resolveRestaurantDocument(req.params.idOrSlug);
    if (!restaurant?._id) {
      return res.status(404).json({ success: false, message: 'Restaurant not found' });
    }

    const foods = await FoodItem.find({
      restaurantId: restaurant._id,
      isAvailable: { $ne: false },
      approvalStatus: { $nin: ['pending', 'rejected'] },
    })
      .sort({ categoryName: 1, createdAt: -1 })
      .lean();

    const sections = buildMenuSectionsFromFoods(foods);

    res.status(200).json({
      success: true,
      message: 'Public restaurant menu fetched successfully',
      data: {
        menu: { sections },
      },
    });
  } catch (error) {
    next(error);
  }
});

router.get('/restaurants/:idOrSlug/outlet-timings', async (req, res, next) => {
  try {
    const restaurant = await resolveRestaurantDocument(req.params.idOrSlug);
    if (!restaurant?._id) {
      return res.status(404).json({ success: false, message: 'Restaurant not found' });
    }

    res.status(200).json({ success: true, message: 'Outlet timings fetched successfully', data: { outletTimings: [] } });
  } catch (error) {
    next(error);
  }
});

router.get('/restaurants/:idOrSlug/addons', async (req, res, next) => {
  try {
    const restaurant = await resolveRestaurantDocument(req.params.idOrSlug);
    if (!restaurant?._id) {
      return res.status(404).json({ success: false, message: 'Restaurant not found' });
    }

    const addons = await FoodAddon.find({
      restaurantId: restaurant._id,
      isDeleted: { $ne: true },
      approvalStatus: { $nin: ['pending', 'rejected'] },
    }).lean();

    res.status(200).json({ success: true, message: 'Addons fetched successfully', data: { addons } });
  } catch (error) {
    next(error);
  }
});

const disabled = (_req, res) => {
  res.status(410).json({
    success: false,
    message: 'Restaurant module has been disabled. Use admin-managed food flows instead.',
  });
};

router.all('*', disabled);

export default router;
