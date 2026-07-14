import mongoose from 'mongoose';
const restaurantWithdrawalSchema = new mongoose.Schema(
    {
        restaurantId: { type: mongoose.Schema.Types.ObjectId, ref: 'FoodRestaurant', index: true },
        amount: { type: Number, default: 0 },
        status: { type: String, default: 'pending', index: true },
        adminNote: { type: String, trim: true, default: '' },
        rejectionReason: { type: String, trim: true, default: '' },
        transactionId: { type: String, trim: true, default: '' },
        processedAt: { type: Date, default: null }
    },
    {
        collection: 'food_restaurant_withdrawals',
        timestamps: true,
        strict: false
    }
);
export const FoodRestaurantWithdrawal = mongoose.models.FoodRestaurantWithdrawal || mongoose.model('FoodRestaurantWithdrawal', restaurantWithdrawalSchema);
