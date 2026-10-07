import mongoose from 'mongoose';
import { ValidationError } from '../../../../core/auth/errors.js';
import { FoodUserWallet } from '../models/userWallet.model.js';
import { config } from '../../../../config/env.js';
import {
    createRazorpayOrder,
    fetchRazorpayOrder,
    fetchRazorpayPayment,
    getRazorpayKeyId,
    isRazorpayConfigured,
    verifyPaymentSignature
} from '../../orders/helpers/razorpay.helper.js';

const ensureWallet = async (userId) => {
    const id = String(userId || '');
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
        throw new ValidationError('User not found');
    }
    const oid = new mongoose.Types.ObjectId(id);
    const existing = await FoodUserWallet.findOne({ userId: oid });
    if (existing) return existing;
    return FoodUserWallet.create({ userId: oid, balance: 0, transactions: [] });
};

export const creditReferralReward = async (userId, amountInr, metadata = {}) => {
    const amount = Number(amountInr);
    if (!Number.isFinite(amount) || amount <= 0) {
        return { wallet: await getUserWallet(userId) };
    }
    const wallet = await ensureWallet(userId);
    wallet.transactions.unshift({
        type: 'addition',
        amount,
        status: 'Completed',
        description: 'Referral reward',
        metadata: { source: 'referral_reward', ...(metadata || {}) }
    });
    wallet.balance = Number(wallet.balance || 0) + amount;
    wallet.referralEarnings = Number(wallet.referralEarnings || 0) + amount;
    await wallet.save();
    return { wallet: await getUserWallet(userId) };
};

export const getUserWallet = async (userId) => {
    const id = String(userId || '');
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
        throw new ValidationError('User not found');
    }
    const oid = new mongoose.Types.ObjectId(id);
    const wallet = await FoodUserWallet.findOne({ userId: oid });
    if (!wallet) {
        return { balance: 0, referralEarnings: 0, transactions: [] };
    }
    // Return newest first (UI expects recent transactions on top)
    const tx = Array.isArray(wallet.transactions) ? [...wallet.transactions].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)) : [];
    return {
        balance: Number(wallet.balance) || 0,
        referralEarnings: Number(wallet.referralEarnings) || 0,
        transactions: tx.map((t) => ({
            id: String(t._id),
            _id: t._id,
            type: t.type,
            amount: Number(t.amount) || 0,
            status: t.status || 'Completed',
            description: t.description || '',
            date: t.createdAt,
            createdAt: t.createdAt,
            metadata: t.metadata || {}
        }))
    };
};

export const createWalletTopupOrder = async (userId, amountInr) => {
    const amount = Number(amountInr);
    if (!Number.isFinite(amount) || amount <= 0) {
        throw new ValidationError('Amount must be greater than 0');
    }
    if (amount > 50000) {
        throw new ValidationError('Maximum amount is 50,000');
    }

    const amountPaise = Math.round(amount * 100);

    if (!isRazorpayConfigured()) {
        // Dev fallback: return a compatible shape without writing to DB.
        const orderId = `order_dev_${Date.now()}`;
        return {
            razorpay: {
                key: getRazorpayKeyId() || 'rzp_test_dummy',
                orderId,
                amount: amountPaise,
                currency: 'INR'
            }
        };
    }

    const receipt = `wallet_topup_${String(userId).slice(-8)}_${Date.now()}`;
    // notes let the webhook credit the right wallet even if the app never calls verify.
    const order = await createRazorpayOrder(amountPaise, 'INR', receipt, {
        type: 'wallet_topup',
        userId: String(userId)
    });

    return {
        razorpay: {
            key: getRazorpayKeyId(),
            orderId: String(order.id),
            amount: Number(order.amount) || amountPaise,
            currency: order.currency || 'INR'
        }
    };
};

/**
 * Credits a verified Razorpay top-up exactly once. Atomic: the update only matches while no
 * transaction with this Razorpay order id exists, so a double tap, a retry, or the client
 * callback racing the webhook can never credit twice.
 */
export const creditVerifiedWalletTopup = async ({ userId, razorpayOrderId, razorpayPaymentId, razorpaySignature = '', amountInr, source = 'verify' }) => {
    const wallet = await ensureWallet(userId);
    const res = await FoodUserWallet.updateOne(
        { _id: wallet._id, 'transactions.razorpayOrderId': { $ne: razorpayOrderId } },
        {
            $push: {
                transactions: {
                    $each: [{
                        type: 'addition',
                        amount: amountInr,
                        status: 'Completed',
                        description: 'Wallet top-up',
                        metadata: { source: 'wallet_topup', mode: 'razorpay', via: source },
                        razorpayOrderId,
                        razorpayPaymentId,
                        razorpaySignature: razorpaySignature || null
                    }],
                    $position: 0
                }
            },
            $inc: { balance: amountInr }
        }
    );
    return { credited: res.modifiedCount > 0 };
};

