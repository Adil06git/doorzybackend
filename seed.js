const { MongoClient } = require('mongodb');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/nearcart';

// ============ SAMPLE DATA ============

// Shops with realistic names (change city to yours)
const shops = [
  {
    name: 'Fresh Mart',
    description: 'Your local grocery store with fresh fruits, vegetables, and daily essentials',
    category: 'Grocery',
    address: '123 Main Street, City Center',
    contactNumber: '9876543210',
    email: 'freshmart@example.com',
    latitude: 10.0,
    longitude: 76.0,
    deliveryRadius: 10,
    deliveryChargePerKm: 10,
    isOpen: true,
    rating: 4.5,
    totalOrders: 0,
    isActive: true,
    createdAt: new Date().toISOString()
  },
  {
    name: 'Green Basket',
    description: 'Organic fruits, vegetables, and health foods delivered fresh',
    category: 'Grocery',
    address: '456 Park Avenue, Green Valley',
    contactNumber: '9876543211',
    email: 'greenbasket@example.com',
    latitude: 10.1,
    longitude: 76.1,
    deliveryRadius: 8,
    deliveryChargePerKm: 12,
    isOpen: true,
    rating: 4.7,
    totalOrders: 0,
    isActive: true,
    createdAt: new Date().toISOString()
  },
  {
    name: 'Daily Needs Store',
    description: 'Everything you need for your daily life - groceries, snacks, and household items',
    category: 'General Store',
    address: '789 Market Road, Downtown',
    contactNumber: '9876543212',
    email: 'dailyneeds@example.com',
    latitude: 9.9,
    longitude: 76.0,
    deliveryRadius: 12,
    deliveryChargePerKm: 8,
    isOpen: true,
    rating: 4.3,
    totalOrders: 0,
    isActive: true,
    createdAt: new Date().toISOString()
  },
  {
    name: 'Health Plus Pharmacy',
    description: '24/7 pharmacy with prescription medicines, health supplements, and wellness products',
    category: 'Pharmacy',
    address: '321 Wellness Boulevard, Medical District',
    contactNumber: '9876543213',
    email: 'healthplus@example.com',
    latitude: 10.2,
    longitude: 76.1,
    deliveryRadius: 15,
    deliveryChargePerKm: 10,
    isOpen: true,
    rating: 4.8,
    totalOrders: 0,
    isActive: true,
    createdAt: new Date().toISOString()
  },
  {
    name: 'Tech Hub Electronics',
    description: 'Gadgets, accessories, and electronics for your daily tech needs',
    category: 'Electronics',
    address: '567 Tech Park, Innovation Road',
    contactNumber: '9876543214',
    email: 'techhub@example.com',
    latitude: 10.05,
    longitude: 76.05,
    deliveryRadius: 10,
    deliveryChargePerKm: 15,
    isOpen: true,
    rating: 4.4,
    totalOrders: 0,
    isActive: true,
    createdAt: new Date().toISOString()
  }
];

