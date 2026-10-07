import crypto from 'crypto';
import { FoodOrder } from '../../../modules/food/orders/models/order.model.js';
import { PaymentWebhookEvent } from '../models/paymentWebhookEvent.model.js';
import { config } from '../../../config/env.js';
import { logger } from '../../../utils/logger.js';

const safeEqual = (a, b) => {
    const left = Buffer.from(String(a || ''), 'utf8');
    const right = Buffer.from(String(b || ''), 'utf8');
    return left.length === right.length && crypto.timingSafeEqual(left, right);
};

/**
 * Centralized Razorpay webhook handler.
 *
 * Safety properties:
 *  - signature is verified on the raw body with a constant-time compare;
 *  - each delivery (x-razorpay-event-id) is processed once; Razorpay retries are acknowledged;
 *  - a captured payment goes through confirmOnlinePayment(), the same idempotent path as the
 *    client callback, so the restaurant is notified and the order dispatched exactly once even
 *    when the webhook and the app callback arrive together (or the app never calls back);
 *  - on an internal failure the dedupe row is removed and 500 is returned so Razorpay retries.
 */
export const handleRazorpayWebhook = async (req, res) => {
    const signature = req.headers['x-razorpay-signature'];
    const secret = config.razorpayWebhookSecret;

    if (!signature || !secret || !req.rawBody) {
        logger.warn('Razorpay Webhook: Missing signature, secret or rawBody buffer.');
        return res.status(400).send('Invalid signature');
    }

    const expected = crypto.createHmac('sha256', secret).update(req.rawBody).digest('hex');
    if (!safeEqual(expected, signature)) {
        logger.warn('Razorpay Webhook: Signature verification failed.');
        return res.status(400).send('Invalid signature');
    }

    const { event, payload } = req.body || {};
    const eventId = req.headers['x-razorpay-event-id'];
    logger.info(`Razorpay Webhook Received: ${event} (${eventId || 'no event id'})`);

    let dedupeRowCreated = false;
    try {
        if (eventId) {
            try {
                await PaymentWebhookEvent.create({ eventId: String(eventId), event: String(event || '') });
                dedupeRowCreated = true;
            } catch (dupErr) {
                if (dupErr?.code === 11000) {
                    logger.info(`Razorpay Webhook: duplicate delivery ${eventId} ignored.`);
                    return res.status(200).json({ status: 'duplicate' });
                }
                throw dupErr;
            }
        }

        // --- Payment captured / order paid ---
        if (event === 'payment.captured' || event === 'order.paid') {
            const paymentObj = payload?.payment?.entity;
            const rzOrderId = paymentObj?.order_id || payload?.order?.entity?.id;
            const rzPaymentId = paymentObj?.id;

            if (rzOrderId && rzPaymentId) {
                const order = await FoodOrder.findOne({ 'payment.razorpay.orderId': rzOrderId }).select('_id').lean();
                if (order) {
                    // Imported lazily: order.service pulls in most of the backend.
                    const { confirmOnlinePayment } = await import('../../../modules/food/orders/services/order.service.js');
                    const result = await confirmOnlinePayment(order._id, {
                        paymentId: rzPaymentId,
                        source: 'webhook'
                    });
                    logger.info(
                        `Webhook [${event}]: order ${order._id} ${result.claimed ? 'confirmed' : 'already confirmed'}`
                    );
                } else {
                    // Not a food order: it may be a subscription purchase or a wallet top-up.
                    const { handleSubscriptionWebhook } = await import('../../../modules/food/user/services/userSubscription.service.js');
                    const sub = await handleSubscriptionWebhook(req.body);
                    if (!sub?.activated) {
                        const { creditWalletTopupFromWebhook } = await import('../../../modules/food/user/services/userWallet.service.js');
                        const topup = await creditWalletTopupFromWebhook({
                            razorpayOrderId: rzOrderId,
                            razorpayPaymentId: rzPaymentId,
                            amountPaise: paymentObj?.amount
                        });
                        logger.info(`Webhook [${event}]: RZ-Order ${rzOrderId} wallet top-up ${topup.handled ? (topup.credited ? 'credited' : 'already credited') : 'not applicable'}`);
                    } else {
                        logger.info(`Webhook [${event}]: subscription activated for RZ-Order ${rzOrderId}`);
                    }
                }
            }
        }

        // --- Payment failed (informational: the customer can retry inside the same checkout) ---
        if (event === 'payment.failed') {
            const paymentObj = payload?.payment?.entity;
            logger.info(
                `Webhook [payment.failed]: RZ-Order ${paymentObj?.order_id} payment ${paymentObj?.id} - ${paymentObj?.error_description || 'no reason'}`
            );
        }

        // --- Refund processed ---
        if (event === 'refund.processed') {
            const refundObj = payload?.refund?.entity;
            const rzPaymentId = refundObj?.payment_id;
            const rzRefundId = refundObj?.id;
            const refundAmount = Number(refundObj?.amount || 0) / 100;

            const order = await FoodOrder.findOneAndUpdate(
                {
                    'payment.razorpay.paymentId': rzPaymentId,
                    'payment.refund.status': { $ne: 'processed' }
                },
                {
                    $set: {
                        'payment.status': 'refunded',
                        'payment.refund': {
                            status: 'processed',
                            amount: refundAmount,
                            refundId: rzRefundId,
                            processedAt: new Date()
                        }
                    }
                },
                { new: true }
            );
            if (order) {
                logger.info(`Webhook [refund.processed]: Synced Order ${order.orderId} (Refunded)`);
            } else {
                logger.warn(`Webhook [refund.processed]: Order not found or already refunded for RZ-Payment: ${rzPaymentId}`);
            }
        }

        return res.status(200).json({ status: 'ok' });
    } catch (err) {
        logger.error(`Razorpay Webhook Logic Error: ${err.message}`);
        if (dedupeRowCreated && eventId) {
            await PaymentWebhookEvent.deleteOne({ eventId: String(eventId) }).catch(() => {});
        }
        return res.status(500).json({ message: 'Internal Server Error' });
    }
};
