import { FoodSubscriptionPlan } from '../../admin/models/subscriptionPlan.model.js';
import { FoodUserSubscription } from '../models/userSubscription.model.js';
import { ValidationError, NotFoundError } from '../../../../core/auth/errors.js';
import {
  createRazorpayOrder,
  verifyPaymentSignature,
  getRazorpayKeyId,
  isRazorpayConfigured
} from '../../orders/helpers/razorpay.helper.js';
import {
  notifySubscriptionPurchased,
  notifyPaymentSuccessful,
  notifyPaymentFailed,
  notifySubscriptionActivated
} from './subscriptionNotification.service.js';

/**
 * User: Get active subscription plans available for purchase
 */
export async function getPublicPlansUser() {
  const plans = await FoodSubscriptionPlan.find({ isActive: true })
    .sort({ sortOrder: 1, createdAt: -1 })
    .lean();
  return plans;
}

/**
 * User: Get current logged in user's active subscription
 */
export async function getUserActiveSubscriptionUser(userId) {
  if (!userId) return null;

  const now = new Date();

  // Find active subscription
  let sub = await FoodUserSubscription.findOne({
    userId,
    status: 'active'
  }).sort({ endDate: -1 });

  if (sub) {
    if (sub.endDate && new Date(sub.endDate) < now) {
      // Auto expire if date has passed
      sub.status = 'expired';
      await sub.save();
      return null;
    }
    return sub;
  }

  return null;
}

/**
 * User: Create Razorpay order to purchase a subscription plan
 */
export async function createSubscriptionOrderUser(userId, planId) {
  if (!userId) throw new ValidationError('User identification is required.');
  if (!planId) throw new ValidationError('Subscription plan ID is required.');

  // 1. Check if user already has an active subscription
  const activeSub = await getUserActiveSubscriptionUser(userId);
  if (activeSub) {
    throw new ValidationError('You already have an active subscription. You cannot purchase a new subscription until your current subscription expires.');
  }

  // 2. Fetch target plan
  const plan = await FoodSubscriptionPlan.findById(planId);
  if (!plan) {
    throw new NotFoundError('Subscription plan not found.');
  }
  if (!plan.isActive) {
    throw new ValidationError('This subscription plan is currently unavailable for purchase.');
  }

  // 3. Amount calculation in paise
  const amountPaise = Math.round(plan.totalAmount * 100);
  const receipt = `sub_${String(userId).slice(-6)}_${Date.now()}`;

  // 4. Create Razorpay order or fallback for test mode if not configured
  let razorpayOrder = null;
  const configured = isRazorpayConfigured();
  if (configured) {
    razorpayOrder = await createRazorpayOrder(amountPaise, 'INR', receipt);
  } else {
    // Development/Test fallback order
    razorpayOrder = {
      id: `order_mock_sub_${Date.now()}`,
      amount: amountPaise,
      currency: 'INR',
      receipt
    };
  }

  // 5. Create immutable snapshot of plan
  const planSnapshot = {
    planId: plan._id,
    name: plan.name,
    description: plan.description,
    durationDays: plan.durationDays,
    price: plan.price,
    gstPercentage: plan.gstPercentage,
    totalAmount: plan.totalAmount,
    benefits: (plan.benefits || []).map((b) => ({
      type: b.type,
      title: b.title,
      description: b.description || '',
      discountType: b.discountType || null,
      discountValue: b.discountValue || 0,
      maxDiscount: b.maxDiscount || 0,
      config: b.config || {}
    }))
  };

  // 6. Save pending subscription entry
  const userSub = new FoodUserSubscription({
    userId,
    planId: plan._id,
    planSnapshot,
    totalAmount: plan.totalAmount,
    status: 'pending',
    razorpayOrderId: razorpayOrder.id
  });

  await userSub.save();

  // Send 1. Subscription purchased notification
  notifySubscriptionPurchased(userId, plan.name, plan.totalAmount).catch(console.error);

  return {
    razorpayOrder,
    plan,
    razorpayKeyId: getRazorpayKeyId(),
    isMock: !configured
  };
}

/**
 * User: Verify Razorpay payment and activate subscription
 */
export async function verifySubscriptionPaymentUser(userId, dto) {
  const { razorpayOrderId, razorpayPaymentId, razorpaySignature } = dto;
  if (!razorpayOrderId || !razorpayPaymentId) {
    throw new ValidationError('razorpayOrderId and razorpayPaymentId are required.');
  }

  const userSub = await FoodUserSubscription.findOne({
    userId,
    razorpayOrderId
  });

  if (!userSub) {
    throw new NotFoundError('Pending subscription record not found for this order.');
  }

  // Already activated (double tap, retry, or the webhook got there first): nothing more to do.
  if (userSub.status === 'active' && userSub.razorpayPaymentId) return userSub;

  const configured = isRazorpayConfigured();
  if (configured) {
    // The signature is mandatory. It used to be skippable, which let anyone activate a
    // subscription for free by simply omitting it.
    const isValid = razorpaySignature &&
      verifyPaymentSignature(razorpayOrderId, razorpayPaymentId, razorpaySignature);
    if (!isValid) {
      throw new ValidationError('Payment signature verification failed.');
    }
  } else if (process.env.NODE_ENV === 'production') {
    throw new ValidationError('Payment gateway is not configured.');
  }

  return activateSubscription(userSub, razorpayPaymentId, razorpaySignature);
}

/**
 * Atomically moves a pending subscription to active. Only the first caller (client verify or
 * webhook) wins, so dates are set once and the notifications are sent once.
 */
async function activateSubscription(userSub, razorpayPaymentId, razorpaySignature) {
  const now = new Date();
  const durationDays = userSub.planSnapshot?.durationDays || 30;
  const endDate = new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000);

  const set = { startDate: now, endDate, status: 'active', razorpayPaymentId };
  if (razorpaySignature) set.razorpaySignature = razorpaySignature;

  const activated = await FoodUserSubscription.findOneAndUpdate(
    { _id: userSub._id, status: { $in: ['pending', 'failed'] } },
    { $set: set },
    { new: true }
  );
  if (!activated) return FoodUserSubscription.findById(userSub._id);

  const planName = activated.planSnapshot?.name || 'Subscription';
  notifyPaymentSuccessful(activated.userId, planName, activated.totalAmount).catch(console.error);
  notifySubscriptionActivated(activated.userId, planName, endDate).catch(console.error);
  return activated;
}

/**
 * Razorpay Webhook processor for subscriptions
 */
export async function handleSubscriptionWebhook(payload) {
  const event = payload?.event;
  const entity = payload?.payload?.payment?.entity || payload?.payload?.order?.entity;
  if (!entity) return { success: false, reason: 'No entity found' };

  const razorpayOrderId = entity.order_id || entity.id;
  const razorpayPaymentId = entity.id;

  if (event === 'order.paid' || event === 'payment.captured') {
    const userSub = await FoodUserSubscription.findOne({ razorpayOrderId, status: { $in: ['pending', 'failed'] } });
    if (userSub) {
      await activateSubscription(userSub, razorpayPaymentId, '');
      return { success: true, activated: true };
    }
  }
  return { success: true, processed: false };
}
