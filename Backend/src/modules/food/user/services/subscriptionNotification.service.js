import { sendNotificationToOwner } from '../../../../core/notifications/firebase.service.js';
import { createInboxNotifications } from '../../../../core/notifications/notification.service.js';
import { FoodUserSubscription } from '../models/userSubscription.model.js';
import { logger } from '../../../../utils/logger.js';

/**
 * Helper to dispatch both FCM Push notification and In-app Inbox notification safely
 */
async function sendSubscriptionNotification({ userId, title, message, type, metadata = {} }) {
  if (!userId) return;

  const link = '/food/user/subscriptions';

  // 1. Send In-App Inbox notification
  try {
    await createInboxNotifications({
      notifications: [
        {
          ownerType: 'USER',
          ownerId: userId,
          title,
          message,
          link,
          category: 'subscription',
          metadata: { ...metadata, notificationType: type }
        }
      ]
    });
  } catch (err) {
    logger.warn(`In-App notification error for user ${userId}: ${err.message}`);
  }

  // 2. Send FCM Push Notification
  try {
    await sendNotificationToOwner({
      ownerType: 'USER',
      ownerId: userId,
      payload: {
        title,
        body: message,
        data: {
          type: 'subscription',
          notificationType: type,
          link,
          ...metadata
        }
      }
    });
  } catch (err) {
    logger.warn(`FCM push error for user ${userId}: ${err.message}`);
  }
}

/**
 * 1. Subscription purchased / initiated
 */
export async function notifySubscriptionPurchased(userId, planName, totalAmount) {
  await sendSubscriptionNotification({
    userId,
    title: 'Subscription Order Placed 👑',
    message: `Your purchase order for ${planName} subscription (₹${totalAmount}) has been initiated. Complete payment to activate your VIP benefits.`,
    type: 'SUBSCRIPTION_PURCHASED',
    metadata: { planName, totalAmount }
  });
}

/**
 * 2. Payment successful
 */
export async function notifyPaymentSuccessful(userId, planName, totalAmount) {
  await sendSubscriptionNotification({
    userId,
    title: 'Payment Successful! 💳',
    message: `Your payment of ₹${totalAmount} for ${planName} subscription was successful.`,
    type: 'PAYMENT_SUCCESSFUL',
    metadata: { planName, totalAmount }
  });
}

/**
 * 3. Payment failed
 */
export async function notifyPaymentFailed(userId, planName, totalAmount) {
  await sendSubscriptionNotification({
    userId,
    title: 'Payment Failed ❌',
    message: `Your payment for ${planName} subscription (₹${totalAmount}) failed. Tap to retry payment.`,
    type: 'PAYMENT_FAILED',
    metadata: { planName, totalAmount }
  });
}

/**
 * 4. Subscription activated
 */
export async function notifySubscriptionActivated(userId, planName, endDate) {
  const formattedDate = new Date(endDate).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });

  await sendSubscriptionNotification({
    userId,
    title: 'Subscription Activated! 🎉',
    message: `Welcome to ${planName}! Enjoy Free Delivery & Food Discounts until ${formattedDate}.`,
    type: 'SUBSCRIPTION_ACTIVATED',
    metadata: { planName, endDate }
  });
}

/**
 * 5. Subscription expires in 7 days
 */
export async function notifySubscriptionExpiringIn7Days(userId, planName, endDate) {
  const formattedDate = new Date(endDate).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short'
  });

  await sendSubscriptionNotification({
    userId,
    title: 'Subscription Expiring Soon! ⏰',
    message: `Your ${planName} subscription will expire in 7 days on ${formattedDate}. Enjoy your remaining VIP perks!`,
    type: 'SUBSCRIPTION_EXPIRING_7_DAYS',
    metadata: { planName, endDate }
  });
}

/**
 * 6. Subscription expires in 1 day
 */
export async function notifySubscriptionExpiringIn1Day(userId, planName, endDate) {
  await sendSubscriptionNotification({
    userId,
    title: 'Subscription Expires Tomorrow! ⚠️',
    message: `Your ${planName} subscription expires tomorrow. Renew to continue enjoying Free Delivery & Discounts!`,
    type: 'SUBSCRIPTION_EXPIRING_1_DAY',
    metadata: { planName, endDate }
  });
}

/**
 * 7. Subscription expired
 */
export async function notifySubscriptionExpired(userId, planName) {
  await sendSubscriptionNotification({
    userId,
    title: 'Subscription Expired ⌛',
    message: `Your ${planName} subscription has expired. Subscribe to a new plan to keep getting member savings on every order.`,
    type: 'SUBSCRIPTION_EXPIRED',
    metadata: { planName }
  });
}

/**
 * Scheduled expiration & reminder checker routine
 * Checks subscriptions for 7-day reminder, 1-day reminder, and auto-expire transition.
 */
export async function checkAndSendSubscriptionExpiryNotifications() {
  const now = new Date();

  // A. Auto-expire subscriptions where endDate < now
  const expiredSubs = await FoodUserSubscription.find({
    status: 'active',
    endDate: { $lt: now }
  });

  for (const sub of expiredSubs) {
    sub.status = 'expired';
    await sub.save();
    await notifySubscriptionExpired(sub.userId, sub.planSnapshot?.name || 'Subscription');
  }

  // B. Reminders for 1 Day expiry (between 23 and 25 hours from now)
  const in1DayStart = new Date(now.getTime() + 23 * 60 * 60 * 1000);
  const in1DayEnd = new Date(now.getTime() + 25 * 60 * 60 * 1000);

  const expiringIn1DaySubs = await FoodUserSubscription.find({
    status: 'active',
    endDate: { $gte: in1DayStart, $lte: in1DayEnd },
    notified1Day: { $ne: true }
  });

  for (const sub of expiringIn1DaySubs) {
    sub.notified1Day = true;
    await sub.save();
    await notifySubscriptionExpiringIn1Day(sub.userId, sub.planSnapshot?.name || 'Subscription', sub.endDate);
  }

  // C. Reminders for 7 Days expiry (between 6.9 and 7.1 days from now)
  const in7DaysStart = new Date(now.getTime() + 6.9 * 24 * 60 * 60 * 1000);
  const in7DaysEnd = new Date(now.getTime() + 7.1 * 24 * 60 * 60 * 1000);

  const expiringIn7DaysSubs = await FoodUserSubscription.find({
    status: 'active',
    endDate: { $gte: in7DaysStart, $lte: in7DaysEnd },
    notified7Days: { $ne: true }
  });

  for (const sub of expiringIn7DaysSubs) {
    sub.notified7Days = true;
    await sub.save();
    await notifySubscriptionExpiringIn7Days(sub.userId, sub.planSnapshot?.name || 'Subscription', sub.endDate);
  }
}
