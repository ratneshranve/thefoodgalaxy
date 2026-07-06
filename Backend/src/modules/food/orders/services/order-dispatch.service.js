import mongoose from 'mongoose';
import { FoodOrder, FoodSettings } from '../models/order.model.js';
import { FoodRestaurant } from '../../restaurant/models/restaurant.model.js';
import { FoodDeliveryPartner } from '../../delivery/models/deliveryPartner.model.js';
import { FoodFeeSettings } from '../../admin/models/feeSettings.model.js';
import { ValidationError, NotFoundError } from '../../../../core/auth/errors.js';
import { logger } from '../../../../utils/logger.js';
import { getIO, rooms } from '../../../../config/socket.js';
import {
  cancelDispatchTimeoutJob,
  scheduleDispatchTimeoutJob,
} from '../../../../queues/producers/order.producer.js';
import {
  buildDeliverySocketPayload,
  buildOrderIdentityFilter,
  haversineKm,
  notifyOwnersSafely,
} from './order.helpers.js';

const NOTIFICATION_BATCH_SIZE = 50;
const DISPATCH_RETRY_DELAY_MS = 20000;
const DISPATCH_LOCK_RETRY_MS = 5000;
const DISPATCH_LOCK_TIMEOUT_MS = 20000;
const PARTNER_SEARCH_LIMIT = 50;
const DEFAULT_RADIUS_TIERS = [2, 4, 6, 8, 15];

async function batchedNotifyOwnersSafely(targets, payload) {
  if (!Array.isArray(targets) || targets.length === 0) return;

  for (let i = 0; i < targets.length; i += NOTIFICATION_BATCH_SIZE) {
    const chunk = targets.slice(i, i + NOTIFICATION_BATCH_SIZE);
    await notifyOwnersSafely(chunk, payload);

    if (i + NOTIFICATION_BATCH_SIZE < targets.length) {
      await new Promise((resolve) => setImmediate(resolve));
    }
  }
}

async function filterPartnersByCashLimit(partners = [], options = {}) {
  if (!Array.isArray(partners) || partners.length === 0) return [];

  return partners.map((p) => ({
    ...p,
    availableCashLimit: Number.MAX_SAFE_INTEGER,
    allowOverLimit: true,
    requiredCashForOrder: 0,
  }));
}

async function getDispatchRadiusConfig() {
  const feeSettings = await FoodFeeSettings.findOne({ isActive: true }).lean();
  const tiers = Array.isArray(feeSettings?.dispatchRadiusTiers) && feeSettings.dispatchRadiusTiers.length > 0
    ? feeSettings.dispatchRadiusTiers.map(Number).filter((n) => Number.isFinite(n) && n > 0)
    : DEFAULT_RADIUS_TIERS;

  return {
    tiers: tiers.length > 0 ? tiers : DEFAULT_RADIUS_TIERS,
    expansionEnabled: feeSettings?.dispatchRadiusExpansionEnabled !== false,
  };
}

function getMaxKmForAttempt(attempt, radiusTiers, expansionEnabled = true) {
  if (!Array.isArray(radiusTiers) || radiusTiers.length === 0) {
    return DEFAULT_RADIUS_TIERS[DEFAULT_RADIUS_TIERS.length - 1];
  }
  if (!expansionEnabled) {
    return radiusTiers[radiusTiers.length - 1];
  }
  const index = Math.min(Math.max(1, attempt) - 1, radiusTiers.length - 1);
  return radiusTiers[index];
}

function resolveDispatchAttempt(order, options = {}) {
  if (options.attempt != null && Number.isFinite(Number(options.attempt))) {
    return Math.max(1, Number(options.attempt));
  }
  const stored = Number(order?.dispatch?.dispatchAttempt);
  if (Number.isFinite(stored) && stored >= 1) return stored;
  return 1;
}

