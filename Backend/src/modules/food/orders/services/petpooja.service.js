import { config } from '../../../../../config/env.js';
import { logger } from '../../../../../utils/logger.js';
import { FoodOrder, FoodSettings } from '../models/order.model.js';
import { FoodRestaurant } from '../../restaurant/models/restaurant.model.js';
import crypto from 'crypto';

/**
 * Pushes an order to Petpooja POS
 * Petpooja expects a very specific JSON payload structure.
 */
export async function pushOrderToPetpooja(orderMongoId) {
    try {
        // Check local ENV toggle first
        if (!config.petpoojaSyncEnabled) {
            logger.info(`[Petpooja] Global sync is disabled in .env (PETPOOJA_SYNC_ENABLED=false). Skipping.`);
            return;
        }

        // Check global kill switch in DB
        const globalSetting = await FoodSettings.findOne({ key: 'petpoojaGlobalSync' }).lean();
        if (globalSetting && globalSetting.petpoojaGlobalSync === false) {
            logger.info(`[Petpooja] Global sync is disabled. Skipping order ${orderMongoId}`);
            return;
        }

        if (!config.petpoojaAppKey || !config.petpoojaAppSecret) {
            logger.warn(`[Petpooja] Missing global AppKey or AppSecret in .env`);
            return;
        }

        // Fetch Order with Restaurant
        const order = await FoodOrder.findById(orderMongoId).populate('restaurantId').populate('userId');
        if (!order) throw new Error('Order not found');

        const restaurant = order.restaurantId;
        if (!restaurant || !restaurant.petpoojaSettings || !restaurant.petpoojaSettings.enabled) {
            logger.info(`[Petpooja] Not enabled for restaurant ${restaurant?._id}`);
            return; // Not enabled for this restaurant
        }

        const restID = restaurant.petpoojaSettings.restID;
        if (!restID) {
            throw new Error(`Missing restID for restaurant ${restaurant._id}`);
        }

        // Format Payload based on standard Petpooja Push API spec
        const payload = {
            restaurants: [{
                restID: restID,
                orderInfo: {
                    orderID: order.order_id || order._id.toString(),
                    preorder_date: order.scheduledAt ? order.scheduledAt.toISOString().split('T')[0] : '',
                    preorder_time: order.scheduledAt ? order.scheduledAt.toISOString().split('T')[1].substring(0, 5) : '',
                    // 1: Delivery, 2: PickUp, 3: DineIn
                    orderType: "1", 
                    discount: order.pricing.discount || 0,
                    taxes: order.pricing.tax || 0,
                    total: order.pricing.total || 0,
                    description: order.note || '',
                    customer: {
                        name: order.customerName || 'Guest',
                        email: order.userId?.email || '',
                        phone: order.customerPhone || '0000000000',
                        address: order.deliveryAddress?.street || '',
                        city: order.deliveryAddress?.city || ''
                    },
                    items: order.items.map(item => ({
                        itemid: item.itemId,
                        itemname: item.name,
                        price: item.price,
                        quantity: item.quantity,
                        variation_id: item.variantId || '',
                        variation_name: item.variantName || '',
                        description: item.notes || ''
                    })),
                    paymentInfo: {
                        // For Petpooja: usually COD, Online, etc.
                        payment_type: order.payment.method === 'cash' ? 'COD' : 'Online',
                        amount: order.pricing.total || 0,
                        status: order.payment.status === 'paid' ? 'Paid' : 'Pending'
                    }
                }
            }]
        };

        const bodyString = JSON.stringify(payload);
        
        // Petpooja Push Order endpoint (example standard endpoint)
        const PETPOOJA_URL = 'https://api.petpooja.com/V1/orders/create';

        const response = await fetch(PETPOOJA_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'app-key': config.petpoojaAppKey,
                'app-secret': config.petpoojaAppSecret
            },
            body: bodyString
        });

        const data = await response.json();

        // Check if Petpooja accepted it
        if (data && data.success) {
            order.petpoojaIntegration.syncStatus = 'synced';
            order.petpoojaIntegration.petpoojaOrderId = data.petpooja_order_id || '';
            order.petpoojaIntegration.lastSyncAttempt = new Date();
            await order.save();
            logger.info(`[Petpooja] Successfully synced order ${orderMongoId}`);
        } else {
            throw new Error(`Petpooja API Error: ${data.message || 'Unknown error'}`);
        }

    } catch (err) {
        logger.error(`[Petpooja] Failed to push order ${orderMongoId}: ${err.message}`);
        // Log failure in order doc
        await FoodOrder.updateOne(
            { _id: orderMongoId },
            { 
                $set: { 
                    'petpoojaIntegration.syncStatus': 'failed',
                    'petpoojaIntegration.lastSyncAttempt': new Date(),
                    'petpoojaIntegration.failureReason': err.message 
                } 
            }
        );
        throw err; // Re-throw to allow BullMQ to retry via exponential backoff
    }
}
