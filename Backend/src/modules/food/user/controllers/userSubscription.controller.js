import { sendResponse } from '../../../../utils/response.js';
import * as userSubscriptionService from '../services/userSubscription.service.js';

export async function getPublicPlansController(req, res, next) {
  try {
    const plans = await userSubscriptionService.getPublicPlansUser();
    return sendResponse(res, 200, 'Subscription plans fetched', { plans });
  } catch (err) {
    next(err);
  }
}

export async function getUserActiveSubscriptionController(req, res, next) {
  try {
    const userId = req.user?.userId;
    const subscription = await userSubscriptionService.getUserActiveSubscriptionUser(userId);
    return sendResponse(res, 200, 'User active subscription fetched', { subscription });
  } catch (err) {
    next(err);
  }
}

export async function createSubscriptionOrderController(req, res, next) {
  try {
    const userId = req.user?.userId;
    const { planId } = req.body;
    const result = await userSubscriptionService.createSubscriptionOrderUser(userId, planId);
    return sendResponse(res, 201, 'Subscription order created', result);
  } catch (err) {
    next(err);
  }
}

export async function verifySubscriptionPaymentController(req, res, next) {
  try {
    const userId = req.user?.userId;
    const result = await userSubscriptionService.verifySubscriptionPaymentUser(userId, req.body);
    return sendResponse(res, 200, 'Subscription activated successfully', { subscription: result });
  } catch (err) {
    next(err);
  }
}

export async function razorpaySubscriptionWebhookController(req, res, next) {
  try {
    const result = await userSubscriptionService.handleSubscriptionWebhook(req.body);
    return sendResponse(res, 200, 'Webhook processed', result);
  } catch (err) {
    next(err);
  }
}