/** Partner IDs with an active (unanswered) offer — rejected/timeout riders can be re-offered. */
function getActiveOfferedPartnerIds(offeredTo = []) {
  return new Set(
    (offeredTo || [])
      .filter((entry) => entry?.action === 'offered' && entry?.partnerId)
      .map((entry) => String(entry.partnerId)),
  );
}

function mergeOfferedToEntries(existing = [], incoming = []) {
  const merged = Array.isArray(existing) ? [...existing] : [];
  for (const entry of incoming) {
    const partnerId = String(entry.partnerId);
    const idx = merged.findIndex((item) => String(item.partnerId) === partnerId);
    if (idx >= 0) {
      merged[idx] = { ...merged[idx], ...entry, partnerId: entry.partnerId };
    } else {
      merged.push(entry);
    }
  }
  return merged;
}

async function notifyPartners(order, restaurantRef, partners, { title, body } = {}) {
  if (!Array.isArray(partners) || partners.length === 0) {
    logger.info(`[PM2 LOG] notifyPartners: No partners to notify for order ${order._id}`);
    return;
  }

  const io = getIO();
  const payload = buildDeliverySocketPayload(order, restaurantRef);
  const pushTitle = title || '🚴 New Order Nearby!';
  const pushBody =
    body ||
    `Order #${order.order_id || order._id} is waiting. Be the first to accept!`;

  logger.info(`[PM2 LOG] notifyPartners: Preparing to notify ${partners.length} riders for order ${order._id}`);

  for (const p of partners) {
    const roomName = rooms.delivery(p.partnerId);
    if (io) {
      logger.info(`[PM2 LOG] notifyPartners: Emitting 'new_order_available' to room [${roomName}] for rider ${p.partnerId}`);
      io.to(roomName).emit('new_order_available', {
        ...payload,
        pickupDistanceKm: p.distanceKm,
      });
    } else {
      logger.error(`[PM2 LOG] notifyPartners: IO is not available! Could not emit socket to ${p.partnerId}`);
    }
  }

  const notifyList = partners.map((p) => ({
    ownerType: 'DELIVERY_PARTNER',
    ownerId: p.partnerId,
  }));

  try {
    logger.info(`[PM2 LOG] notifyPartners: Sending FCM Push Notifications to ${notifyList.length} riders...`);
    await batchedNotifyOwnersSafely(notifyList, {
      title: pushTitle,
      body: pushBody,
      dataOnly: true,
      data: { type: 'new_order', orderId: order._id.toString() },
    });
    logger.info(`[PM2 LOG] notifyPartners: FCM Push Notifications sent successfully.`);
  } catch (err) {
    logger.error(`[PM2 LOG] Push notifications failed: ${err.message}`);
  }
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
    logger.warn(`listNearbyOnlineDeliveryPartners: Restaurant ${rId} has no location coordinates. Skipping dispatch.`);
    return { restaurant: null, partners: [] };
  }

  const [rLng, rLat] = restaurant.location.coordinates;

  const geoNearPipeline = [
    {
      $geoNear: {
        near: { type: 'Point', coordinates: [rLng, rLat] },
        distanceField: 'distanceMeters',
        maxDistance: maxKm * 1000,
        spherical: true,
        query: {
          availabilityStatus: 'online',
          status: 'approved',
          'lastLocation.coordinates': { $exists: true },
        },
      },
    },
    {
      $project: {
        _id: 1,
        status: 1,
        distanceMeters: 1,
      },
    },
    { $sort: { distanceMeters: 1 } },
    { $limit: Math.max(1, limit) },
  ];

  let picked;
  try {
    const geoResults = await FoodDeliveryPartner.aggregate(geoNearPipeline);
    picked = geoResults.map((p) => ({
      partnerId: p._id,
      distanceKm: Number((p.distanceMeters / 1000).toFixed(2)),
      status: p.status,
    }));
  } catch (geoErr) {
    logger.warn(`[Dispatch] $geoNear failed, using JS fallback: ${geoErr.message}`);
    const allOnline = await FoodDeliveryPartner.find({ availabilityStatus: 'online' })
      .select('_id status lastLat lastLng')
      .lean();
    const scored = [];
    for (const p of allOnline) {
      if (p.status !== 'approved') continue;
      if (p.lastLat == null || p.lastLng == null) continue;
      const d = haversineKm(rLat, rLng, p.lastLat, p.lastLng);
      if (Number.isFinite(d) && d <= maxKm) {
        scored.push({ partnerId: p._id, distanceKm: d, status: p.status });
      }
    }
    scored.sort((a, b) => a.distanceKm - b.distanceKm);
    picked = scored.slice(0, Math.max(1, limit));
  }

  if (picked.length === 0) {
    return { partners: [] };
  }

  let busyPartnerIds = new Set();
  try {
    const activeOrderDocs = await FoodOrder.find({
      'dispatch.status': 'accepted',
      orderStatus: { $in: ['confirmed', 'preparing', 'ready_for_pickup', 'picked_up'] },
      createdAt: { $gte: new Date(Date.now() - 1 * 60 * 60 * 1000) }
    }).select('dispatch.deliveryPartnerId').lean();

    for (const doc of activeOrderDocs) {
      if (doc?.dispatch?.deliveryPartnerId) {
        busyPartnerIds.add(doc.dispatch.deliveryPartnerId.toString());
      }
    }

    if (busyPartnerIds.size > 0) {
      logger.info(`[Dispatch] Excluding ${busyPartnerIds.size} busy rider(s) from new order notification.`);
    }
  } catch (err) {
    logger.warn(`[Dispatch] Could not fetch busy riders: ${err.message}. Proceeding without exclusion.`);
    busyPartnerIds = new Set();
  }

  const final = picked.filter(p => !busyPartnerIds.has(p.partnerId.toString()));
  logger.info(`[PM2 LOG] listNearbyOnlineDeliveryPartners: Filtered busy riders. Final count: ${final.length}`);

  const cashEligibleFinal = await filterPartnersByCashLimit(final, {
    requiredAmount,
    allowOverLimitFallback,
  });

  logger.info(`[PM2 LOG] listNearbyOnlineDeliveryPartners: Cash eligible final count: ${cashEligibleFinal.length}`);
  return { partners: cashEligibleFinal };
}

