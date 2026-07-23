import mongoose from 'mongoose';
import { FoodSubscriptionPlan } from '../models/subscriptionPlan.model.js';
import { FoodUserSubscription } from '../../user/models/userSubscription.model.js';
import { FoodOrder } from '../../orders/models/order.model.js';
import { ValidationError, NotFoundError } from '../../../../core/auth/errors.js';
import { checkAndSendSubscriptionExpiryNotifications } from '../../user/services/subscriptionNotification.service.js';

// Periodic 1-hour background timer for subscription expiration and 7-day / 1-day notifications
setInterval(() => {
  checkAndSendSubscriptionExpiryNotifications().catch((err) => {
    console.error('[Subscription] Background notification check error:', err);
  });
}, 60 * 60 * 1000);

/**
 * Admin: Create a new subscription plan
 */
export async function createPlanAdmin(dto) {
  const { name, description, durationDays, price, gstPercentage, benefits, sortOrder } = dto;
  if (!name || !durationDays || price == null) {
    throw new ValidationError('Plan name, duration (days), and price are required.');
  }

  const existing = await FoodSubscriptionPlan.findOne({ name: new RegExp(`^${name.trim()}$`, 'i') });
  if (existing) {
    throw new ValidationError(`Plan with name '${name}' already exists.`);
  }

  const plan = new FoodSubscriptionPlan({
    name: name.trim(),
    description: description || '',
    durationDays: Number(durationDays),
    price: Number(price),
    gstPercentage: gstPercentage != null ? Number(gstPercentage) : 18,
    benefits: Array.isArray(benefits) ? benefits : [],
    sortOrder: sortOrder != null ? Number(sortOrder) : 0,
    isActive: true
  });

  await plan.save();
  return plan;
}

/**
 * Admin: Update an existing subscription plan
 */
export async function updatePlanAdmin(planId, dto) {
  const plan = await FoodSubscriptionPlan.findById(planId);
  if (!plan) {
    throw new NotFoundError('Subscription plan not found.');
  }

  if (dto.name && dto.name.trim() !== plan.name) {
    const existing = await FoodSubscriptionPlan.findOne({
      _id: { $ne: planId },
      name: new RegExp(`^${dto.name.trim()}$`, 'i')
    });
    if (existing) {
      throw new ValidationError(`Another plan with name '${dto.name}' already exists.`);
    }
    plan.name = dto.name.trim();
  }

  if (dto.description !== undefined) plan.description = dto.description;
  if (dto.durationDays != null) plan.durationDays = Number(dto.durationDays);
  if (dto.price != null) plan.price = Number(dto.price);
  if (dto.gstPercentage != null) plan.gstPercentage = Number(dto.gstPercentage);
  if (Array.isArray(dto.benefits)) plan.benefits = dto.benefits;
  if (dto.sortOrder != null) plan.sortOrder = Number(dto.sortOrder);
  if (dto.isActive !== undefined) plan.isActive = Boolean(dto.isActive);

  await plan.save();
  return plan;
}

/**
 * Admin: Delete a subscription plan
 */
export async function deletePlanAdmin(planId) {
  const plan = await FoodSubscriptionPlan.findByIdAndDelete(planId);
  if (!plan) {
    throw new NotFoundError('Subscription plan not found.');
  }
  return { success: true, message: 'Subscription plan deleted successfully.' };
}

/**
 * Admin: Toggle Plan Active Status
 */
export async function togglePlanStatusAdmin(planId) {
  const plan = await FoodSubscriptionPlan.findById(planId);
  if (!plan) {
    throw new NotFoundError('Subscription plan not found.');
  }
  plan.isActive = !plan.isActive;
  await plan.save();
  return plan;
}

/**
 * Admin: Get all subscription plans
 */
export async function getAllPlansAdmin() {
  const plans = await FoodSubscriptionPlan.find().sort({ sortOrder: 1, createdAt: -1 }).lean();
  return plans;
}

/**
 * Admin: List active and all user subscriptions with details
 */
