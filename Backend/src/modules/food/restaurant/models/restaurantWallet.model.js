import mongoose from 'mongoose';

const restaurantWalletSchema = new mongoose.Schema(
  {
    restaurantId: { type: mongoose.Schema.Types.ObjectId, ref: 'FoodRestaurant', required: true, index: true },
    balance: { type: Number, default: 0 },
    lockedAmount: { type: Number, default: 0 },
  },
  {
    collection: 'food_restaurant_wallets',
    timestamps: true,
    strict: false,
  }
);

restaurantWalletSchema.index({ restaurantId: 1 }, { unique: true });

export const FoodRestaurantWallet = mongoose.models.FoodRestaurantWallet || mongoose.model('FoodRestaurantWallet', restaurantWalletSchema);