// Products for each shop
const products = [
  // Fresh Mart Products
  {
    name: 'Fresh Apples',
    description: 'Crisp and juicy red apples, perfect for snacking',
    category: 'Fruits',
    price: 80,
    mrp: 100,
    stock: 50,
    unit: 'kg',
    isAvailable: true,
    isArchived: false,
    rating: 0,
    createdAt: new Date().toISOString()
  },
  {
    name: 'Organic Bananas',
    description: 'Fresh organic bananas, rich in potassium',
    category: 'Fruits',
    price: 40,
    mrp: 60,
    stock: 40,
    unit: 'kg',
    isAvailable: true,
    isArchived: false,
    rating: 0,
    createdAt: new Date().toISOString()
  },
  {
    name: 'Fresh Milk 1L',
    description: 'Pure and fresh pasteurized milk',
    category: 'Dairy',
    price: 60,
    mrp: 75,
    stock: 30,
    unit: 'pack',
    isAvailable: true,
    isArchived: false,
    rating: 0,
    createdAt: new Date().toISOString()
  },
  {
    name: 'Bread Loaf',
    description: 'Freshly baked white bread loaf',
    category: 'Bakery',
    price: 35,
    mrp: 45,
    stock: 25,
    unit: 'piece',
    isAvailable: true,
    isArchived: false,
    rating: 0,
    createdAt: new Date().toISOString()
  },
  {
    name: 'Eggs (12 pack)',
    description: 'Farm fresh eggs, packed in a convenient 12-pack',
    category: 'Dairy',
    price: 80,
    mrp: 100,
    stock: 20,
    unit: 'pack',
    isAvailable: true,
    isArchived: false,
    rating: 0,
    createdAt: new Date().toISOString()
  },
  {
    name: 'Rice 5kg',
    description: 'Premium quality basmati rice, 5kg pack',
    category: 'Grains',
    price: 450,
    mrp: 500,
    stock: 15,
    unit: 'pack',
    isAvailable: true,
    isArchived: false,
    rating: 0,
    createdAt: new Date().toISOString()
  },
  {
    name: 'Cooking Oil 1L',
    description: 'Pure and healthy cooking oil',
    category: 'Cooking Essentials',
    price: 180,
    mrp: 200,
    stock: 20,
    unit: 'pack',
    isAvailable: true,
    isArchived: false,
    rating: 0,
    createdAt: new Date().toISOString()
  },

  // Green Basket Products
  {
    name: 'Organic Carrots',
    description: 'Fresh organic carrots, rich in vitamin A',
    category: 'Vegetables',
    price: 50,
    mrp: 70,
    stock: 30,
    unit: 'kg',
    isAvailable: true,
    isArchived: false,
    rating: 0,
    createdAt: new Date().toISOString()
  },
  {
    name: 'Organic Tomatoes',
    description: 'Juicy organic tomatoes, perfect for salads',
    category: 'Vegetables',
    price: 45,
    mrp: 60,
    stock: 25,
    unit: 'kg',
    isAvailable: true,
    isArchived: false,
    rating: 0,
    createdAt: new Date().toISOString()
  },
  {
    name: 'Organic Onions',
    description: 'Fresh organic onions, essential for every kitchen',
    category: 'Vegetables',
    price: 30,
    mrp: 45,
    stock: 35,
    unit: 'kg',
    isAvailable: true,
    isArchived: false,
    rating: 0,
    createdAt: new Date().toISOString()
  },
  {
    name: 'Organic Potatoes',
    description: 'Fresh organic potatoes, versatile and delicious',
    category: 'Vegetables',
    price: 35,
    mrp: 50,
    stock: 40,
    unit: 'kg',
    isAvailable: true,
    isArchived: false,
    rating: 0,
    createdAt: new Date().toISOString()
  },
  {
    name: 'Organic Spinach',
    description: 'Fresh organic spinach, packed with nutrients',
    category: 'Vegetables',
    price: 25,
    mrp: 35,
    stock: 20,
    unit: 'bunch',
    isAvailable: true,
    isArchived: false,
    rating: 0,
    createdAt: new Date().toISOString()
  },
  {
    name: 'Honey 500g',
    description: 'Pure organic honey, natural sweetener',
    category: 'Health Foods',
    price: 250,
    mrp: 300,
    stock: 10,
    unit: 'pack',
    isAvailable: true,
    isArchived: false,
    rating: 0,
    createdAt: new Date().toISOString()
  },

  // Daily Needs Store Products
  {
    name: 'Sugar 1kg',
    description: 'Refined white sugar, 1kg pack',
    category: 'Groceries',
    price: 40,
    mrp: 50,
    stock: 30,
    unit: 'pack',
    isAvailable: true,
    isArchived: false,
    rating: 0,
    createdAt: new Date().toISOString()
  },
  {
    name: 'Salt 1kg',
    description: 'Pure iodized salt, 1kg pack',
    category: 'Groceries',
    price: 20,
    mrp: 30,
    stock: 40,
    unit: 'pack',
    isAvailable: true,
    isArchived: false,
    rating: 0,
    createdAt: new Date().toISOString()
  },
  {
    name: 'Wheat Flour 5kg',
    description: 'Premium quality wheat flour, 5kg pack',
    category: 'Groceries',
    price: 200,
    mrp: 250,
    stock: 15,
    unit: 'pack',
    isAvailable: true,
    isArchived: false,
    rating: 0,
    createdAt: new Date().toISOString()
  },
  {
    name: 'Tea 250g',
    description: 'Premium black tea leaves, 250g pack',
    category: 'Beverages',
    price: 120,
    mrp: 150,
    stock: 20,
    unit: 'pack',
    isAvailable: true,
    isArchived: false,
    rating: 0,
    createdAt: new Date().toISOString()
  },
  {
    name: 'Coffee 200g',
    description: 'Rich and aromatic coffee powder, 200g pack',
    category: 'Beverages',
    price: 180,
    mrp: 220,
    stock: 15,
    unit: 'pack',
    isAvailable: true,
    isArchived: false,
    rating: 0,
    createdAt: new Date().toISOString()
  },
  {
    name: 'Biscuit Pack',
    description: 'Delicious cream biscuits, perfect for tea time',
    category: 'Snacks',
    price: 30,
    mrp: 40,
    stock: 25,
    unit: 'pack',
    isAvailable: true,
    isArchived: false,
    rating: 0,
    createdAt: new Date().toISOString()
  },

  // Health Plus Pharmacy Products
  {
    name: 'Pain Relief Tablets',
    description: 'Fast-acting pain relief tablets, 10 pack',
    category: 'Medicine',
    price: 50,
    mrp: 60,
    stock: 30,
    unit: 'pack',
    isAvailable: true,
    isArchived: false,
    rating: 0,
    createdAt: new Date().toISOString()
  },
  {
    name: 'Vitamin C 500mg',
    description: 'Immunity boosting Vitamin C supplements, 30 tablets',
    category: 'Supplements',
    price: 120,
    mrp: 150,
    stock: 20,
    unit: 'pack',
    isAvailable: true,
    isArchived: false,
    rating: 0,
    createdAt: new Date().toISOString()
  },
  {
    name: 'Antiseptic Cream',
    description: 'Antiseptic cream for minor cuts and wounds',
    category: 'Medicine',
    price: 45,
    mrp: 60,
    stock: 25,
    unit: 'piece',
    isAvailable: true,
    isArchived: false,
    rating: 0,
    createdAt: new Date().toISOString()
  },
  {
    name: 'Hand Sanitizer 100ml',
    description: 'Alcohol-based hand sanitizer, 100ml',
    category: 'Hygiene',
    price: 80,
    mrp: 100,
    stock: 30,
    unit: 'piece',
    isAvailable: true,
    isArchived: false,
    rating: 0,
    createdAt: new Date().toISOString()
  },
  {
    name: 'Face Mask Pack',
    description: 'Disposable face masks, pack of 10',
    category: 'Hygiene',
    price: 60,
    mrp: 80,
    stock: 20,
    unit: 'pack',
    isAvailable: true,
    isArchived: false,
    rating: 0,
    createdAt: new Date().toISOString()
  },
  {
    name: 'Multivitamin Tablets',
    description: 'Multivitamin supplements for daily health, 30 tablets',
    category: 'Supplements',
    price: 150,
    mrp: 180,
    stock: 15,
    unit: 'pack',
    isAvailable: true,
    isArchived: false,
    rating: 0,
    createdAt: new Date().toISOString()
  },

  // Tech Hub Electronics Products
  {
    name: 'USB Cable (1m)',
    description: 'Durable USB charging cable, 1 meter length',
    category: 'Accessories',
    price: 120,
    mrp: 150,
    stock: 25,
    unit: 'piece',
    isAvailable: true,
    isArchived: false,
    rating: 0,
    createdAt: new Date().toISOString()
  },
  {
    name: 'Phone Charger',
    description: 'Fast charging phone charger, 2.4A output',
    category: 'Accessories',
    price: 300,
    mrp: 380,
    stock: 15,
    unit: 'piece',
    isAvailable: true,
    isArchived: false,
    rating: 0,
    createdAt: new Date().toISOString()
  },
  {
    name: 'Bluetooth Headphones',
    description: 'Wireless Bluetooth headphones with noise cancellation',
    category: 'Accessories',
    price: 1500,
    mrp: 1800,
    stock: 8,
    unit: 'piece',
    isAvailable: true,
    isArchived: false,
    rating: 0,
    createdAt: new Date().toISOString()
  },
  {
    name: 'Power Bank 10000mAh',
    description: 'Portable power bank with fast charging',
    category: 'Accessories',
    price: 800,
    mrp: 1000,
    stock: 10,
    unit: 'piece',
    isAvailable: true,
    isArchived: false,
    rating: 0,
    createdAt: new Date().toISOString()
  },
  {
    name: 'Smart Watch',
    description: 'Smart watch with fitness tracking and notifications',
    category: 'Wearables',
    price: 2500,
    mrp: 3000,
    stock: 5,
    unit: 'piece',
    isAvailable: true,
    isArchived: false,
    rating: 0,
    createdAt: new Date().toISOString()
  }
];

