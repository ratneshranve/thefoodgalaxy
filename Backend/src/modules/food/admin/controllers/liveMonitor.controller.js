import { FoodRestaurant } from '../../restaurant/models/restaurant.model.js';
import { FoodDeliveryPartner } from '../../delivery/models/deliveryPartner.model.js';
import { FoodOrder } from '../../orders/models/order.model.js';

export async function getLiveMonitorStatus(req, res, next) {
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Fetch Online Restaurants
        const restaurants = await FoodRestaurant.find({ isAcceptingOrders: true, status: 'approved' })
            .select('restaurantName logo addressLine1 area city state schedules isAcceptingOrders')
            .lean();

        // Get orders for restaurants today
        const rOrders = await FoodOrder.aggregate([
            { $match: { createdAt: { $gte: today } } },
            { $group: {
                _id: '$restaurantId',
                totalOrders: { $sum: 1 },
                deliveredOrders: {
                    $sum: { $cond: [{ $eq: ['$status', 'delivered'] }, 1, 0] }
                },
                activeOrders: {
                    $sum: { $cond: [{ $in: ['$status', ['pending', 'accepted', 'processing', 'food-on-the-way']] }, 1, 0] }
                }
            }}
        ]);

        const rOrdersMap = {};
        rOrders.forEach(o => {
            rOrdersMap[o._id.toString()] = {
                totalOrders: o.totalOrders,
                deliveredOrders: o.deliveredOrders,
                activeOrders: o.activeOrders
            };
        });

        const formattedRestaurants = restaurants.map(r => ({
            ...r,
            stats: rOrdersMap[r._id.toString()] || { totalOrders: 0, deliveredOrders: 0, activeOrders: 0 }
        }));

        // Fetch Online Delivery Partners
        const deliveryPartners = await FoodDeliveryPartner.find({ availabilityStatus: 'online', status: 'approved' })
            .select('name phone profilePhoto lastLat lastLng lastLocationAt vehicleType vehicleNumber availabilityStatus')
            .lean();

        // Get active orders assigned to these delivery partners
        const dpIds = deliveryPartners.map(dp => dp._id);
        const activeOrdersForDp = await FoodOrder.find({
            'dispatch.deliveryPartnerId': { $in: dpIds },
            status: 'food-on-the-way'
        }).select('_id status deliveryAddress restaurantId dispatch.deliveryPartnerId').lean();

        const activeOrdersMap = {};
        activeOrdersForDp.forEach(o => {
            if (o.dispatch && o.dispatch.deliveryPartnerId) {
                activeOrdersMap[o.dispatch.deliveryPartnerId.toString()] = o;
            }
        });

        // Get delivered orders today for these partners
        const dpOrdersToday = await FoodOrder.aggregate([
            { $match: { 
                createdAt: { $gte: today },
                'dispatch.deliveryPartnerId': { $in: dpIds },
                status: 'delivered'
            }},
            { $group: {
                _id: '$dispatch.deliveryPartnerId',
                deliveredCount: { $sum: 1 }
            }}
        ]);

        const dpDeliveredMap = {};
        dpOrdersToday.forEach(o => {
            if (o._id) {
                dpDeliveredMap[o._id.toString()] = o.deliveredCount;
            }
        });

        const formattedDeliveryPartners = deliveryPartners.map(dp => ({
            ...dp,
            currentOrder: activeOrdersMap[dp._id.toString()] || null,
            deliveredToday: dpDeliveredMap[dp._id.toString()] || 0
        }));

        res.status(200).json({
            success: true,
            data: {
                restaurants: formattedRestaurants,
                deliveryPartners: formattedDeliveryPartners
            }
        });
    } catch (error) {
        next(error);
    }
}
