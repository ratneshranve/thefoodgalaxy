import React, { Suspense, lazy, useCallback, useState } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import PullToRefresh from '@/shared/components/PullToRefresh';
import ProtectedRoute from './components/ProtectedRoute';
import Loader from "@food/components/Loader";

// Auth Pages (Lazy loaded)
const Welcome = lazy(() => import("./pages/auth/Welcome"))
const SignIn = lazy(() => import("./pages/auth/SignIn"))
const OTP = lazy(() => import("./pages/auth/OTP"))
const SignupStep1 = lazy(() => import("./pages/auth/SignupStep1"))
const SignupStep2 = lazy(() => import("./pages/auth/SignupStep2"))

// V2 Pages
import DeliveryHomeV2 from './pages/DeliveryHomeV2';
import { PayoutV2 } from './pages/pocket/PayoutV2';
import { PocketStatementV2 } from './pages/pocket/PocketStatementV2';
import { DeductionStatementV2 } from './pages/pocket/DeductionStatementV2';
import { LimitSettlementV2 } from './pages/pocket/LimitSettlementV2';
import { PocketBalanceV2 } from './pages/pocket/PocketBalanceV2';
import { CashLimitInfoV2 } from './pages/pocket/CashLimitInfoV2';
import { ProfileBankV2 } from './pages/profile/ProfileBankV2';
import { ProfileDocsV2 } from './pages/profile/ProfileDocsV2';
import { SupportTicketsV2 } from './pages/help/SupportTicketsV2';
import { CreateSupportTicketV2 } from './pages/help/CreateSupportTicketV2';
import { ViewSupportTicketV2 } from './pages/help/ViewSupportTicketV2';
import { PublicSupportV2 } from './pages/help/PublicSupportV2';
import ShowIdCardV2 from './pages/help/ShowIdCardV2';
import { PocketDetailsV2 } from './pages/pocket/PocketDetailsV2';
import { ProfileDetailsV2 } from './pages/profile/ProfileDetailsV2';
import TermsAndConditionsV2 from './pages/TermsAndConditionsV2';
import PrivacyPolicyV2 from './pages/PrivacyPolicyV2';
import NotificationsV2 from './pages/NotificationsV2';



// Bug #116: pull-to-refresh. Not on the live map feed (pull-down there pans the
// map / drags the order sheet) or on auth/registration screens.
const PULL_REFRESH_DISABLED = /^\/food\/delivery\/?(feed\/?)?$|\/(welcome|login|otp|signup)(\/|$)/;

// Bug #126: referral links point to "/signup?ref=<code>", but that route simply
// redirected to login and dropped the code. Remember it for the signup form.
const DELIVERY_REFERRAL_KEY = 'pending_delivery_referral';
const SignupReferralRedirect = () => {
  const location = useLocation();
  const ref = new URLSearchParams(location.search || '').get('ref');
  if (ref) {
    try {
      localStorage.setItem(DELIVERY_REFERRAL_KEY, String(ref).trim().slice(0, 64));
    } catch {
      /* ignore storage errors */
    }
  }
  return <Navigate to={`/food/delivery/login${location.search || ''}`} replace />;
};

const DeliveryV2Router = () => {
  const location = useLocation();
  const [refreshKey, setRefreshKey] = useState(0);
  const handlePullRefresh = useCallback(async () => {
    setRefreshKey((key) => key + 1);
    window.dispatchEvent(new Event('deliveryPullRefresh'));
    await new Promise((resolve) => setTimeout(resolve, 700));
  }, []);
  const pullRefreshEnabled = !PULL_REFRESH_DISABLED.test(location.pathname);

  return (
    <Suspense fallback={<Loader />}>
      <PullToRefresh onRefresh={handlePullRefresh} enabled={pullRefreshEnabled} />
      <Routes key={refreshKey}>
        {/* Auth routes */}
        <Route path="welcome" element={<Welcome />} />
        <Route path="login" element={<SignIn />} />
        <Route path="otp" element={<OTP />} />
        <Route path="signup" element={<SignupReferralRedirect />} />
        <Route path="signup/details" element={<SignupStep1 />} />
        <Route path="signup/documents" element={<SignupStep2 />} />
        <Route path="terms" element={<TermsAndConditionsV2 />} />
        <Route path="profile/privacy" element={<PrivacyPolicyV2 />} />
        <Route path="profile/terms" element={<TermsAndConditionsV2 />} />

        {/* Protected Core Routes */}
        <Route path="/" element={<ProtectedRoute><DeliveryHomeV2 tab="feed" /></ProtectedRoute>} />
        <Route path="/feed" element={<ProtectedRoute><DeliveryHomeV2 tab="feed" /></ProtectedRoute>} />
        <Route path="/pocket" element={<ProtectedRoute><DeliveryHomeV2 tab="pocket" /></ProtectedRoute>} />
        <Route path="/history" element={<ProtectedRoute><DeliveryHomeV2 tab="history" /></ProtectedRoute>} />
        <Route path="/profile" element={<ProtectedRoute><DeliveryHomeV2 tab="profile" /></ProtectedRoute>} />
        <Route path="/notifications" element={<ProtectedRoute><NotificationsV2 /></ProtectedRoute>} />
        <Route path="/profile/details" element={<ProtectedRoute><ProfileDetailsV2 /></ProtectedRoute>} />
        <Route path="/profile/bank" element={<ProtectedRoute><ProfileBankV2 /></ProtectedRoute>} />
        <Route path="/profile/documents" element={<ProtectedRoute><ProfileDocsV2 /></ProtectedRoute>} />
        
        {/* Support Systems */}
        <Route path="/support" element={<PublicSupportV2 />} />
        <Route path="/help/tickets" element={<ProtectedRoute><SupportTicketsV2 /></ProtectedRoute>} />
        <Route path="/help/tickets/create" element={<ProtectedRoute><CreateSupportTicketV2 /></ProtectedRoute>} />
        <Route path="/help/tickets/:ticketId" element={<ProtectedRoute><ViewSupportTicketV2 /></ProtectedRoute>} />
        <Route path="/help/id-card" element={<ProtectedRoute><ShowIdCardV2 /></ProtectedRoute>} />
        <Route path="/profile/terms" element={<ProtectedRoute><TermsAndConditionsV2 /></ProtectedRoute>} />
        <Route path="/profile/privacy" element={<ProtectedRoute><PrivacyPolicyV2 /></ProtectedRoute>} />
        
        {/* Financial Deep-Pages */}
        <Route path="/pocket/payout" element={<ProtectedRoute><PayoutV2 /></ProtectedRoute>} />
        <Route path="/pocket/statement" element={<ProtectedRoute><PocketStatementV2 /></ProtectedRoute>} />
        <Route path="/pocket/deductions" element={<ProtectedRoute><DeductionStatementV2 /></ProtectedRoute>} />
        <Route path="/pocket/limit-settlement" element={<ProtectedRoute><LimitSettlementV2 /></ProtectedRoute>} />
        <Route path="/pocket/balance" element={<ProtectedRoute><PocketBalanceV2 /></ProtectedRoute>} />
        <Route path="/pocket/cash-limit" element={<ProtectedRoute><CashLimitInfoV2 /></ProtectedRoute>} />
        <Route path="/pocket/details" element={<ProtectedRoute><PocketDetailsV2 /></ProtectedRoute>} />
        {/* Bug #118: "/earnings" had no route, so the fallback sent riders to home. */}
        <Route path="/earnings" element={<Navigate to="/food/delivery/pocket/details" replace />} />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/food/delivery" replace />} />
      </Routes>
    </Suspense>
  );
};

export default DeliveryV2Router;
