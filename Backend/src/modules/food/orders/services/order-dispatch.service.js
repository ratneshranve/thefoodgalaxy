import mongoose from 'mongoose';
import { FoodOrder, FoodSettings } from '../models/order.model.js';
import { FoodRestaurant } from '../../restaurant/models/restaurant.model.js';
import { FoodDeliveryPartner } from '../../delivery/models/deliveryPartner.model.js';
import { FoodDeliveryCashDeposit } from '../../delivery/models/foodDeliveryCashDeposit.model.js';
import { FoodDeliveryCashLimit } from '../../admin/models/deliveryCashLimit.model.js';
import { FoodFeeSettings } from '../../admin/models/feeSettings.model.js';
import { ValidationError, NotFoundError } from '../../../../core/auth/errors.js';
import { logger } from '../../../../utils/logger.js';
import { config } from '../../../../config/env.js';
import { getIO, rooms } from '../../../../config/socket.js';
import { addOrderJob, cancelDispatchTimeoutJob } from '../../../../queues/producers/order.producer.js';
import {
  buildDeliverySocketPayload,
  buildOrderIdentityFilter,
  haversineKm,
  notifyOwnerSafely,
  notifyOwnersSafely,
} from './order.helpers.js';
import {
  clearDeliveryOffersForOrder,
  publishDeliveryOfferToFirebase,
  removeDeliveryOffersForPartners,
} from './order-dispatch.firebase.js';

function upsertPartnerOffer(order, entry) {
  if (!order.dispatch.offeredTo) order.dispatch.offeredTo = [];
  const partnerIdStr = String(entry.partnerId);
  const existing = order.dispatch.offeredTo.find(
    (offer) => String(offer.partnerId) === partnerIdStr,
  );
  if (existing) {
    existing.action = 'offered';
    existing.at = entry.at || new Date();
    existing.allowOverLimit = Boolean(entry.allowOverLimit);
    existing.requiredCashForOrder = Number(entry.requiredCashForOrder || 0);
    return;
  }
  order.dispatch.offeredTo.push(entry);
}

async function filterPartnersByCashLimit(partners = [], options = {}) {
  // Since we are removing cash limit checks, we simply map partners to ensure they have expected shape.
  // We allow all partners to bypass cash limit.
  if (!Array.isArray(partners) || partners.length === 0) return [];
  
  return partners.map((p) => ({
    ...p,
    availableCashLimit: Number.MAX_SAFE_INTEGER,
    allowOverLimit: true,
    requiredCashForOrder: 0,
  }));
}

async function listNearbyOnlineDeliveryPartners(
  restaurantId,
  { maxKm = 15, limit = 25, requiredAmount = 0, allowOverLimitFallback = true } = {},
) {
  const rId = (restaurantId?._id || restaurantId).toString();
  const restaurant = await FoodRestaurant.findById(rId)
    .select("location")
    .lean();

  if (!restaurant?.location?.coordinates?.length) {
    // Restaurant has no GPS coordinates — cannot calculate distance to riders.
    // Return empty so no one gets notified until restaurant sets their location.
    logger.warn(`listNearbyOnlineDeliveryPartners: Restaurant ${rId} has no location coordinates. Skipping dispatch.`);
    return { restaurant: null, partners: [] };
  }

  const [rLng, rLat] = restaurant.location.coordinates;
  const allOnline = await FoodDeliveryPartner.find({
    availabilityStatus: "online",
  })
    .select("_id status lastLat lastLng lastLocationAt name")
    .lean();

  const scored = [];
  const allowedStatuses = ['approved'];
  const STALE_GPS_MS = 10 * 60 * 1000;

  for (const p of allOnline) {
    if (!allowedStatuses.includes(p.status)) continue;

    // Skip riders with no GPS data or stale location — they cannot be distance-verified
    const isStale = !p.lastLocationAt || (Date.now() - new Date(p.lastLocationAt).getTime()) > STALE_GPS_MS;
    if (p.lastLat == null || p.lastLng == null || isStale) {
      continue;
    }

    const d = haversineKm(rLat, rLng, p.lastLat, p.lastLng);
    if (Number.isFinite(d) && d <= maxKm) {
      scored.push({ partnerId: p._id, distanceKm: d, status: p.status });
    }
  }

  scored.sort((a, b) => a.distanceKm - b.distanceKm);
  const picked = scored.slice(0, Math.max(1, limit));

  // No fallback — if no riders found in radius, return empty.
  // The tiered dispatch will expand radius on next attempt automatically.
  if (picked.length === 0) {
    return { partners: [] };
  }

  const final = picked.filter(p => p.status === 'approved');

  const cashEligibleFinal = await filterPartnersByCashLimit(final, {
    requiredAmount,
    allowOverLimitFallback,
  });

  return { partners: cashEligibleFinal };
}

