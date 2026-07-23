import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Crown,
  CheckCircle2,
  Sparkles,
  ShieldCheck,
  ArrowLeft,
  RefreshCw,
  AlertCircle,
  Truck,
  Percent,
  Clock,
  IndianRupee,
  Lock
} from "lucide-react";
import AnimatedPage from "@food/components/user/AnimatedPage";
import { userSubscriptionAPI } from "@/services/api/subscription";
import { loadRazorpayScript } from "@food/utils/razorpay";
import { toast } from "sonner";
import confetti from "canvas-confetti";
import useAppBackNavigation from "@food/hooks/useAppBackNavigation";

export default function SubscriptionsPage() {
  const navigate = useNavigate();
  const goBack = useAppBackNavigation();

  const [plans, setPlans] = useState([]);
  const [activeSub, setActiveSub] = useState(null);
  const [loading, setLoading] = useState(true);
  const [purchasingPlanId, setPurchasingPlanId] = useState(null);

  useEffect(() => {
    fetchSubscriptionData();
  }, []);

  const fetchSubscriptionData = async () => {
    setLoading(true);
    try {
      const plansRes = await userSubscriptionAPI.getPublicPlans();
      if (plansRes?.data?.data?.plans) {
        setPlans(plansRes.data.data.plans);
      }
      
      // Attempt to fetch active subscription (will fail if guest/unauthenticated)
      try {
        const activeSubRes = await userSubscriptionAPI.getActiveSubscription();
        if (activeSubRes?.data?.data?.subscription) {
          setActiveSub(activeSubRes.data.data.subscription);
        } else {
          setActiveSub(null);
        }
      } catch (authErr) {
        // User not logged in or no active subscription
        setActiveSub(null);
      }
    } catch (err) {
      console.error("Failed to load subscriptions:", err);
      toast.error("Failed to load subscription plans");
    } finally {
      setLoading(false);
    }
  };

  const handleBuyNow = async (plan) => {
    if (activeSub) {
      toast.error("You already have an active subscription!");
      return;
    }

    setPurchasingPlanId(plan._id);
    try {
      // 1. Create order on backend
      const res = await userSubscriptionAPI.createSubscriptionOrder(plan._id);
      const data = res?.data?.data;

      if (!data) {
        throw new Error("Invalid response from server");
      }

      const { razorpayOrder, razorpayKeyId, isMock } = data;

      // Handle Mock payment mode (if Razorpay keys aren't configured in test env)
      if (isMock) {
        toast.info("Processing in Test Mode...");
        const verifyRes = await userSubscriptionAPI.verifySubscriptionPayment({
          razorpayOrderId: razorpayOrder.id,
          razorpayPaymentId: `pay_mock_${Date.now()}`
        });

        if (verifyRes?.data?.data?.subscription) {
          triggerSuccessConfetti();
          toast.success(`Congratulations! You are now subscribed to ${plan.name}`);
          fetchSubscriptionData();
        }
        setPurchasingPlanId(null);
        return;
      }

      // 2. Load Razorpay script & launch checkout modal
      await loadRazorpayScript();

      const options = {
        key: razorpayKeyId,
        amount: razorpayOrder.amount,
        currency: razorpayOrder.currency || "INR",
        name: "TheFoodGalaxy Club",
        description: `${plan.name} Subscription Plan`,
        order_id: razorpayOrder.id,
        handler: async (response) => {
          try {
            toast.loading("Verifying payment...", { id: "verify-toast" });
            const verifyRes = await userSubscriptionAPI.verifySubscriptionPayment({
              razorpayOrderId: response.razorpay_order_id,
              razorpayPaymentId: response.razorpay_payment_id,
              razorpaySignature: response.razorpay_signature
            });

            toast.dismiss("verify-toast");
            if (verifyRes?.data?.data?.subscription) {
              triggerSuccessConfetti();
              toast.success(`Subscription activated! Welcome to ${plan.name}`);
              fetchSubscriptionData();
            }
          } catch (verifyErr) {
            toast.dismiss("verify-toast");
            toast.error(verifyErr.response?.data?.message || "Payment verification failed.");
          } finally {
            setPurchasingPlanId(null);
          }
        },
        modal: {
          ondismiss: () => {
            toast.info("Payment cancelled. You can retry anytime.");
            setPurchasingPlanId(null);
          }
        },
        theme: {
          color: "#f59e0b"
        }
      };

      const razorpayInstance = new window.Razorpay(options);
      razorpayInstance.on("payment.failed", (failureRes) => {
        toast.error(`Payment failed: ${failureRes.error?.description || "Transaction declined"}`);
        setPurchasingPlanId(null);
      });
      razorpayInstance.open();

    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || err.message || "Failed to initiate payment");
      setPurchasingPlanId(null);
    }
  };

  const triggerSuccessConfetti = () => {
    try {
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 }
      });
    } catch {
      // Ignore if confetti fails
    }
  };

  const calculateDaysLeft = (endDateStr) => {
    if (!endDateStr) return 0;
    const end = new Date(endDateStr).getTime();
    const now = new Date().getTime();
    const diff = end - now;
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  };

  return (
    <AnimatedPage className="min-h-screen bg-gray-50 dark:bg-gray-950 pb-24 text-gray-900 dark:text-gray-100">
      {/* Top Header */}
      <div className="sticky top-0 z-30 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md border-b border-gray-200/80 dark:border-gray-800 px-4 py-3 flex items-center space-x-3">
        <button
          onClick={goBack}
          className="p-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex items-center space-x-2">
          <Crown className="w-5 h-5 text-amber-500" />
          <h1 className="font-bold text-lg">Subscriptions & Membership</h1>
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-4 space-y-6">
        {/* Hero Section */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-gray-950 via-gray-900 to-amber-950 text-white p-6 sm:p-8 shadow-xl border border-amber-500/30">
          <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
            <div className="space-y-2">
              <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">
                <Sparkles className="w-3.5 h-3.5" />
                <span>TheFoodGalaxy VIP Club</span>
              </span>
              <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
                Unlock Free Delivery & Food Discounts
              </h2>
              <p className="text-sm text-gray-300 max-w-md">
                Subscribe to your favorite plan and start saving big on every food order!
              </p>
            </div>
            <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl backdrop-blur-xs flex items-center space-x-3">
              <Crown className="w-10 h-10 text-amber-400" />
              <div>
                <p className="text-xs text-amber-300 font-medium">Exclusive Membership</p>
                <p className="text-sm font-bold text-white">Save on Every Order</p>
              </div>
            </div>
          </div>
        </div>

        {/* Loading Indicator */}
        {loading ? (
          <div className="py-16 text-center space-y-3">
            <RefreshCw className="w-8 h-8 text-amber-500 animate-spin mx-auto" />
            <p className="text-sm text-gray-500">Loading available plans...</p>
          </div>
        ) : (
          <>
            {/* Active Subscription Banner / Card */}
            {activeSub && (
              <div className="relative overflow-hidden bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-amber-500/5 rounded-3xl p-6 border-2 border-amber-500/50 shadow-lg">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-amber-500/20 pb-4">
                  <div className="flex items-center space-x-3">
                    <div className="p-3 bg-amber-500 text-white rounded-2xl shadow-md">
                      <Crown className="w-6 h-6" />
                    </div>
                    <div>
                      <div className="flex items-center space-x-2">
                        <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                          {activeSub.planSnapshot?.name || "VIP Subscription"}
                        </h3>
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500 text-white">
                          Active
                        </span>
                      </div>
                      <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">
                        Expires in {calculateDaysLeft(activeSub.endDate)} Days (
                        {new Date(activeSub.endDate).toLocaleDateString("en-IN")})
                      </p>
                    </div>
                  </div>
                  <div className="text-right bg-white dark:bg-gray-800 px-4 py-2 rounded-2xl border border-amber-500/30">
                    <p className="text-xs text-gray-500 font-medium">Total Savings Accrued</p>
                    <p className="text-lg font-extrabold text-emerald-600 dark:text-emerald-400">
                      ₹{activeSub.totalSavingsAccrued || 0}
                    </p>
                  </div>
                </div>

                {/* Benefits Active */}
                <div className="mt-4 pt-2">
                  <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wider mb-2">
                    Your Active Member Benefits:
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {Array.isArray(activeSub.planSnapshot?.benefits) &&
                      activeSub.planSnapshot.benefits.map((b, idx) => (
                        <div key={idx} className="flex items-center space-x-2 text-sm font-medium">
                          <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                          <span>{b.title}</span>
                        </div>
                      ))}
                  </div>
                </div>

                <div className="mt-4 p-3 bg-amber-500/10 rounded-xl flex items-center space-x-2 text-xs text-amber-700 dark:text-amber-300 font-medium">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>
                    You can only have one active subscription at a time. New plan purchases are paused until expiration.
                  </span>
                </div>
              </div>
            )}

            {/* Available Plans Section */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                  Available Subscription Plans
                </h3>
                {activeSub && (
                  <span className="text-xs text-amber-600 dark:text-amber-400 font-medium">
                    (Single Active Plan Enforced)
                  </span>
                )}
              </div>

              {plans.length === 0 ? (
                <div className="bg-white dark:bg-gray-900 p-8 rounded-2xl text-center border border-gray-200 dark:border-gray-800">
                  <p className="text-gray-500 text-sm">No subscription plans currently available.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {plans.map((plan) => {
                    const p = Number(plan.price) || 0;
                    const g = Number(plan.gstPercentage) || 0;
                    const totalFormatted = plan.totalAmount ? plan.totalAmount.toFixed(2) : (p + p * (g / 100)).toFixed(2);
                    const isPurchasing = purchasingPlanId === plan._id;

                    return (
                      <div
                        key={plan._id}
                        className={`bg-white dark:bg-gray-900 rounded-3xl p-6 border transition-all duration-300 shadow-sm hover:shadow-xl relative flex flex-col justify-between ${
                          activeSub
                            ? "border-gray-200 dark:border-gray-800 opacity-80"
                            : "border-amber-500/30 hover:border-amber-500"
                        }`}
                      >
                        <div>
                          <div className="flex items-center justify-between mb-3">
                            <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-extrabold bg-gradient-to-r from-amber-500/10 to-orange-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                              <Crown className="w-3.5 h-3.5" />
                              <span>{plan.name}</span>
                            </span>
                            <span className="text-xs font-semibold text-gray-500">
                              {plan.durationDays} Days
                            </span>
                          </div>

                          <h4 className="text-2xl font-black text-gray-900 dark:text-white mb-1">
                            ₹{totalFormatted}
                          </h4>
                          <p className="text-xs text-gray-500 mb-4">
                            ₹{plan.price || 0} + {plan.gstPercentage || 0}% GST (Inclusive of all taxes)
                          </p>

                          <p className="text-xs text-gray-600 dark:text-gray-400 mb-4 line-clamp-2">
                            {plan.description || "Includes premium savings on every food order."}
                          </p>

                          {/* Benefits Checklist */}
                          <div className="space-y-2 border-t border-gray-100 dark:border-gray-800 pt-4 mb-6">
                            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
                              Plan Benefits:
                            </p>
                            {Array.isArray(plan.benefits) &&
                              plan.benefits.map((b, idx) => (
                                <div key={idx} className="flex items-center space-x-2 text-xs font-semibold text-gray-800 dark:text-gray-200">
                                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                                  <span>{b.title}</span>
                                </div>
                              ))}
                          </div>
                        </div>

                        {/* Buy Button */}
                        <div>
                          {activeSub ? (
                            <button
                              disabled
                              className="w-full py-3 bg-gray-100 dark:bg-gray-800 text-gray-400 text-xs font-bold rounded-2xl flex items-center justify-center space-x-2 cursor-not-allowed border border-gray-200 dark:border-gray-700"
                            >
                              <Lock className="w-4 h-4" />
                              <span>Already Subscribed</span>
                            </button>
                          ) : (
                            <button
                              onClick={() => handleBuyNow(plan)}
                              disabled={isPurchasing}
                              className="w-full py-3.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white text-sm font-bold rounded-2xl shadow-lg transition-all transform active:scale-95 flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-50"
                            >
                              {isPurchasing ? (
                                <>
                                  <RefreshCw className="w-4 h-4 animate-spin" />
                                  <span>Redirecting to Payment...</span>
                                </>
                              ) : (
                                <>
                                  <Sparkles className="w-4 h-4" />
                                  <span>Buy Now (₹{totalFormatted})</span>
                                </>
                              )}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </AnimatedPage>
  );
}
