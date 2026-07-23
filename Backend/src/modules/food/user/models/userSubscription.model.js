import mongoose from 'mongoose';

const userBenefitSnapshotSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      required: true,
      trim: true
    },
    title: {
      type: String,
      required: true,
      trim: true
    },
    description: {
      type: String,
      default: ''
    },
    discountType: {
      type: String,
      enum: ['percentage', 'flat', null],
      default: null
    },
    discountValue: {
      type: Number,
      default: 0
    },
    maxDiscount: {
      type: Number,
      default: 0
    },
    config: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    }
  },
  { _id: false }
);

const planSnapshotSchema = new mongoose.Schema(
  {
    planId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'FoodSubscriptionPlan'
    },
    name: {
      type: String,
      required: true,
      trim: true
    },
    description: {
      type: String,
      default: ''
    },
    durationDays: {
      type: Number,
      required: true
    },
    price: {
      type: Number,
      required: true
    },
    gstPercentage: {
      type: Number,
      default: 18
    },
    totalAmount: {
      type: Number,
      required: true
    },
    benefits: [userBenefitSnapshotSchema]
  },
  { _id: false }
);

const foodUserSubscriptionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'FoodUser',
      required: true,
      index: true
    },
    planId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'FoodSubscriptionPlan',
      required: true,
      index: true
    },
    planSnapshot: {
      type: planSnapshotSchema,
      required: true
    },
    totalAmount: {
      type: Number,
      required: true
    },
    startDate: {
      type: Date,
      default: null
    },
    endDate: {
      type: Date,
      default: null,
      index: true
    },
    status: {
      type: String,
      enum: ['pending', 'active', 'expired', 'failed', 'cancelled'],
      default: 'pending',
      index: true
    },
    razorpayOrderId: {
      type: String,
      trim: true,
      index: true
    },
    razorpayPaymentId: {
      type: String,
      trim: true
    },
    razorpaySignature: {
      type: String,
      trim: true
    },
    totalSavingsAccrued: {
      type: Number,
      default: 0
    },
    notified7Days: {
      type: Boolean,
      default: false
    },
    notified1Day: {
      type: Boolean,
      default: false
    }
  },
  {
    collection: 'food_user_subscriptions',
    timestamps: true
  }
);

foodUserSubscriptionSchema.index({ userId: 1, status: 1 });
foodUserSubscriptionSchema.index({ status: 1, endDate: 1 });

export const FoodUserSubscription = mongoose.model('FoodUserSubscription', foodUserSubscriptionSchema);
