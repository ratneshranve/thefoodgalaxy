import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRestaurantNotifications } from '@food/hooks/useRestaurantNotifications';

export default function GlobalPickupOtpModal() {
  const { pickupOtpReveal, clearPickupOtpReveal } = useRestaurantNotifications();

  return (
    <AnimatePresence>
      {pickupOtpReveal && (
        <motion.div
          className="fixed inset-0 z-[100] bg-black/50 flex items-center justify-center px-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={clearPickupOtpReveal}
        >
          <motion.div
            className="w-full max-w-sm bg-white rounded-3xl p-6 shadow-2xl"
            initial={{ scale: 0.85, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.85, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-col items-center text-center">
              <div className="w-14 h-14 rounded-full bg-orange-100 flex items-center justify-center mb-4">
                <span className="text-2xl">🛵</span>
              </div>
              <p className="text-xs font-black text-orange-600 uppercase tracking-widest mb-1">Delivery Partner Arrived</p>
              <p className="text-[13px] text-gray-500 font-medium mb-5">
                Share this OTP with the delivery partner for Order #{pickupOtpReveal.orderId || ''}
              </p>
              <div className="w-full bg-emerald-50 border-2 border-emerald-200 rounded-2xl py-4 px-6 mb-5">
                <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider mb-1">Pickup Verification OTP</p>
                <p className="text-4xl font-black text-emerald-800 tracking-[0.3em]">{pickupOtpReveal.otp}</p>
              </div>
              <p className="text-[11px] text-gray-400 font-medium mb-4">Tell this code to the delivery partner so they can complete the pickup.</p>
              <button
                onClick={clearPickupOtpReveal}
                className="w-full py-3 rounded-xl bg-gray-900 text-white font-bold text-sm"
              >
                Got it
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
