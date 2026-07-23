import { sendResponse } from '../../../../utils/response.js';
import * as subscriptionAdminService from '../services/subscriptionAdmin.service.js';

export async function createPlanController(req, res, next) {
  try {
    const plan = await subscriptionAdminService.createPlanAdmin(req.body);
    return sendResponse(res, 201, 'Subscription plan created successfully', { plan });
  } catch (err) {
    next(err);
  }
}

export async function updatePlanController(req, res, next) {
  try {
    const { planId } = req.params;
    const plan = await subscriptionAdminService.updatePlanAdmin(planId, req.body);
    return sendResponse(res, 200, 'Subscription plan updated successfully', { plan });
  } catch (err) {
    next(err);
  }
}

export async function deletePlanController(req, res, next) {
  try {
    const { planId } = req.params;
    const result = await subscriptionAdminService.deletePlanAdmin(planId);
    return sendResponse(res, 200, result.message, result);
  } catch (err) {
    next(err);
  }
}

export async function togglePlanStatusController(req, res, next) {
  try {
    const { planId } = req.params;
    const plan = await subscriptionAdminService.togglePlanStatusAdmin(planId);
    return sendResponse(res, 200, `Plan ${plan.isActive ? 'activated' : 'deactivated'} successfully`, { plan });
  } catch (err) {
    next(err);
  }
}

export async function getAllPlansController(req, res, next) {
  try {
    const plans = await subscriptionAdminService.getAllPlansAdmin();
    return sendResponse(res, 200, 'Subscription plans fetched', { plans });
  } catch (err) {
    next(err);
  }
}

export async function getActiveSubscriptionsController(req, res, next) {
  try {
    const result = await subscriptionAdminService.getActiveSubscriptionsAdmin(req.query);
    return sendResponse(res, 200, 'Active subscriptions fetched', result);
  } catch (err) {
    next(err);
  }
}

export async function getSubscriptionAnalyticsController(req, res, next) {
  try {
    const analytics = await subscriptionAdminService.getSubscriptionAnalyticsAdmin();
    return sendResponse(res, 200, 'Subscription analytics fetched', { analytics });
  } catch (err) {
    next(err);
  }
}
