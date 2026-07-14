import mongoose from 'mongoose';
const foodAddonSchema = new mongoose.Schema(
    {
        restaurantId: { type: mongoose.Schema.Types.ObjectId, ref: 'FoodRestaurant', index: true },
        name: { type: String, trim: true, required: true },
        price: { type: Number, default: 0 },
        isDeleted: { type: Boolean, default: false, index: true },
        approvalStatus: {
            type: String,
            enum: ['pending', 'approved', 'rejected'],
            default: 'approved',
            index: true
        },
        status: { type: String, default: 'approved' }
    },
    {
        collection: 'food_addons',
        timestamps: true,
        strict: false
    }
);
export const FoodAddon = mongoose.models.FoodAddon || mongoose.model('FoodAddon', foodAddonSchema);
