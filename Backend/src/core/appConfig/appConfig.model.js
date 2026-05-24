import mongoose from 'mongoose';

const appConfigSchema = new mongoose.Schema({
    appName: {
        type: String,
        required: true,
        enum: ['user_app', 'delivery_app', 'restaurant_app'],
        unique: true
    },
    primaryColor: {
        type: String,
        default: '#e11d48'
    },
    secondaryColor: {
        type: String,
        default: '#be123c'
    },
    logoUrl: {
        type: String,
        default: ''
    }
}, { timestamps: true });

export const AppConfig = mongoose.model('AppConfig', appConfigSchema);