export async function getDispatchSettings() {
  return { dispatchMode: "auto" };
}

export async function updateDispatchSettings(dispatchMode, adminId) {
  // Always set to auto
  await FoodSettings.findOneAndUpdate(
    { key: "dispatch" },
    {
      $set: {
        dispatchMode: "auto",
        updatedBy: { role: "ADMIN", adminId, at: new Date() },
      },
    },
    { upsert: true, new: true },
  );
  return getDispatchSettings();
}

export async function tryAutoAssign(orderId, options = {}) {
  let attempt = options.attempt || 1;
  const lockTimeout = 20000; // 20 seconds lock interval

  const dispatchableStatuses = new Set([
    'confirmed',
    'preparing',
    'ready_for_pickup',
    'ready',
    'picked_up',
  ]);

  const order = await FoodOrder.findOneAndUpdate(
    {
      _id: new mongoose.Types.ObjectId(orderId),
      orderStatus: { $in: Array.from(dispatchableStatuses) },
      $or: [
        { 'dispatch.status': 'unassigned' },
        {
          'dispatch.status': 'assigned',
          'dispatch.acceptedAt': { $exists: false },
          'dispatch.assignedAt': { $lt: new Date(Date.now() - lockTimeout) }
        }
      ],
      'dispatch.dispatchingAt': { $exists: false }
    },
    {
      $set: { 'dispatch.dispatchingAt': new Date() }
    },
    { new: true }
  ).populate(['restaurantId', 'userId']);

  if (!order) {
    logger.info(`tryAutoAssign: Skip for ${orderId} (not dispatchable, already dispatching, accepted, or multi-attempt lock active).`);
    return null;
  }

  try {
    const paymentMethod = String(order.payment?.method || 'cash').toLowerCase();
    const isCashOrder = paymentMethod === 'cash';
    const requiredAmount = isCashOrder ? Number(order?.pricing?.total || 0) : 0;

    // RADIUS EXPANSION LOGIC
    const feeSettings = await FoodFeeSettings.findOne({ isActive: true }).lean();
    let radiusTiers = feeSettings?.dispatchRadiusTiers || [];
    if (!radiusTiers.length) {
      radiusTiers = [2, 4, 6, 8, 10, 15]; // Exact tiers requested: 2, 4, 6, 8, 10, 15
    }

    // CYCLE RESTART LOGIC: If we exceeded the maximum tiers, restart the cycle from 2km
    if (attempt > radiusTiers.length) {
      logger.info(`[Dispatch] Order ${order._id}: All ${radiusTiers.length} tiers exhausted (attempt was ${attempt}). Restarting cycle from 2km.`);
      attempt = 1;
      order.dispatch.offeredTo = []; // Clear history so all riders get a fresh chance
      order.dispatch.dispatchAttempt = 1;
      await order.save();
    }

    const maxKm = radiusTiers[attempt - 1];
    order.dispatch.dispatchAttempt = attempt;

    const searchOptions = {
      maxKm,
      limit: 10000, // Fetch all in the radius
      requiredAmount: 0,
      allowOverLimitFallback: true,
    };
    
    logger.info(`[Dispatch] Order ${order._id} attempt=${attempt} maxKm=${maxKm}`);
    const { partners } = await listNearbyOnlineDeliveryPartners(order.restaurantId, searchOptions);

    // Re-broadcast to every rider in this radius each attempt, including previously offered riders.
    const eligible = partners;

    if (eligible.length === 0) {
      logger.info(`[Dispatch] No eligible partners in ${maxKm}km for order ${order._id} (Attempt ${attempt}). Advancing to next tier.`);
      
      // No new riders in this radius. Advance to the next tier immediately.
      order.dispatch.status = 'unassigned';
      order.dispatch.deliveryPartnerId = null;
      await order.save();

      // Re-queue to check the next tier after a short delay (20s)
      await addOrderJob({
        action: 'DISPATCH_TIMEOUT_CHECK',
        orderMongoId: order._id.toString(),
        orderId: order._id.toString(),
        attempt: attempt + 1
      }, { delay: 20000 });

      return order;
    }

    const io = getIO();
    const payload = buildDeliverySocketPayload(order, order.restaurantId);

    // Broadcast to all eligible riders in this tier
    logger.info(`[Dispatch] Broadcasting order ${order._id} to ${eligible.length} riders at ${maxKm}km.`);
    const offeredAt = Date.now();
    for (const p of eligible) {
      const eventPayload = { ...payload, pickupDistanceKm: p.distanceKm, attempt, maxKm };
      const roomName = rooms.delivery(p.partnerId);
      if (io) {
        io.to(roomName).emit('new_order_available', eventPayload);
      }
      void publishDeliveryOfferToFirebase(p.partnerId, order._id.toString(), {
        ...eventPayload,
        type: 'new_order_available',
        offeredAt,
      });
    }

    // FCM Push for background/closed apps
    const notifyList = eligible.map(p => ({
      ownerType: 'DELIVERY_PARTNER',
      ownerId: p.partnerId,
    }));
    try {
      await notifyOwnersSafely(
        notifyList,
        {
          title: '🚴 New Order Nearby!',
          body: `Order #${order.order_id || order._id} is waiting. Be the first to accept!`,
          dataOnly: true,
          data: { type: 'new_order', orderId: order._id.toString() },
        },
      );
    } catch (err) {
      logger.warn(`Push notifications failed for batch: ${err.message}`);
    }

    // Record or refresh offers for every rider notified in this attempt.
    for (const p of eligible) {
      upsertPartnerOffer(order, {
        partnerId: p.partnerId,
        at: new Date(),
        action: 'offered',
        allowOverLimit: Boolean(p.allowOverLimit),
        requiredCashForOrder: Number(p.requiredCashForOrder || requiredAmount || 0),
      });
    }

    order.dispatch.status = 'unassigned';
    order.dispatch.deliveryPartnerId = null;
    order.markModified('dispatch.offeredTo');
    await order.save();

    // Re-check in 20s if no one accepts
    await addOrderJob({
      action: 'DISPATCH_TIMEOUT_CHECK',
      orderMongoId: order._id.toString(),
      orderId: order._id.toString(),
      attempt: attempt + 1
    }, { delay: 20000 });

    return order;
  } finally {
    await FoodOrder.findByIdAndUpdate(orderId, {
      $unset: { 'dispatch.dispatchingAt': '' },
    });
  }
}

