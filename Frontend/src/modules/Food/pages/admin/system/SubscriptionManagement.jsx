import { useState, useEffect } from "react";
import {
  Crown,
  Plus,
  Trash2,
  Edit2,
  CheckCircle2,
  XCircle,
  TrendingUp,
  Users,
  IndianRupee,
  Clock,
  ShieldCheck,
  Percent,
  Truck,
  Sparkles,
  Search,
  Filter,
  RefreshCw,
  AlertCircle
} from "lucide-react";
import { adminSubscriptionAPI } from "@/services/api/subscription";
import { toast } from "sonner";

export default function SubscriptionManagement() {
  const [activeTab, setActiveTab] = useState("plans"); // "plans" | "subscribers" | "analytics"
  const [plans, setPlans] = useState([]);
  const [subscribers, setSubscribers] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [subscribersFilter, setSubscribersFilter] = useState("all");

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState(null);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    durationDays: 30,
    price: 199,
    gstPercentage: 18,
    sortOrder: 0,
    hasFreeDelivery: true,
    hasFoodDiscount: false,
    foodDiscountType: "percentage",
    foodDiscountValue: 10,
    maxFoodDiscount: 100
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [plansRes, analyticsRes, subsRes] = await Promise.all([
        adminSubscriptionAPI.getPlans(),
        adminSubscriptionAPI.getAnalytics(),
        adminSubscriptionAPI.getActiveSubscriptions({ status: subscribersFilter })
      ]);

      if (plansRes?.data?.data?.plans) {
        setPlans(plansRes.data.data.plans);
      }
      if (analyticsRes?.data?.data?.analytics) {
        setAnalytics(analyticsRes.data.data.analytics);
      }
      if (subsRes?.data?.data?.subscriptions) {
        setSubscribers(subsRes.data.data.subscriptions);
      }
    } catch (err) {
      console.error("Failed to fetch subscription data:", err);
      toast.error("Failed to load subscription data");
    } finally {
      setLoading(false);
    }
  };

  const handleFetchSubscribers = async (status) => {
    setSubscribersFilter(status);
    try {
      const res = await adminSubscriptionAPI.getActiveSubscriptions({ status });
      if (res?.data?.data?.subscriptions) {
        setSubscribers(res.data.data.subscriptions);
      }
    } catch (err) {
      toast.error("Failed to fetch subscribers");
    }
  };

  const handleOpenCreateModal = () => {
    setEditingPlan(null);
    setFormData({
      name: "",
      description: "",
      durationDays: 30,
      price: 199,
      gstPercentage: 18,
      sortOrder: 0,
      hasFreeDelivery: true,
      hasFoodDiscount: false,
      foodDiscountType: "percentage",
      foodDiscountValue: 10,
      maxFoodDiscount: 100
    });
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (plan) => {
    setEditingPlan(plan);

    const freeDeliveryBenefit = plan.benefits?.find((b) => b.type === "FREE_DELIVERY");
    const foodDiscountBenefit = plan.benefits?.find((b) => b.type === "FOOD_DISCOUNT");

    setFormData({
      name: plan.name || "",
      description: plan.description || "",
      durationDays: plan.durationDays || 30,
      price: plan.price || 0,
      gstPercentage: plan.gstPercentage ?? 18,
      sortOrder: plan.sortOrder || 0,
      hasFreeDelivery: !!freeDeliveryBenefit,
      hasFoodDiscount: !!foodDiscountBenefit,
      foodDiscountType: foodDiscountBenefit?.discountType || "percentage",
      foodDiscountValue: foodDiscountBenefit?.discountValue || 10,
      maxFoodDiscount: foodDiscountBenefit?.maxDiscount || 100
    });
    setIsModalOpen(true);
  };

  const handleSavePlan = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast.error("Plan name is required");
      return;
    }
    if (formData.durationDays <= 0 || formData.price < 0) {
      toast.error("Invalid duration or price");
      return;
    }

    // Build benefits list dynamically
    const benefits = [];
    if (formData.hasFreeDelivery) {
      benefits.push({
        type: "FREE_DELIVERY",
        title: "Free Delivery",
        description: "Waives delivery fee on all food orders"
      });
    }
    if (formData.hasFoodDiscount) {
      const isPercent = formData.foodDiscountType === "percentage";
      benefits.push({
        type: "FOOD_DISCOUNT",
        title: isPercent ? `${formData.foodDiscountValue}% Off Food Total` : `₹${formData.foodDiscountValue} Off Food Total`,
        description: `Get ${isPercent ? `${formData.foodDiscountValue}%` : `₹${formData.foodDiscountValue}`} discount on food subtotal`,
        discountType: formData.foodDiscountType,
        discountValue: Number(formData.foodDiscountValue) || 0,
        maxDiscount: isPercent ? Number(formData.maxFoodDiscount) || 0 : 0
      });
    }

    const payload = {
      name: formData.name.trim(),
      description: formData.description.trim(),
      durationDays: Number(formData.durationDays),
      price: Number(formData.price),
      gstPercentage: Number(formData.gstPercentage),
      benefits,
      sortOrder: Number(formData.sortOrder)
    };

    setSaving(true);
    try {
      if (editingPlan) {
        await adminSubscriptionAPI.updatePlan(editingPlan._id, payload);
        toast.success("Subscription plan updated successfully");
      } else {
        await adminSubscriptionAPI.createPlan(payload);
        toast.success("Subscription plan created successfully");
      }
      setIsModalOpen(false);
      fetchData();
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || "Failed to save plan");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleStatus = async (planId) => {
    try {
      const res = await adminSubscriptionAPI.togglePlanStatus(planId);
      toast.success(res?.data?.message || "Status updated");
      fetchData();
    } catch (err) {
      toast.error("Failed to update status");
    }
  };

  const handleDeletePlan = async (planId, name) => {
    if (!window.confirm(`Are you sure you want to delete the '${name}' plan?`)) return;
    try {
      await adminSubscriptionAPI.deletePlan(planId);
      toast.success("Plan deleted successfully");
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to delete plan");
    }
  };

  const calculateTotalPreview = () => {
    const p = Number(formData.price) || 0;
    const g = Number(formData.gstPercentage) || 0;
    return (p + p * (g / 100)).toFixed(2);
  };

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto min-h-screen bg-gray-50/50 dark:bg-gray-900/50 text-gray-900 dark:text-gray-100">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-gray-800 p-6 rounded-2xl border border-gray-200/80 dark:border-gray-700/80 shadow-xs">
        <div className="flex items-center space-x-3">
          <div className="p-3 bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-xl">
            <Crown className="w-7 h-7" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Subscription Plans Module</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Manage plans, dynamic benefits, active subscribers, and revenue analytics
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={fetchData}
            className="p-2.5 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-colors"
            title="Refresh Data"
          >
            <RefreshCw className={`w-5 h-5 ${loading ? "animate-spin" : ""}`} />
          </button>
          <button
            onClick={handleOpenCreateModal}
            className="inline-flex items-center space-x-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-medium px-5 py-2.5 rounded-xl shadow-md transition-all cursor-pointer"
          >
            <Plus className="w-5 h-5" />
            <span>Create New Plan</span>
          </button>
        </div>
      </div>

      {/* Analytics Metric Cards */}
      <div className="grid grid-[#121212] grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-200/80 dark:border-gray-700/80 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
              Total Revenue
            </p>
            <h3 className="text-2xl font-bold mt-1 text-emerald-600 dark:text-emerald-400">
              ₹{analytics?.totalRevenue?.toLocaleString("en-IN") || 0}
            </h3>
          </div>
          <div className="p-3 bg-emerald-500/10 text-emerald-500 rounded-xl">
            <IndianRupee className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-200/80 dark:border-gray-700/80 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
              Active Subscribers
            </p>
            <h3 className="text-2xl font-bold mt-1 text-amber-500">
              {analytics?.activeSubscribers || 0}
            </h3>
          </div>
          <div className="p-3 bg-amber-500/10 text-amber-500 rounded-xl">
            <Users className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-200/80 dark:border-gray-700/80 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
              Expired Subscriptions
            </p>
            <h3 className="text-2xl font-bold mt-1 text-gray-600 dark:text-gray-300">
              {analytics?.expiredSubscribers || 0}
            </h3>
          </div>
          <div className="p-3 bg-gray-500/10 text-gray-500 rounded-xl">
            <Clock className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-200/80 dark:border-gray-700/80 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
              Total User Savings
            </p>
            <h3 className="text-2xl font-bold mt-1 text-blue-600 dark:text-blue-400">
              ₹{analytics?.totalSavingsGiven?.toLocaleString("en-IN") || 0}
            </h3>
          </div>
          <div className="p-3 bg-blue-500/10 text-blue-500 rounded-xl">
            <Sparkles className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-gray-200 dark:border-gray-700 space-x-6 text-sm font-medium">
        <button
          onClick={() => setActiveTab("plans")}
          className={`pb-3 border-b-2 transition-all ${
            activeTab === "plans"
              ? "border-amber-500 text-amber-600 dark:text-amber-400 font-semibold"
              : "border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
          }`}
        >
          Subscription Plans ({plans.length})
        </button>
        <button
          onClick={() => setActiveTab("subscribers")}
          className={`pb-3 border-b-2 transition-all ${
            activeTab === "subscribers"
              ? "border-amber-500 text-amber-600 dark:text-amber-400 font-semibold"
              : "border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
          }`}
        >
          Active & Past Subscribers ({subscribers.length})
        </button>
        <button
          onClick={() => setActiveTab("analytics")}
          className={`pb-3 border-b-2 transition-all ${
            activeTab === "analytics"
              ? "border-amber-500 text-amber-600 dark:text-amber-400 font-semibold"
              : "border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
          }`}
        >
          Analytics & Breakdown
        </button>
      </div>

      {/* Tab 1: Plans Management Grid */}
      {activeTab === "plans" && (
        <div>
          {plans.length === 0 ? (
            <div className="bg-white dark:bg-gray-800 p-12 text-center rounded-2xl border border-dashed border-gray-300 dark:border-gray-700">
              <Crown className="w-12 h-12 text-gray-400 mx-auto mb-3" />
              <h3 className="text-lg font-semibold">No Subscription Plans Created</h3>
              <p className="text-gray-500 text-sm mt-1 mb-4">
                Create subscription plans like Silver or Gold to start offering benefits.
              </p>
              <button
                onClick={handleOpenCreateModal}
                className="bg-amber-500 hover:bg-amber-600 text-white font-medium px-4 py-2 rounded-xl"
              >
                Create First Plan
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {plans.map((plan) => {
                const p = Number(plan.price) || 0;
                const g = Number(plan.gstPercentage) || 0;
                const totalCalculated = (p + p * (g / 100)).toFixed(2);
                return (
                  <div
                    key={plan._id}
                    className={`bg-white dark:bg-gray-800 rounded-2xl border transition-all duration-200 p-6 flex flex-col justify-between shadow-xs hover:shadow-md relative overflow-hidden ${
                      plan.isActive
                        ? "border-gray-200 dark:border-gray-700"
                        : "border-gray-300 dark:border-gray-800 opacity-70 bg-gray-50/50"
                    }`}
                  >
                    {/* Top Ribbon */}
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400">
                          <Crown className="w-3.5 h-3.5" />
                          <span>{plan.name}</span>
                        </span>
                        <p className="text-xs text-gray-500 mt-2 line-clamp-2">
                          {plan.description || "No description provided"}
                        </p>
                      </div>
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => handleToggleStatus(plan._id)}
                          className={`p-1.5 rounded-lg text-xs font-medium ${
                            plan.isActive
                              ? "bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20"
                              : "bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300"
                          }`}
                          title={plan.isActive ? "Deactivate Plan" : "Activate Plan"}
                        >
                          {plan.isActive ? "Active" : "Inactive"}
                        </button>
                      </div>
                    </div>

                    {/* Price & Duration */}
                    <div className="my-5 py-3 border-y border-gray-100 dark:border-gray-700/60">
                      <div className="flex items-baseline space-x-1">
                        <span className="text-3xl font-extrabold text-gray-900 dark:text-white">
                          ₹{plan.totalAmount || totalCalculated}
                        </span>
                        <span className="text-xs text-gray-500 font-medium">
                          / {plan.durationDays} Days
                        </span>
                      </div>
                      <p className="text-xs text-gray-400 mt-1">
                        Base: ₹{plan.price || 0} + {plan.gstPercentage || 0}% GST (₹{((Number(plan.price) || 0) * ((Number(plan.gstPercentage) || 0) / 100)).toFixed(2)})
                      </p>
                    </div>

                    {/* Benefits List */}
                    <div className="space-y-2 mb-6 flex-1">
                      <p className="text-xs font-semibold uppercase text-gray-400 tracking-wider">
                        Configured Benefits
                      </p>
                      {Array.isArray(plan.benefits) && plan.benefits.length > 0 ? (
                        plan.benefits.map((b, idx) => (
                          <div key={idx} className="flex items-center space-x-2 text-sm text-gray-700 dark:text-gray-300">
                            <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                            <span className="font-medium">{b.title}</span>
                          </div>
                        ))
                      ) : (
                        <p className="text-xs text-gray-400 italic">No benefits configured</p>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center space-x-3 pt-4 border-t border-gray-100 dark:border-gray-700/60">
                      <button
                        onClick={() => handleOpenEditModal(plan)}
                        className="flex-1 py-2 px-3 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 text-xs font-medium rounded-xl flex items-center justify-center space-x-1.5"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                        <span>Edit</span>
                      </button>
                      <button
                        onClick={() => handleDeletePlan(plan._id, plan.name)}
                        className="p-2 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-xl"
                        title="Delete Plan"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Subscribers Table */}
      {activeTab === "subscribers" && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200/80 dark:border-gray-700/80 overflow-hidden shadow-xs">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex flex-col sm:flex-row items-center justify-between gap-4">
            <h3 className="font-semibold text-gray-900 dark:text-white">Active & History User Subscriptions</h3>
            <div className="flex items-center space-x-2">
              <span className="text-xs text-gray-500 font-medium">Filter:</span>
              <select
                value={subscribersFilter}
                onChange={(e) => handleFetchSubscribers(e.target.value)}
                className="bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 text-xs rounded-xl px-3 py-1.5"
              >
                <option value="all">All Statuses</option>
                <option value="active">Active Only</option>
                <option value="expired">Expired Only</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-600 dark:text-gray-300">
              <thead className="bg-gray-50 dark:bg-gray-900/50 text-xs uppercase font-semibold text-gray-500 tracking-wider">
                <tr>
                  <th className="p-4">User</th>
                  <th className="p-4">Plan Name</th>
                  <th className="p-4">Amount Paid</th>
                  <th className="p-4">Start Date</th>
                  <th className="p-4">Expiry Date</th>
                  <th className="p-4">Status</th>
                  <th className="p-4">Savings Accrued</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700/60">
                {subscribers.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-gray-400">
                      No subscriber records found.
                    </td>
                  </tr>
                ) : (
                  subscribers.map((sub) => {
                    const isExpired = sub.status === "expired" || (sub.endDate && new Date(sub.endDate) < new Date());
                    return (
                      <tr key={sub._id} className="hover:bg-gray-50/50 dark:hover:bg-gray-700/30">
                        <td className="p-4">
                          <div className="font-semibold text-gray-900 dark:text-white">{sub.user?.name}</div>
                          <div className="text-xs text-gray-400">{sub.user?.contact}</div>
                        </td>
                        <td className="p-4 font-medium text-amber-600 dark:text-amber-400">
                          {sub.planName}
                        </td>
                        <td className="p-4 font-bold text-gray-900 dark:text-white">
                          ₹{sub.totalAmount}
                        </td>
                        <td className="p-4 text-xs">
                          {sub.startDate ? new Date(sub.startDate).toLocaleDateString("en-IN") : "N/A"}
                        </td>
                        <td className="p-4 text-xs">
                          {sub.endDate ? new Date(sub.endDate).toLocaleDateString("en-IN") : "N/A"}
                        </td>
                        <td className="p-4">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              isExpired
                                ? "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400"
                                : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400"
                            }`}
                          >
                            {isExpired ? "Expired" : "Active"}
                          </span>
                        </td>
                        <td className="p-4 text-xs font-semibold text-blue-600 dark:text-blue-400">
                          ₹{sub.totalSavingsAccrued || 0}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 3: Analytics Breakdown */}
      {activeTab === "analytics" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Plan-wise distribution */}
          <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl border border-gray-200/80 dark:border-gray-700/80 shadow-xs">
            <h3 className="text-lg font-bold mb-4 flex items-center space-x-2">
              <Crown className="w-5 h-5 text-amber-500" />
              <span>Plan-wise Subscriber Count</span>
            </h3>
            {Array.isArray(analytics?.planWiseBreakdown) && analytics.planWiseBreakdown.length > 0 ? (
              <div className="space-y-4">
                {analytics.planWiseBreakdown.map((p, idx) => (
                  <div key={idx} className="p-4 bg-gray-50 dark:bg-gray-900 rounded-xl flex items-center justify-between">
                    <div>
                      <h4 className="font-semibold text-gray-900 dark:text-white">{p.planName}</h4>
                      <p className="text-xs text-gray-500">
                        {p.activeCount} Active / {p.totalCount} Total Purchased
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="text-base font-bold text-emerald-600 dark:text-emerald-400">
                        ₹{p.revenue}
                      </span>
                      <p className="text-xs text-gray-400">Total Generated</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-400 text-sm">No plan sales data recorded yet.</p>
            )}
          </div>

          {/* Monthly Sales Breakdown */}
          <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl border border-gray-200/80 dark:border-gray-700/80 shadow-xs">
            <h3 className="text-lg font-bold mb-4 flex items-center space-x-2">
              <TrendingUp className="w-5 h-5 text-emerald-500" />
              <span>Monthly Subscription Sales ({new Date().getFullYear()})</span>
            </h3>
            {Array.isArray(analytics?.monthlySales) && analytics.monthlySales.length > 0 ? (
              <div className="space-y-3">
                {analytics.monthlySales.map((m, idx) => {
                  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
                  return (
                    <div key={idx} className="flex items-center justify-between p-3 border-b border-gray-100 dark:border-gray-700/60 text-sm">
                      <span className="font-medium">{monthNames[m.month - 1]}</span>
                      <span className="text-gray-500">{m.count} Sales</span>
                      <span className="font-bold text-emerald-600 dark:text-emerald-400">₹{m.revenue}</span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-gray-400 text-sm">No monthly sales data yet.</p>
            )}
          </div>
        </div>
      )}

      {/* Plan Form Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-lg overflow-hidden border border-gray-200 dark:border-gray-700">
            <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
              <h3 className="text-lg font-bold flex items-center space-x-2">
                <Crown className="w-5 h-5 text-amber-500" />
                <span>{editingPlan ? "Edit Subscription Plan" : "Create New Subscription Plan"}</span>
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                <XCircle className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleSavePlan} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase mb-1">
                  Plan Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Silver, Gold, Platinum"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3.5 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase mb-1">
                  Description
                </label>
                <textarea
                  rows={2}
                  placeholder="Short summary of benefits..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3.5 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase mb-1">
                    Duration (Days) *
                  </label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={formData.durationDays}
                    onChange={(e) => setFormData({ ...formData, durationDays: e.target.value })}
                    className="w-full px-3.5 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase mb-1">
                    Base Price (₹) *
                  </label>
                  <input
                    type="number"
                    min={0}
                    required
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                    className="w-full px-3.5 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase mb-1">
                    GST %
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={formData.gstPercentage}
                    onChange={(e) => setFormData({ ...formData, gstPercentage: e.target.value })}
                    className="w-full px-3.5 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase mb-1">
                    Total (Price + GST)
                  </label>
                  <div className="w-full px-3.5 py-2 bg-amber-500/10 border border-amber-500/30 rounded-xl text-sm font-bold text-amber-700 dark:text-amber-400">
                    ₹{calculateTotalPreview()}
                  </div>
                </div>
              </div>

              {/* Dynamic Benefits Selection */}
              <div className="p-4 bg-gray-50 dark:bg-gray-900/60 rounded-xl space-y-3 border border-gray-200 dark:border-gray-700">
                <p className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                  Configurable Benefits
                </p>

                {/* Free Delivery Benefit Toggle */}
                <label className="flex items-center space-x-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.hasFreeDelivery}
                    onChange={(e) => setFormData({ ...formData, hasFreeDelivery: e.target.checked })}
                    className="w-4 h-4 text-amber-500 rounded-sm focus:ring-amber-500"
                  />
                  <span className="text-sm font-medium">Free Delivery on all orders</span>
                </label>

                {/* Food Discount Benefit Toggle */}
                <div className="space-y-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                  <label className="flex items-center space-x-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.hasFoodDiscount}
                      onChange={(e) => setFormData({ ...formData, hasFoodDiscount: e.target.checked })}
                      className="w-4 h-4 text-amber-500 rounded-sm focus:ring-amber-500"
                    />
                    <span className="text-sm font-medium">Discount on Food Subtotal</span>
                  </label>

                  {formData.hasFoodDiscount && (
                    <div className="ml-7 grid grid-cols-2 gap-3 pt-2">
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Discount Type</label>
                        <select
                          value={formData.foodDiscountType}
                          onChange={(e) => setFormData({ ...formData, foodDiscountType: e.target.value })}
                          className="w-full px-2.5 py-1.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-xs"
                        >
                          <option value="percentage">Percentage (%)</option>
                          <option value="flat">Flat Amount (₹)</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Discount Value</label>
                        <input
                          type="number"
                          min={1}
                          value={formData.foodDiscountValue}
                          onChange={(e) => setFormData({ ...formData, foodDiscountValue: e.target.value })}
                          className="w-full px-2.5 py-1.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-xs"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="flex items-center justify-end space-x-3 pt-4 border-t border-gray-100 dark:border-gray-700">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-medium text-sm rounded-xl shadow-md disabled:opacity-50"
                >
                  {saving ? "Saving..." : editingPlan ? "Update Plan" : "Create Plan"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