export async function getActiveSubscriptionsAdmin(query = {}) {
  const page = Math.max(1, parseInt(query.page || 1, 10));
  const limit = Math.max(1, parseInt(query.limit || 20, 10));
  const skip = (page - 1) * limit;
  const statusFilter = query.status || 'all';

  const filter = {};
  if (statusFilter !== 'all') {
    if (statusFilter === 'active') {
      filter.status = 'active';
      filter.endDate = { $gte: new Date() };
    } else if (statusFilter === 'expired') {
      filter.$or = [
        { status: 'expired' },
        { status: 'active', endDate: { $lt: new Date() } }
      ];
    } else {
      filter.status = statusFilter;
    }
  }

  const now = new Date();

  // Lazy update expired subscriptions in background query
  await FoodUserSubscription.updateMany(
    { status: 'active', endDate: { $lt: now } },
    { status: 'expired' }
  );

  const totalDocs = await FoodUserSubscription.countDocuments(filter);
  const docs = await FoodUserSubscription.find(filter)
    .populate('userId', 'fullName firstName lastName email phone profileImage avatar')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .lean();

  const subscriptions = docs.map((sub) => {
    const user = sub.userId || {};
    const userName = user.fullName || `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'User';
    const userContact = user.phone || user.email || 'N/A';
    
    // Check if effective state is expired
    const isExpired = sub.endDate && new Date(sub.endDate) < now;
    const currentStatus = isExpired ? 'expired' : sub.status;

    return {
      _id: sub._id,
      user: {
        id: user._id,
        name: userName,
        contact: userContact,
        email: user.email,
        phone: user.phone,
        avatar: user.profileImage || user.avatar
      },
      planName: sub.planSnapshot?.name || 'N/A',
      totalAmount: sub.totalAmount,
      startDate: sub.startDate,
      endDate: sub.endDate,
      status: currentStatus,
      razorpayOrderId: sub.razorpayOrderId,
      razorpayPaymentId: sub.razorpayPaymentId,
      totalSavingsAccrued: sub.totalSavingsAccrued || 0,
      createdAt: sub.createdAt
    };
  });

  return {
    subscriptions,
    pagination: {
      total: totalDocs,
      page,
      limit,
      totalPages: Math.ceil(totalDocs / limit)
    }
  };
}

/**
 * Admin Analytics Dashboard metrics for Subscriptions
 */
export async function getSubscriptionAnalyticsAdmin() {
  const now = new Date();

  // Auto-expire
  await FoodUserSubscription.updateMany(
    { status: 'active', endDate: { $lt: now } },
    { status: 'expired' }
  );

  // Total revenue from active/expired paid subscriptions
  const revenueResult = await FoodUserSubscription.aggregate([
    { $match: { status: { $in: ['active', 'expired'] } } },
    { $group: { _id: null, totalRevenue: { $sum: '$totalAmount' } } }
  ]);
  const totalRevenue = revenueResult[0]?.totalRevenue || 0;

  // Active subscribers count
  const activeSubscribers = await FoodUserSubscription.countDocuments({
    status: 'active',
    endDate: { $gte: now }
  });

  // Expired subscribers count
  const expiredSubscribers = await FoodUserSubscription.countDocuments({
    $or: [{ status: 'expired' }, { status: 'active', endDate: { $lt: now } }]
  });

  // Plan-wise breakdown
  const planWiseBreakdown = await FoodUserSubscription.aggregate([
    { $match: { status: { $in: ['active', 'expired'] } } },
    {
      $group: {
        _id: '$planSnapshot.name',
        totalCount: { $sum: 1 },
        activeCount: {
          $sum: {
            $cond: [
              { $and: [{ $eq: ['$status', 'active'] }, { $gte: ['$endDate', now] }] },
              1,
              0
            ]
          }
        },
        revenue: { $sum: '$totalAmount' }
      }
    },
    { $sort: { totalCount: -1 } }
  ]);

  // Monthly sales for current year
  const startOfYear = new Date(now.getFullYear(), 0, 1);
  const monthlySales = await FoodUserSubscription.aggregate([
    {
      $match: {
        status: { $in: ['active', 'expired'] },
        createdAt: { $gte: startOfYear }
      }
    },
    {
      $group: {
        _id: { $month: '$createdAt' },
        revenue: { $sum: '$totalAmount' },
        count: { $sum: 1 }
      }
    },
    { $sort: { _id: 1 } }
  ]);

  // Total savings given to users across all orders with subscription benefits
  const orderSavingsResult = await FoodOrder.aggregate([
    { $match: { totalSubscriptionSavings: { $gt: 0 } } },
    { $group: { _id: null, totalSavings: { $sum: '$totalSubscriptionSavings' } } }
  ]);
  const totalSavingsGiven = orderSavingsResult[0]?.totalSavings || 0;

  return {
    totalRevenue,
    activeSubscribers,
    expiredSubscribers,
    planWiseBreakdown: planWiseBreakdown.map((p) => ({
      planName: p._id || 'Unknown',
      totalCount: p.totalCount,
      activeCount: p.activeCount,
      revenue: p.revenue
    })),
    monthlySales: monthlySales.map((m) => ({
      month: m._id,
      revenue: m.revenue,
      count: m.count
    })),
    totalSavingsGiven
  };
}
