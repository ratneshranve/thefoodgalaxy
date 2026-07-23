import express from 'express';
import { requireAdmin, authMiddleware } from '../../../../core/auth/auth.middleware.js';
import * as subscriptionAdminController from '../controllers/subscriptionAdmin.controller.js';

const router = express.Router();

// Admin routes require admin authorization
router.use(authMiddleware);
router.use(requireAdmin);

// Plans CRUD
router.get('/plans', subscriptionAdminController.getAllPlansController);
router.post('/plans', subscriptionAdminController.createPlanController);
router.put('/plans/:planId', subscriptionAdminController.updatePlanController);
router.delete('/plans/:planId', subscriptionAdminController.deletePlanController);
router.patch('/plans/:planId/toggle-status', subscriptionAdminController.togglePlanStatusController);

// Active & Past Subscriptions Listing
router.get('/active', subscriptionAdminController.getActiveSubscriptionsController);

// Analytics Dashboard
router.get('/analytics', subscriptionAdminController.getSubscriptionAnalyticsController);

export default router;
