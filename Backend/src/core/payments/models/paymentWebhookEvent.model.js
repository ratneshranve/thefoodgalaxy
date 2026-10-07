import mongoose from 'mongoose';

/**
 * One row per Razorpay webhook delivery (x-razorpay-event-id). The unique index makes
 * duplicate deliveries a no-op; rows expire after 30 days.
 */
const paymentWebhookEventSchema = new mongoose.Schema(
    {
        eventId: { type: String, required: true, unique: true },
        event: { type: String, default: '' },
        createdAt: { type: Date, default: Date.now, expires: 30 * 24 * 60 * 60 }
    },
    { collection: 'payment_webhook_events' }
);

export const PaymentWebhookEvent =
    mongoose.models.PaymentWebhookEvent ||
    mongoose.model('PaymentWebhookEvent', paymentWebhookEventSchema);
