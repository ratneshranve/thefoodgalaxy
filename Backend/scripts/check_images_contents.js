import mongoose from 'mongoose';
import { FoodItem } from '../src/modules/food/admin/models/food.model.js';
import dotenv from 'dotenv';
dotenv.config();

async function check() {
    await mongoose.connect(process.env.MONGODB_URI);
    const count = await FoodItem.countDocuments({ image: { $ne: '' } });
    const count2 = await FoodItem.countDocuments({ image: { $regex: 'thefoodgalaxy', $options: 'i' } });
    console.log('Non-empty images:', count);
    console.log('the food galaxy images:', count2);
    const sample = await FoodItem.findOne({ image: { $ne: '' } });
    console.log('Sample image:', sample ? sample.image : 'None');
    process.exit(0);
}
check();
