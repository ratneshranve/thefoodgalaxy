import mongoose from 'mongoose';

const locationSchema = new mongoose.Schema(
  {
    latitude: { type: Number, default: null },
    longitude: { type: Number, default: null },
    coordinates: { type: [Number], default: [] },
    formattedAddress: { type: String, default: '' },
  },
  { _id: false }
);

const diningSettingsSchema = new mongoose.Schema(
  {
    isEnabled: { type: Boolean, default: false },
    diningType: { type: String, default: '' },
  },
  { _id: false }
);

const foodRestaurantSchema = new mongoose.Schema(
  {
    restaurantName: { type: String, required: true, trim: true, default: 'The Food Galaxy' },
    slug: { type: String, trim: true, default: 'the-food-galaxy' },
    ownerPhone: { type: String, trim: true, default: '' },
    profileImage: { type: String, default: '' },
    coverImages: { type: [String], default: [] },
    addressLine1: { type: String, default: '' },
    area: { type: String, default: '' },
    city: { type: String, default: '' },
    state: { type: String, default: '' },
    discount: { type: Number, default: 0 },
    zoneId: { type: mongoose.Schema.Types.ObjectId, ref: 'FoodZone', default: null },
    pureVegRestaurant: { type: Boolean, default: false },
    isAcceptingOrders: { type: Boolean, default: true },
    location: { type: locationSchema, default: () => ({}) },
    diningSettings: { type: diningSettingsSchema, default: () => ({}) },
  },
  {
    collection: 'food_restaurants',
    timestamps: true,
    strict: false,
  }
);

foodRestaurantSchema.index({ restaurantName: 1 });
foodRestaurantSchema.index({ zoneId: 1 });

export const FoodRestaurant = mongoose.models.FoodRestaurant || mongoose.model('FoodRestaurant', foodRestaurantSchema);
