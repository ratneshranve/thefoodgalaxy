import { useState, useCallback, useEffect, useMemo } from 'react';
import { getPublicFoods, restaurantAPI } from "@food/api";
import { foodImages } from "@food/constants/images";
import { normalizeImageUrl } from "@food/utils/common";

export const useCategoryData = (zoneId) => {
  const [categories, setCategories] = useState([]);
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [restaurantsData, setRestaurantsData] = useState([]);
  const [loadingRestaurants, setLoadingRestaurants] = useState(true);
  const [categoryKeywords, setCategoryKeywords] = useState({});

  const fetchCategories = useCallback(async () => {
    try {
      setLoadingCategories(true);
      const params = { limit: 1000 };
      if (zoneId) params.zoneId = zoneId;
      const data = await getPublicFoods(params);
      const foods = Array.isArray(data?.foods) ? data.foods : [];
      const categoryMap = new Map();

      foods.forEach((food, idx) => {
        const name = food?.categoryName || food?.category || food?.sectionName || "";
        const slug = String(name).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
        if (!name || !slug || categoryMap.has(slug)) return;
        categoryMap.set(slug, {
          id: slug,
          name,
          image: food?.image || food?.imageUrl || food?.thumbnail || foodImages[idx % foodImages.length],
          slug,
        });
      });

      const transformed = [{ id: 'all', name: "All", image: null, slug: 'all' }, ...categoryMap.values()];
      setCategories(transformed);

      const keywordsMap = {};
      transformed.slice(1).forEach((cat) => {
        const name = String(cat.name || "").toLowerCase();
        const words = name.split(/[\s-]+/).filter(w => w.length > 0);
        keywordsMap[cat.slug] = [name, ...words];
      });
      setCategoryKeywords(keywordsMap);
    } catch (err) {
      console.error("Failed to derive categories from foods", err);
    } finally {
      setLoadingCategories(false);
    }
  }, [zoneId]);

  const fetchRestaurants = useCallback(async () => {
    try {
      setLoadingRestaurants(true);
      const params = zoneId ? { zoneId } : {};
      const response = await restaurantAPI.getRestaurants(params);
      if (response.data?.success) {
        const raw = response.data.data.restaurants || [];
        const transformed = raw.map(r => ({
          ...r,
          id: r.restaurantId || r._id,
          image: normalizeImageUrl(r.profileImage?.url || r.image),
          slug: r.slug || r.name?.toLowerCase().replace(/\s+/g, '-')
        }));
        setRestaurantsData(transformed);
      }
    } catch (err) {
      console.error("Failed to fetch restaurants", err);
    } finally {
      setLoadingRestaurants(false);
    }
  }, [zoneId]);

  useEffect(() => {
    fetchCategories();
    fetchRestaurants();
  }, [fetchCategories, fetchRestaurants]);

  return {
    categories, loadingCategories,
    restaurantsData, loadingRestaurants,
    categoryKeywords
  };
};