export async function getDispatchSettings() {
  return { dispatchMode: "auto" };
}

export async function updateDispatchSettings(dispatchMode, adminId) {
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
  const lockTimeout = DISPATCH_LOCK_TIMEOUT_MS;
  const staleLockBefore = new Date(Date.now() - lockTimeout);

  const dispatchableStatuses = new Set([
    'created',
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
      $and: [
        {
          $or: [
            { 'dispatch.status': 'unassigned' },
            {
              'dispatch.status': 'assigned',
              'dispatch.acceptedAt': { $exists: false },
              'dispatch.assignedAt': { $lt: staleLockBefore }
            }
          ],
        },
        {
          $or: [
            { 'dispatch.dispatchingAt': { $exists: false } },
            { 'dispatch.dispatchingAt': null },
            { 'dispatch.dispatchingAt': { $lt: staleLockBefore } },
          ],
        },
      ],
    },
    {
      $set: { 'dispatch.dispatchingAt': new Date() }
    },
    { new: true }
  ).populate(['restaurantId', 'userId']);

  if (!order) {
    logger.warn(`[PM2 LOG] tryAutoAssign: LOCK FAILED for ${orderId}. Either status is not dispatchable, already accepted, or lock is currently active.`);
    return null;
  }
  
  logger.info(`[PM2 LOG] tryAutoAssign: Lock acquired successfully for order ${orderId}. Proceeding with hunt...`);

  let attempt = resolveDispatchAttempt(order, options);
  const forceNotify = Boolean(options.forceNotify);

  try {
    const paymentMethod = String(order.payment?.method || 'cash').toLowerCase();
    const isCashOrder = paymentMethod === 'cash';
    const requiredAmount = isCashOrder ? Number(order?.pricing?.total || 0) : 0;

    const dispatchRadiusConfig = await getDispatchRadiusConfig();
    const radiusTiers = dispatchRadiusConfig.tiers;
    const expansionEnabled = dispatchRadiusConfig.expansionEnabled;

    // CYCLE RESTART: If all radius tiers have been exhausted, reset back to
    // attempt 1 and clear the offeredTo list so every rider becomes eligible
    // again.  This makes the full 2→4→6→8→15 km cycle repeat indefinitely
    // until a rider accepts or the order is cancelled/dead.
    if (expansionEnabled && attempt > radiusTiers.length) {
      logger.info(
        `[Dispatch] Order ${order._id}: All ${radiusTiers.length} tiers exhausted (attempt was ${attempt}). Restarting cycle from attempt 1.`,
      );
      attempt = 1;
      order.dispatch.offeredTo = [];
      order.dispatch.dispatchAttempt = 1;
      await order.save();
    }

    const maxKm = getMaxKmForAttempt(attempt, radiusTiers, expansionEnabled);
    const isMaxTier = !expansionEnabled || attempt >= radiusTiers.length;
    const isPhase2 = attempt >= 4;
    const isPhase3 = attempt >= 6;

    const activeOfferIds = getActiveOfferedPartnerIds(order.dispatch?.offeredTo);

    logger.info(
      `[Dispatch] Order ${order._id} attempt=${attempt} maxKm=${maxKm} expansionEnabled=${expansionEnabled} forceNotify=${forceNotify}`,
    );

    const { partners } = await listNearbyOnlineDeliveryPartners(order.restaurantId, {
      maxKm,
      limit: PARTNER_SEARCH_LIMIT,
      requiredAmount: 0,
      allowOverLimitFallback: true,
    });

    if (isPhase3) {
      logger.error(
        `[CRITICAL] Order ${order._id} unassigned after ${attempt} dispatch cycles. Triggering Admin Alert.`,
      );
      try {
        await notifyOwnersSafely(
          [{ ownerType: 'ADMIN', ownerId: 'GLOBAL' }],
          {
            title: 'Unassigned Order Crisis!',
            body: `Order #${order.order_id || order._id} has not been picked up. Manual intervention required!`,
            data: { type: 'admin_alert_unassigned', orderId: order._id.toString() }
          }
        );
      } catch (err) {
        logger.warn(`Admin notification failed: ${err.message}`);
      }
    }

    const eligible = forceNotify
      ? partners
      : partners.filter((p) => !activeOfferIds.has(p.partnerId.toString()));

    const nextAttempt = attempt + 1;

    if (eligible.length === 0) {
      const shouldRebroadcast = (isMaxTier || isPhase2) && partners.length > 0;

      if (shouldRebroadcast) {
        logger.info(
          `[Dispatch] No new riders at ${maxKm}km (attempt ${attempt}). Re-broadcasting to ${partners.length} rider(s) at max/phase-2 tier.`,
        );
        await notifyPartners(order, order.restaurantId, partners, {
          title: '🚴 Order Still Waiting!',
          body: `Order #${order.order_id || order._id} needs a delivery partner. Accept now!`,
        });
      } else {
        logger.info(
          `[Dispatch] No new riders at ${maxKm}km (attempt ${attempt}). Advancing to attempt ${nextAttempt}.`,
        );
      }

      order.dispatch.status = 'unassigned';
      order.dispatch.deliveryPartnerId = null;
      order.dispatch.dispatchAttempt = nextAttempt;
      await order.save();

      await scheduleDispatchTimeoutJob(
        order._id.toString(),
        {
          action: 'DISPATCH_TIMEOUT_CHECK',
          orderMongoId: order._id.toString(),
          orderId: order._id.toString(),
          attempt: nextAttempt,
        },
        DISPATCH_RETRY_DELAY_MS,
      );

      return order;
    }

    const targets = eligible;

    if (isPhase2) {
      logger.info(`[Phase 2] Broadcasting order ${order._id} to ${targets.length} riders at ${maxKm}km.`);
    } else {
      const lead = targets[0];
      if (lead) {
        logger.info(
          `[Phase 1] Offering order ${order._id} to ${targets.length} riders (lead ${lead.partnerId}, ${lead.distanceKm}km)`,
        );
      }
    }

    const offeredToEntries = targets.map((p) => ({
      partnerId: p.partnerId,
      at: new Date(),
      action: 'offered',
      allowOverLimit: Boolean(p.allowOverLimit),
      requiredCashForOrder: Number(p.requiredCashForOrder || requiredAmount || 0),
    }));

    order.dispatch.status = 'unassigned';
    order.dispatch.deliveryPartnerId = null;
    order.dispatch.dispatchAttempt = attempt;
    order.dispatch.offeredTo = mergeOfferedToEntries(order.dispatch?.offeredTo, offeredToEntries);
    await order.save();

    logger.info(`[PM2 LOG] tryAutoAssign: Successfully saved order ${order._id} with new offeredTo entries. Sending notifications...`);
    await notifyPartners(order, order.restaurantId, targets);

    logger.info(`[PM2 LOG] tryAutoAssign: Scheduling dispatch timeout job for attempt ${nextAttempt} in ${DISPATCH_RETRY_DELAY_MS}ms...`);
    await scheduleDispatchTimeoutJob(
      order._id.toString(),
      {
        action: 'DISPATCH_TIMEOUT_CHECK',
        orderMongoId: order._id.toString(),
        orderId: order._id.toString(),
        attempt: nextAttempt,
      },
      DISPATCH_RETRY_DELAY_MS,
    );
    logger.info(`[PM2 LOG] tryAutoAssign: Timeout job scheduled successfully for order ${order._id}`);

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

  // Order already accepted by a rider — nothing to do.
  if (order.dispatch?.status === 'accepted') {
    await cancelDispatchTimeoutJob(orderId);
    return;
  }

  // Order reached a terminal state — stop the dispatch cycle.
  const terminalStatuses = new Set([
    'delivered', 'cancelled_by_user', 'cancelled_by_restaurant', 'cancelled_by_admin', 'dead',
  ]);
  if (terminalStatuses.has(order.orderStatus)) {
    await cancelDispatchTimeoutJob(orderId);
    return;
  }

  const attempt = resolveDispatchAttempt(order, options);

  // Case 1: A specific partner was assigned but didn't respond.
  const stillAssigned = order.dispatch?.status === 'assigned' &&
    partnerId &&
    String(order.dispatch?.deliveryPartnerId) === String(partnerId) &&
    !order.dispatch?.acceptedAt;

  if (stillAssigned) {
    logger.info(`Dispatch timeout for partner ${partnerId} on order ${orderId}. Re-trying hunt...`);
    const offer = (order.dispatch.offeredTo || []).find(
      o => String(o.partnerId) === String(partnerId) && o.action === 'offered'
    );
    if (offer) offer.action = 'timeout';

    order.dispatch.status = 'unassigned';
    order.dispatch.deliveryPartnerId = null;
    await order.save();
  } else if (order.dispatch?.status === 'unassigned') {
    // Case 2: Broadcast-style timeout — no specific partner was assigned.
    // Mark all currently-offered riders as 'timeout' so the next attempt
    // treats them as "already tried" and can expand to the next tier.
    let markedCount = 0;
    for (const entry of (order.dispatch.offeredTo || [])) {
      if (entry.action === 'offered') {
        entry.action = 'timeout';
        markedCount++;
      }
    }
    if (markedCount > 0) {
      await order.save();
      logger.info(`[Dispatch] Marked ${markedCount} stale offers as 'timeout' for order ${orderId}.`);
    }
  } else {
    logger.warn(`[PM2 LOG] processDispatchTimeout: Unexpected status for order ${orderId} -> ${order.dispatch?.status}. Skipping timeout.`);
    return;
  }

  logger.info(`[PM2 LOG] processDispatchTimeout: Triggering tryAutoAssign for order ${orderId} with attempt ${attempt}...`);
  const result = await tryAutoAssign(orderId, { attempt });
  
  if (!result) {
    logger.warn(`[PM2 LOG] processDispatchTimeout: tryAutoAssign skipped/failed for ${orderId} (attempt ${attempt}). Retrying in ${DISPATCH_LOCK_RETRY_MS}ms...`);
    await scheduleDispatchTimeoutJob(
      orderId,
      {
        action: 'DISPATCH_TIMEOUT_CHECK',
        orderMongoId: String(orderId),
        orderId: String(orderId),
        attempt,
      },
      DISPATCH_LOCK_RETRY_MS,
    );
  } else {
    logger.info(`[PM2 LOG] processDispatchTimeout: tryAutoAssign succeeded for order ${orderId}. Timeout cycle advanced.`);
  }
}


export async function resendDeliveryNotificationRestaurant(orderId, restaurantId) {
  const identity = buildOrderIdentityFilter(orderId);
  const order = await FoodOrder.findOne({
    ...identity,
    restaurantId: new mongoose.Types.ObjectId(restaurantId),
  });

  if (!order) throw new NotFoundError('Order not found');

  const activeStatuses = ['confirmed', 'preparing', 'ready_for_pickup', 'ready'];
  if (!activeStatuses.includes(order.orderStatus)) {
    throw new ValidationError(`Cannot resend notification for order in status: ${order.orderStatus}`);
  }

  if (order.dispatch?.status === 'accepted') {
    throw new ValidationError('A delivery partner has already accepted this order.');
  }

  const paymentMethod = String(order.payment?.method || 'cash').toLowerCase();
  const requiredAmount = paymentMethod === 'cash' ? Number(order?.pricing?.total || 0) : 0;

  const dispatchRadiusConfig = await getDispatchRadiusConfig();
  const radiusTiers = dispatchRadiusConfig.tiers;
  const currentAttempt = resolveDispatchAttempt(order, {});
  const previewMaxKm = getMaxKmForAttempt(currentAttempt, radiusTiers, dispatchRadiusConfig.expansionEnabled);

  const preview = await listNearbyOnlineDeliveryPartners(order.restaurantId, {
    maxKm: previewMaxKm,
    limit: PARTNER_SEARCH_LIMIT,
    requiredAmount,
    allowOverLimitFallback: true,
  });
  const shortlistedCount = Array.isArray(preview?.partners) ? preview.partners.length : 0;

  await cancelDispatchTimeoutJob(order._id.toString());

  order.dispatch.status = 'unassigned';
  order.dispatch.deliveryPartnerId = null;
  await order.save();

  await tryAutoAssign(order._id, {
    attempt: currentAttempt,
    forceNotify: true,
  });

  const refreshed = await FoodOrder.findById(order._id)
    .select('dispatch.offeredTo dispatch.status dispatch.deliveryPartnerId dispatch.dispatchAttempt')
    .lean();

  const notifiedCount = Array.isArray(refreshed?.dispatch?.offeredTo)
    ? refreshed.dispatch.offeredTo.filter((entry) => entry?.action === 'offered').length
    : 0;
  const notifiedPartnerIds = Array.isArray(refreshed?.dispatch?.offeredTo)
    ? refreshed.dispatch.offeredTo
      .filter((entry) => entry?.action === 'offered' && entry?.partnerId)
      .map((entry) => String(entry.partnerId))
    : [];

  // FCM is always attempted; socket delivery cannot be counted from the API process (Redis emitter).
  const connectedSocketCount = null;

  return {
    success: true,
    notifiedCount,
    shortlistedCount,
    requiredAmount,
    connectedSocketCount,
    dispatchAttempt: refreshed?.dispatch?.dispatchAttempt || currentAttempt,
    searchRadiusKm: previewMaxKm,
    dispatchStatus: refreshed?.dispatch?.status || 'unassigned',
  };
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


