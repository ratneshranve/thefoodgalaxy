import mongoose from 'mongoose';
const restaurantSupportTicketSchema = new mongoose.Schema(
    {
        restaurantId: { type: mongoose.Schema.Types.ObjectId, ref: 'FoodRestaurant', index: true },
        orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'FoodOrder', index: true },
        status: { type: String, default: 'open', index: true },
        subject: { type: String, trim: true, default: '' },
        description: { type: String, trim: true, default: '' },
        issueType: { type: String, trim: true, default: '' },
        adminResponse: { type: String, trim: true, default: '' }
    },
    {
        collection: 'food_restaurant_support_tickets',
        timestamps: true,
        strict: false
    }
);
export const FoodRestaurantSupportTicket = mongoose.models.FoodRestaurantSupportTicket || mongoose.model('FoodRestaurantSupportTicket', restaurantSupportTicketSchema);