export async function processDispatchTimeout(orderId, partnerId, options = {}) {
  const order = await FoodOrder.findById(orderId);
  if (!order) return;

  if (order.dispatch?.status === 'accepted') {
    return; // Already accepted, stop hunting.
  }

  const stillAssigned = order.dispatch?.status === 'assigned' &&
    String(order.dispatch?.deliveryPartnerId) === String(partnerId) &&
    !order.dispatch?.acceptedAt;

  if (stillAssigned) {
    logger.info(`[Dispatch] Timeout for assigned partner ${partnerId} on order ${orderId}. Moving to next tier.`);
    const offer = order.dispatch.offeredTo.find(
      o => String(o.partnerId) === String(partnerId) && o.action === 'offered'
    );
    if (offer) offer.action = 'timeout';
    
    order.dispatch.status = 'unassigned';
    order.dispatch.deliveryPartnerId = null;
    await order.save();
    
    const attempt = options.attempt || (order.dispatch?.offeredTo?.length || 0) + 1;
    await tryAutoAssign(orderId, { attempt });

  } else if (order.dispatch?.status === 'unassigned') {
    // Broadcast timeout: Mark ALL currently 'offered' riders as 'timeout'
    let updated = false;
    const timedOutPartnerIds = [];
    for (const entry of (order.dispatch?.offeredTo || [])) {
      if (entry.action === 'offered') {
        entry.action = 'timeout';
        if (entry?.partnerId) timedOutPartnerIds.push(String(entry.partnerId));
        updated = true;
      }
    }
    
    if (updated) {
      logger.info(`[Dispatch] Marked broadcasted offers as timeout for order ${orderId}. Advancing cycle.`);
      await order.save();
      void removeDeliveryOffersForPartners(timedOutPartnerIds, String(order._id));
    }

    const attempt = options.attempt || 1;
    await tryAutoAssign(orderId, { attempt });
  }
}


