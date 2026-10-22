const { MongoClient, ObjectId } = require('mongodb');
const bcrypt = require('bcryptjs');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://rasheedadil149_db_user:4lOiewRgetgtm482@cluster0.zeda5wo.mongodb.net/Doorzy?appName=cluster0';

let client;
let db;

const getUsers = () => db.collection('users');
const getShops = () => db.collection('shops');
const getProducts = () => db.collection('products');
const getOrders = () => db.collection('orders');
const getDeliveryAgents = () => db.collection('deliveryAgents');

const createDefaultAdmin = async () => {
  const adminEmail = 'admin@nearcart.com';
  const adminPassword = 'admin123';
  
  const existing = await getUsers().findOne({ email: adminEmail });
  if (existing) {
    console.log('✅ Admin already exists');
    return;
  }
  
  const hashedPassword = await bcrypt.hash(adminPassword, 10);
  const admin = {
    _id: new ObjectId(),
    name: 'Super Admin',
    email: adminEmail,
    password: hashedPassword,
    phone: '9999999999',
    role: 'admin',
    addresses: [],
    isActive: true,
    createdAt: new Date().toISOString()
  };
  await getUsers().insertOne(admin);
  console.log('✅ Default admin created!');
  console.log(`   Email: ${adminEmail}`);
  console.log(`   Password: ${adminPassword}`);
};

const connectDB = async () => {
  try {
    client = new MongoClient(MONGODB_URI);
    await client.connect();
    db = client.db();
    console.log('✅ MongoDB connected successfully');
    
    await db.collection('users').createIndex({ email: 1 }, { unique: true });
    await db.collection('shops').createIndex({ name: 1 });
    await db.collection('products').createIndex({ shopId: 1 });
    await db.collection('orders').createIndex({ userId: 1 });
    await db.collection('orders').createIndex({ deliveryAgentId: 1 });
    
    await createDefaultAdmin();
    return db;
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
  }
};

const getDB = () => db;
const getClient = () => client;

const closeDB = async () => {
  if (client) {
    await client.close();
  }
};

module.exports = {
  connectDB,
  getDB,
  getClient,
  closeDB,
  getUsers,
  getShops,
  getProducts,
  getOrders,
  getDeliveryAgents
};
