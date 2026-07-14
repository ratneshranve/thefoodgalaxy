import mongoose from 'mongoose';
const outletTimingItemSchema = new mongoose.Schema(
    {
        day: { type: String, trim: true, default: '' },
        open: { type: String, trim: true, default: '' },
        close: { type: String, trim: true, default: '' },
        isClosed: { type: Boolean, default: false }
    },
    { _id: false }
);
const outletTimingsSchema = new mongoose.Schema(
    {
        restaurantId: { type: mongoose.Schema.Types.ObjectId, ref: 'FoodRestaurant', index: true },
        outletTimings: { type: [outletTimingItemSchema], default: [] }
    },
    {
        collection: 'food_restaurant_outlet_timings',
        timestamps: true,
        strict: false
    }
);
export const FoodRestaurantOutletTimings = mongoose.models.FoodRestaurantOutletTimings || mongoose.model('FoodRestaurantOutletTimings', outletTimingsSchema);
