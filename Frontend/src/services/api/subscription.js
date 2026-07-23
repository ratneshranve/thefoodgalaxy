import { adminClient, userClient } from "./axios.js";

/** Admin Subscription API */
export const adminSubscriptionAPI = {
  getPlans: () => adminClient.get("/food/admin/subscriptions/plans"),
  createPlan: (data) => adminClient.post("/food/admin/subscriptions/plans", data),
  updatePlan: (planId, data) => adminClient.put(`/food/admin/subscriptions/plans/${planId}`, data),
  deletePlan: (planId) => adminClient.delete(`/food/admin/subscriptions/plans/${planId}`),
  togglePlanStatus: (planId) => adminClient.patch(`/food/admin/subscriptions/plans/${planId}/toggle-status`),
  getActiveSubscriptions: (params = {}) => adminClient.get("/food/admin/subscriptions/active", { params }),
  getAnalytics: () => adminClient.get("/food/admin/subscriptions/analytics")
};

/** User Subscription API */
export const userSubscriptionAPI = {
  getPublicPlans: () => userClient.get("/food/user/subscriptions/plans"),
  getActiveSubscription: () => userClient.get("/food/user/subscriptions/active"),
  createSubscriptionOrder: (planId) => userClient.post("/food/user/subscriptions/create-order", { planId }),
  verifySubscriptionPayment: (data) => userClient.post("/food/user/subscriptions/verify-payment", data)
};