// ============ RUN SEED ============

async function seedDatabase() {
  try {
    console.log('🔄 Connecting to MongoDB...');
    const client = new MongoClient(MONGODB_URI);
    await client.connect();
    const db = client.db();
    console.log('✅ Connected to MongoDB');

    // Get collections
    const shopsCollection = db.collection('shops');
    const productsCollection = db.collection('products');

    // Clear existing data (optional - comment out if you want to keep existing)
    console.log('🧹 Clearing existing shops and products...');
    await shopsCollection.deleteMany({});
    await productsCollection.deleteMany({});

    // Insert shops
    console.log(`📦 Inserting ${shops.length} shops...`);
    const shopResult = await shopsCollection.insertMany(shops);
    const insertedShopIds = Object.values(shopResult.insertedIds);
    console.log(`✅ Inserted ${shopResult.insertedCount} shops`);

    // Insert products with shopId
    console.log(`📦 Inserting ${products.length} products...`);
    
    // Assign products to shops (distribute evenly)
    const productsWithShopId = products.map((product, index) => {
      const shopIndex = index % insertedShopIds.length;
      return {
        ...product,
        shopId: insertedShopIds[shopIndex].toString(),
        discount: ((product.mrp - product.price) / product.mrp * 100).toFixed(2)
      };
    });

    const productResult = await productsCollection.insertMany(productsWithShopId);
    console.log(`✅ Inserted ${productResult.insertedCount} products`);

    console.log('\n🎉 Database seeded successfully!');
    console.log(`📊 ${shops.length} shops added`);
    console.log(`📊 ${products.length} products added`);
    console.log('\n🔑 Login as admin:');
    console.log('   Email: admin@nearcart.com');
    console.log('   Password: admin123');

    await client.close();
    console.log('\n✅ Done!');
  } catch (error) {
    console.error('❌ Error seeding database:', error);
  }
}

// Run the seed
seedDatabase();