const RESEND_SEARCH_RADIUS_KM = 15;

async function resendDeliveryNotificationForOrder(order) {
  const activeStatuses = ['confirmed', 'preparing', 'ready_for_pickup', 'ready'];
  if (!activeStatuses.includes(order.orderStatus)) {
    throw new ValidationError(`Cannot resend notification for order in status: ${order.orderStatus}`);
  }

  if (order.dispatch?.status === 'accepted') {
    throw new ValidationError('A delivery partner has already accepted this order.');
  }

  const paymentMethod = String(order.payment?.method || 'cash').toLowerCase();
  const requiredAmount = paymentMethod === 'cash' ? Number(order?.pricing?.total || 0) : 0;
  const preview = await listNearbyOnlineDeliveryPartners(order.restaurantId, {
    maxKm: RESEND_SEARCH_RADIUS_KM,
    limit: 10000,
    requiredAmount,
    allowOverLimitFallback: true,
  });
  const shortlistedCount = Array.isArray(preview?.partners) ? preview.partners.length : 0;

  await cancelDispatchTimeoutJob(String(order._id));
  order.dispatch.status = 'unassigned';
  order.dispatch.deliveryPartnerId = null;
  order.dispatch.dispatchAttempt = 1;
  order.dispatch.offeredTo = [];
  await order.save();

  await tryAutoAssign(order._id, { attempt: 1 });

  const refreshed = await FoodOrder.findById(order._id)
    .select('dispatch.offeredTo dispatch.status dispatch.deliveryPartnerId')
    .lean();
  const notifiedCount = Array.isArray(refreshed?.dispatch?.offeredTo)
    ? refreshed.dispatch.offeredTo.filter((entry) => entry?.action === 'offered').length
    : 0;
  const notifiedPartnerIds = Array.isArray(refreshed?.dispatch?.offeredTo)
    ? refreshed.dispatch.offeredTo
        .filter((entry) => entry?.action === 'offered' && entry?.partnerId)
        .map((entry) => String(entry.partnerId))
    : [];
  const io = getIO();
  const connectedSocketCount = io
    ? notifiedPartnerIds.reduce((count, pid) => {
        const roomName = rooms.delivery(pid);
        const roomSize = io?.sockets?.adapter?.rooms?.get(roomName)?.size || 0;
        return count + roomSize;
      }, 0)
    : 0;

  return {
    success: true,
    notifiedCount,
    shortlistedCount,
    requiredAmount,
    connectedSocketCount,
    searchRadiusKm: RESEND_SEARCH_RADIUS_KM,
    dispatchStatus: refreshed?.dispatch?.status || 'unassigned',
  };
}

export async function resendDeliveryNotificationRestaurant(orderId, restaurantId) {
  const identity = buildOrderIdentityFilter(orderId);
  const order = await FoodOrder.findOne({
    ...identity,
    restaurantId: new mongoose.Types.ObjectId(restaurantId),
  });

  if (!order) throw new NotFoundError('Order not found');
  return resendDeliveryNotificationForOrder(order);
}

export async function resendDeliveryNotificationAdmin(orderId) {
  const identity = buildOrderIdentityFilter(orderId);
  const order = await FoodOrder.findOne(identity);
  if (!order) throw new NotFoundError('Order not found');
  return resendDeliveryNotificationForOrder(order);
}

/** Cancel any queued dispatch timeout job for an order. */
export async function cancelPendingDispatchJob(orderId) {
  await cancelDispatchTimeoutJob(String(orderId));
}

/** Reset dispatch hunt state when restaurant first accepts an order. */
export async function resetDispatchForFreshHunt(orderId) {
  await cancelDispatchTimeoutJob(String(orderId));
  await FoodOrder.findByIdAndUpdate(orderId, {
    $set: {
      'dispatch.status': 'unassigned',
      'dispatch.dispatchAttempt': 1,
      'dispatch.offeredTo': [],
    },
    $unset: {
      'dispatch.dispatchingAt': '',
      'dispatch.deliveryPartnerId': '',
    },
  });
}
