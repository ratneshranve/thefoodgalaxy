import express from 'express';
import { authMiddleware } from '../../../../core/auth/auth.middleware.js';
import * as userSubscriptionController from '../controllers/userSubscription.controller.js';

const router = express.Router();

// Public routes (No auth required to view plans)
router.get('/plans', userSubscriptionController.getPublicPlansController);

// Razorpay Webhook (Public endpoint, signature verified inside)
router.post('/webhook', userSubscriptionController.razorpaySubscriptionWebhookController);

// Protected user routes
router.use(authMiddleware);

router.get('/active', userSubscriptionController.getUserActiveSubscriptionController);
router.post('/create-order', userSubscriptionController.createSubscriptionOrderController);
router.post('/verify-payment', userSubscriptionController.verifySubscriptionPaymentController);

export default router;
