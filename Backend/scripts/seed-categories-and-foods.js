import path from 'path';
import dns from 'node:dns';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

import { FoodCategory } from '../src/modules/food/admin/models/category.model.js';
import { FoodItem } from '../src/modules/food/admin/models/food.model.js';
import { FoodRestaurant } from '../src/modules/food/restaurant/models/restaurant.model.js';

/**
 * Seeds global (admin) categories and veg food items under them, mirroring what
 * the admin panel creates by hand (see createCategory / createFood in admin.service.js).
 * No images are set. Safe to re-run: existing categories / items are skipped by name.
 *
 *   node scripts/seed-categories-and-foods.js            # dry run
 *   node scripts/seed-categories-and-foods.js --apply    # write to the database
 *   node scripts/seed-categories-and-foods.js --apply --restaurant=<id>   # target restaurant
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });
dns.setServers(['8.8.8.8', '1.1.1.1']);

const URI = process.env.MONGODB_URI || process.env.MONGO_URI;
if (!URI) throw new Error('Missing MONGODB_URI or MONGO_URI in Backend/.env');

const APPLY = process.argv.includes('--apply');
const restaurantArg = process.argv.find((a) => a.startsWith('--restaurant='));

// [name, price, description, prepTime, recommended]
const MENU = [
    { category: 'Starters', items: [
        ['Paneer Tikka', 249, 'Char-grilled cottage cheese cubes marinated in spiced yogurt.', '20 mins', true],
        ['Hara Bhara Kebab', 189, 'Spinach and green pea patties, shallow fried until crisp.', '15 mins', false],
        ['Veg Spring Rolls', 159, 'Crispy rolls stuffed with seasoned vegetables.', '15 mins', false],
        ['Crispy Corn', 179, 'Golden fried sweet corn tossed with pepper and spices.', '15 mins', false],
        ['Veg Manchurian Dry', 189, 'Vegetable dumplings tossed in a tangy Manchurian sauce.', '18 mins', false],
    ] },
    { category: 'Main Course', items: [
        ['Paneer Butter Masala', 269, 'Cottage cheese in a rich, creamy tomato gravy.', '25 mins', true],
        ['Dal Makhani', 219, 'Slow-cooked black lentils finished with butter and cream.', '25 mins', false],
        ['Kadai Paneer', 259, 'Paneer cooked with capsicum and freshly ground kadai masala.', '25 mins', false],
        ['Mix Veg Curry', 199, 'Seasonal vegetables in a mildly spiced onion-tomato gravy.', '20 mins', false],
        ['Palak Paneer', 249, 'Paneer cubes in a smooth spinach gravy.', '25 mins', false],
        ['Shahi Paneer', 279, 'Paneer in a royal cashew and cream gravy.', '25 mins', false],
    ] },
    { category: 'Breads', items: [
        ['Butter Naan', 49, 'Soft tandoor-baked bread brushed with butter.', '10 mins', false],
        ['Garlic Naan', 59, 'Naan topped with garlic and coriander.', '10 mins', true],
        ['Tandoori Roti', 29, 'Whole wheat bread baked in the tandoor.', '10 mins', false],
        ['Lachha Paratha', 55, 'Flaky layered whole wheat paratha.', '12 mins', false],
        ['Missi Roti', 45, 'Gram flour and wheat roti with mild spices.', '10 mins', false],
    ] },
    { category: 'Biryani & Rice', items: [
        ['Veg Biryani', 219, 'Fragrant basmati rice layered with vegetables and aromatic spices.', '25 mins', true],
        ['Paneer Biryani', 249, 'Dum biryani with marinated paneer and saffron rice.', '30 mins', false],
        ['Jeera Rice', 129, 'Basmati rice tempered with cumin and ghee.', '15 mins', false],
        ['Veg Pulao', 169, 'Lightly spiced rice cooked with seasonal vegetables.', '20 mins', false],
        ['Curd Rice', 119, 'Cool rice mixed with yogurt, tempered with mustard and curry leaves.', '10 mins', false],
    ] },
    { category: 'Pizza', items: [
        ['Margherita Pizza', 199, 'Classic pizza with tomato sauce and mozzarella.', '20 mins', true],
        ['Farmhouse Pizza', 299, 'Loaded with capsicum, onion, tomato, mushroom and sweet corn.', '25 mins', false],
        ['Paneer Tikka Pizza', 319, 'Spiced paneer tikka, onion and capsicum on a cheesy base.', '25 mins', false],
        ['Veggie Delight Pizza', 279, 'A colourful mix of garden vegetables and cheese.', '25 mins', false],
    ] },
    { category: 'Burgers & Sandwiches', items: [
        ['Aloo Tikki Burger', 99, 'Crispy potato patty with fresh veggies and chutney.', '12 mins', true],
        ['Veg Cheese Burger', 129, 'Veg patty topped with a cheese slice and creamy sauce.', '12 mins', false],
        ['Grilled Veg Sandwich', 119, 'Toasted sandwich with vegetables and green chutney.', '12 mins', false],
        ['Paneer Tikka Sandwich', 149, 'Grilled sandwich stuffed with spicy paneer tikka.', '15 mins', false],
    ] },
    { category: 'Chinese', items: [
        ['Veg Hakka Noodles', 169, 'Wok-tossed noodles with crunchy vegetables.', '18 mins', true],
        ['Veg Fried Rice', 159, 'Stir-fried rice with vegetables and soy sauce.', '18 mins', false],
        ['Veg Manchurian Gravy', 189, 'Vegetable balls in a spicy Manchurian gravy.', '20 mins', false],
        ['Schezwan Noodles', 179, 'Spicy noodles tossed in Schezwan sauce.', '18 mins', false],
        ['Hot and Sour Soup', 119, 'Tangy and peppery vegetable soup.', '10 mins', false],
    ] },
    { category: 'South Indian', items: [
        ['Masala Dosa', 119, 'Crispy rice crepe filled with spiced potato masala.', '15 mins', true],
        ['Idli Sambar', 89, 'Steamed rice cakes served with sambar and chutneys.', '10 mins', false],
        ['Medu Vada', 89, 'Crispy lentil donuts with sambar and chutney.', '12 mins', false],
        ['Uttapam', 109, 'Thick rice pancake topped with onion and tomato.', '15 mins', false],
        ['Rava Dosa', 129, 'Thin crispy semolina dosa with onion and green chilli.', '15 mins', false],
    ] },
    { category: 'Snacks', items: [
        ['Samosa (2 pcs)', 40, 'Crispy pastry filled with spiced potato and peas.', '10 mins', false],
        ['Vada Pav', 35, 'Mumbai-style spiced potato fritter in a soft bun.', '10 mins', true],
        ['Pav Bhaji', 149, 'Mashed vegetable curry served with buttered pav.', '15 mins', false],
        ['French Fries', 99, 'Golden crispy salted fries.', '10 mins', false],
        ['Paneer Pakoda', 139, 'Gram flour battered paneer fritters.', '12 mins', false],
    ] },
    { category: 'Desserts', items: [
        ['Gulab Jamun (2 pcs)', 69, 'Soft milk dumplings soaked in rose-cardamom syrup.', '5 mins', true],
        ['Rasmalai (2 pcs)', 99, 'Soft paneer discs in chilled saffron milk.', '5 mins', false],
        ['Gajar Ka Halwa', 119, 'Slow-cooked carrot pudding with dry fruits.', '10 mins', false],
        ['Chocolate Brownie', 109, 'Warm fudgy brownie with chocolate chunks.', '8 mins', false],
        ['Vanilla Ice Cream', 79, 'Two scoops of classic vanilla ice cream.', '5 mins', false],
    ] },
    { category: 'Cake', items: [
        ['Chocolate Truffle Pastry', 99, 'Rich chocolate sponge layered with truffle cream.', '5 mins', false],
        ['Black Forest Pastry', 89, 'Chocolate sponge with cream and cherries.', '5 mins', false],
        ['Pineapple Pastry', 85, 'Light vanilla sponge with pineapple cream.', '5 mins', false],
        ['Chocolate Cake (500g)', 499, 'Moist chocolate cake with ganache frosting.', '45 mins', true],
    ] },
    { category: 'Beverages', items: [
        ['Masala Chai', 29, 'Hot tea brewed with ginger and cardamom.', '5 mins', false],
        ['Cold Coffee', 99, 'Chilled blended coffee with ice cream.', '8 mins', true],
        ['Fresh Lime Soda', 59, 'Sweet and salty lime soda.', '5 mins', false],
        ['Mango Lassi', 89, 'Thick yogurt drink blended with mango.', '5 mins', false],
        ['Sweet Lassi', 69, 'Traditional sweet chilled yogurt drink.', '5 mins', false],
        ['Mineral Water (1L)', 25, 'Packaged drinking water.', '2 mins', false],
    ] },
];

await mongoose.connect(URI);
console.log(`DB: ${mongoose.connection.db.databaseName} | mode: ${APPLY ? 'APPLY' : 'DRY RUN'}`);

let restaurant;
if (restaurantArg) {
    restaurant = await FoodRestaurant.findById(restaurantArg.split('=')[1]).select('restaurantName pureVegRestaurant status').lean();
} else {
    restaurant = await FoodRestaurant.findOne({ status: 'approved' }).sort({ createdAt: 1 }).select('restaurantName pureVegRestaurant status').lean();
}
if (!restaurant?._id) throw new Error('No approved restaurant found. Pass --restaurant=<id>.');
console.log(`Restaurant: ${restaurant.restaurantName} (${restaurant._id})`);

let newCats = 0, existingCats = 0, newItems = 0, skippedItems = 0;
let order = 0;
for (const { category, items } of MENU) {
    order += 1;
    // Global (admin) categories only: restaurant-private ones with the same name are not reused.
    let cat = await FoodCategory.findOne({ name: category, restaurantId: { $exists: false } });
    if (cat) {
        existingCats += 1;
    } else {
        newCats += 1;
        if (APPLY) {
            cat = await FoodCategory.create({
                name: category,
                image: '',
                type: '',
                foodTypeScope: 'Veg',
                isActive: true,
                sortOrder: order,
                approvalStatus: 'approved',
                isApproved: true,
                approvedAt: new Date(),
            });
        }
    }
    console.log(`${cat ? 'Category exists' : (APPLY ? 'Category added ' : 'Category would add')}: ${category}`);

    for (const [name, price, description, preparationTime, isRecommended] of items) {
        const exists = await FoodItem.exists({ restaurantId: restaurant._id, name, categoryName: category });
        if (exists) { skippedItems += 1; continue; }
        newItems += 1;
        if (APPLY) {
            await FoodItem.create({
                restaurantId: restaurant._id,
                categoryId: cat._id,
                categoryName: category,
                name,
                description,
                price,
                variants: [],
                image: '',
                foodType: 'Veg',
                isAvailable: true,
                isRecommended,
                preparationTime,
                approvalStatus: 'approved',
                approvedAt: new Date(),
            });
        }
    }
}

console.log(`\nCategories: ${newCats} ${APPLY ? 'added' : 'to add'}, ${existingCats} already existed`);
console.log(`Food items: ${newItems} ${APPLY ? 'added' : 'to add'}, ${skippedItems} already existed`);
await mongoose.disconnect();
