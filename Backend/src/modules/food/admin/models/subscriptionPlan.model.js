import mongoose from 'mongoose';

const benefitSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      required: true,
      trim: true
      // e.g. 'FREE_DELIVERY', 'FOOD_DISCOUNT', 'CASHBACK', etc.
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

const foodSubscriptionPlanSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      unique: true
    },
    description: {
      type: String,
      default: ''
    },
    durationDays: {
      type: Number,
      required: true,
      min: 1
    },
    price: {
      type: Number,
      required: true,
      min: 0
    },
    gstPercentage: {
      type: Number,
      default: 18,
      min: 0
    },
    totalAmount: {
      type: Number,
      required: true,
      min: 0
    },
    benefits: [benefitSchema],
    isActive: {
      type: Boolean,
      default: true,
      index: true
    },
    sortOrder: {
      type: Number,
      default: 0,
      index: true
    }
  },
  {
    collection: 'food_subscription_plans',
    timestamps: true
  }
);

foodSubscriptionPlanSchema.pre('validate', function (next) {
  if (this.price != null && this.gstPercentage != null) {
    const calculatedGst = this.price * (this.gstPercentage / 100);
    this.totalAmount = Math.round((this.price + calculatedGst) * 100) / 100;
  }
  next();
});

foodSubscriptionPlanSchema.index({ isActive: 1, sortOrder: 1 });

export const FoodSubscriptionPlan = mongoose.model('FoodSubscriptionPlan', foodSubscriptionPlanSchema);
