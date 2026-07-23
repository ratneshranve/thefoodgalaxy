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

  const planName = userSub.planSnapshot?.name || 'Subscription';
  const totalAmount = userSub.totalAmount || 0;

  const configured = isRazorpayConfigured();
  if (configured && razorpaySignature) {
    const isValid = verifyPaymentSignature(razorpayOrderId, razorpayPaymentId, razorpaySignature);
    if (!isValid) {
      userSub.status = 'failed';
      await userSub.save();
      // Send 3. Payment failed notification
      notifyPaymentFailed(userId, planName, totalAmount).catch(console.error);
      throw new ValidationError('Payment signature verification failed.');
    }
  }

  // Calculate validity dates
  const now = new Date();
  const durationDays = userSub.planSnapshot?.durationDays || 30;
  const endDate = new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000);

  userSub.startDate = now;
  userSub.endDate = endDate;
  userSub.status = 'active';
  userSub.razorpayPaymentId = razorpayPaymentId;
  if (razorpaySignature) {
    userSub.razorpaySignature = razorpaySignature;
  }

  await userSub.save();

  // Send 2. Payment successful and 4. Subscription activated notifications
  notifyPaymentSuccessful(userId, planName, totalAmount).catch(console.error);
  notifySubscriptionActivated(userId, planName, endDate).catch(console.error);

  return userSub;
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
    const userSub = await FoodUserSubscription.findOne({ razorpayOrderId, status: 'pending' });
    if (userSub) {
      const now = new Date();
      const durationDays = userSub.planSnapshot?.durationDays || 30;
      const endDate = new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000);

      userSub.startDate = now;
      userSub.endDate = endDate;
      userSub.status = 'active';
      userSub.razorpayPaymentId = razorpayPaymentId;
      await userSub.save();

      const planName = userSub.planSnapshot?.name || 'Subscription';
      notifyPaymentSuccessful(userSub.userId, planName, userSub.totalAmount).catch(console.error);
      notifySubscriptionActivated(userSub.userId, planName, endDate).catch(console.error);

      return { success: true, activated: true };
    }
  }
  return { success: true, processed: false };
}