export const verifyWalletTopupPayment = async (userId, payload) => {
    const orderId = String(payload?.razorpayOrderId || '').trim();
    const paymentId = String(payload?.razorpayPaymentId || '').trim();
    const signature = String(payload?.razorpaySignature || '').trim();

    if (!orderId) throw new ValidationError('razorpayOrderId is required');
    if (!paymentId) throw new ValidationError('razorpayPaymentId is required');
    if (!signature) throw new ValidationError('razorpaySignature is required');

    const wallet = await ensureWallet(userId);
    const existing = wallet.transactions.find((t) => String(t.razorpayOrderId || '') === orderId);
    if (existing && String(existing.status).toLowerCase() === 'completed') {
        return { wallet: await getUserWallet(userId) };
    }

    if (!isRazorpayConfigured()) {
        // Dev only: never credit money for free in production because of a missing config.
        if (config.nodeEnv === 'production') {
            throw new ValidationError('Payment gateway is not configured');
        }
        const devAmount = Number(payload?.amount);
        if (!Number.isFinite(devAmount) || devAmount <= 0) throw new ValidationError('amount is required');
        await creditVerifiedWalletTopup({
            userId, razorpayOrderId: orderId, razorpayPaymentId: paymentId, razorpaySignature: signature,
            amountInr: devAmount, source: 'dev'
        });
        return { wallet: await getUserWallet(userId) };
    }

    if (!verifyPaymentSignature(orderId, paymentId, signature)) {
        throw new ValidationError('Payment verification failed');
    }

    // Credit what Razorpay actually received. The amount sent by the client is never trusted
    // (otherwise a Rs 1 payment could be reported as Rs 50,000).
    let rzPayment = null;
    for (let attempt = 0; attempt < 3; attempt += 1) {
        rzPayment = await fetchRazorpayPayment(paymentId);
        if (rzPayment?.status === 'captured') break;
        await new Promise((resolve) => setTimeout(resolve, 700));
    }
    if (String(rzPayment?.order_id || '') !== orderId) {
        throw new ValidationError('Payment does not belong to this top-up');
    }
    if (rzPayment?.status !== 'captured') {
        throw new ValidationError('Payment is still being confirmed. Your wallet will be credited automatically once it completes.');
    }

    await creditVerifiedWalletTopup({
        userId,
        razorpayOrderId: orderId,
        razorpayPaymentId: paymentId,
        razorpaySignature: signature,
        amountInr: Number(rzPayment.amount) / 100,
        source: 'verify'
    });

    return { wallet: await getUserWallet(userId) };
};

/**
 * Webhook path: credit a captured top-up even when the app never called verify
 * (app killed, network drop). Only orders we created with type=wallet_topup notes qualify.
 */
export const creditWalletTopupFromWebhook = async ({ razorpayOrderId, razorpayPaymentId, amountPaise }) => {
    if (!isRazorpayConfigured() || !razorpayOrderId || !razorpayPaymentId) return { handled: false };
    const rzOrder = await fetchRazorpayOrder(razorpayOrderId);
    if (rzOrder?.notes?.type !== 'wallet_topup' || !rzOrder?.notes?.userId) return { handled: false };
    const amountInr = Number(amountPaise || rzOrder.amount_paid || 0) / 100;
    if (!Number.isFinite(amountInr) || amountInr <= 0) return { handled: false };
    const { credited } = await creditVerifiedWalletTopup({
        userId: rzOrder.notes.userId,
        razorpayOrderId,
        razorpayPaymentId,
        amountInr,
        source: 'webhook'
    });
    return { handled: true, credited };
};

export const deductWalletBalance = async (userId, amountInr, description = 'Order payment', metadata = {}) => {
    const amount = Number(amountInr);
    if (!Number.isFinite(amount) || amount <= 0) {
        throw new ValidationError('Invalid deduction amount');
    }

    const wallet = await ensureWallet(userId);
    if (wallet.balance < amount) {
        throw new ValidationError('Insufficient wallet balance');
    }

    wallet.transactions.unshift({
        type: 'deduction',
        amount,
        status: 'Completed',
        description,
        metadata: { source: 'order_payment', ...(metadata || {}) }
    });

    wallet.balance = Number(wallet.balance) - amount;
    await wallet.save();

    return { wallet: await getUserWallet(userId) };
};

export const refundWalletBalance = async (userId, amountInr, description = 'Order refund', metadata = {}) => {
    const amount = Number(amountInr);
    if (!Number.isFinite(amount) || amount <= 0) {
        return { wallet: await getUserWallet(userId) };
    }

    const wallet = await ensureWallet(userId);
    wallet.transactions.unshift({
        type: 'refund',
        amount,
        status: 'Completed',
        description,
        metadata: { source: 'order_refund', ...(metadata || {}) }
    });

    wallet.balance = Number(wallet.balance) + amount;
    await wallet.save();

    return { wallet: await getUserWallet(userId) };
};

export const topupUserWalletByAdmin = async (userId, amountInr, adminId, description = 'Admin Top-up') => {
    const amount = Number(amountInr);
    if (!Number.isFinite(amount) || amount <= 0) {
        throw new ValidationError('Invalid top-up amount');
    }

    const wallet = await ensureWallet(userId);
    wallet.transactions.unshift({
        type: 'addition',
        amount,
        status: 'Completed',
        description,
        metadata: { source: 'admin_topup', adminId: String(adminId) }
    });

    wallet.balance = Number(wallet.balance || 0) + amount;
    await wallet.save();

    return { wallet: await getUserWallet(userId) };
};

export const deductUserWalletByAdmin = async (userId, amountInr, adminId, description = 'Admin Deduction') => {
    const amount = Number(amountInr);
    if (!Number.isFinite(amount) || amount <= 0) {
        throw new ValidationError('Invalid deduction amount');
    }

    const wallet = await ensureWallet(userId);
    if (wallet.balance < amount) {
        throw new ValidationError('Insufficient wallet balance');
    }

    wallet.transactions.unshift({
        type: 'deduction',
        amount,
        status: 'Completed',
        description,
        metadata: { source: 'admin_deduction', adminId: String(adminId) }
    });

    wallet.balance = Number(wallet.balance) - amount;
    await wallet.save();

    return { wallet: await getUserWallet(userId) };
};
