import crypto from 'crypto';
import { sendResponse } from '../../../../utils/response.js';
import { config } from '../../../../config/env.js';
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
    // This endpoint is public, so the Razorpay signature MUST be checked. Without this anyone
    // could post a fake "order.paid" event and activate a subscription for free.
    const signature = String(req.headers['x-razorpay-signature'] || '');
    const secret = config.razorpayWebhookSecret;
    if (!signature || !secret || !req.rawBody) {
      return res.status(400).send('Invalid signature');
    }
    const expected = crypto.createHmac('sha256', secret).update(req.rawBody).digest('hex');
    const a = Buffer.from(expected);
    const b = Buffer.from(signature);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      return res.status(400).send('Invalid signature');
    }
    const result = await userSubscriptionService.handleSubscriptionWebhook(req.body);
    return sendResponse(res, 200, 'Webhook processed', result);
  } catch (err) {
    next(err);
  }
}
