const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');
const multer = require('multer');
const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');
const { MongoClient, ObjectId } = require('mongodb');

dotenv.config();

const app = express();

// ============ MONGODB CONNECTION ============
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/nearcart';
let db;
let client;

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
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
  }
};

// ============ COLLECTION HELPERS ============
const getUsers = () => db.collection('users');
const getShops = () => db.collection('shops');
const getProducts = () => db.collection('products');
const getOrders = () => db.collection('orders');
const getDeliveryAgents = () => db.collection('deliveryAgents');

// ============ GENERATE OTP ============
const generateOTP = () => {
  return Math.floor(1000 + Math.random() * 9000).toString();
};

// ============ CORS SETTINGS ============
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:3000', 'http://127.0.0.1:5173'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ============ HELPER FUNCTIONS ============

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET || 'secret', { expiresIn: '7d' });
};

const protect = async (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ message: 'Not authorized' });
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret');
    const user = await getUsers().findOne({ _id: new ObjectId(decoded.id) });
    if (!user) {
      return res.status(401).json({ message: 'User not found' });
    }
    if (!user.isActive) {
      return res.status(401).json({ message: 'Account deactivated' });
    }
    req.user = { ...user, id: user._id.toString() };
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Not authorized' });
  }
};

const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Not authorized' });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ 
        message: `Role ${req.user.role} is not authorized. Required: ${roles.join(', ')}` 
      });
    }
    next();
  };
};

// ============ CREATE DEFAULT ADMIN ============
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

// ============ AUTH ROUTES ============

app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, password, phone, role = 'customer' } = req.body;
    
    if (role === 'admin') {
      return res.status(403).json({ 
        message: 'Admin registration is not allowed. Only one admin exists.',
        hint: 'Login as admin@nearcart.com with password: admin123'
      });
    }
    
    const validRoles = ['customer'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ message: 'Invalid role. Only customer registration is allowed' });
    }
    
    const existing = await getUsers().findOne({ email });
    if (existing) {
      return res.status(400).json({ message: 'User already exists' });
    }
    
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = {
      _id: new ObjectId(),
      name,
      email,
      password: hashedPassword,
      phone,
      role,
      addresses: [],
      isActive: true,
      createdAt: new Date().toISOString()
    };
    await getUsers().insertOne(user);
    
    const token = generateToken(user._id.toString());
    res.status(201).json({
      token,
      user: { id: user._id, name, email, phone, role }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await getUsers().findOne({ email });
    
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    
    if (!user.isActive) {
      return res.status(401).json({ message: 'Account deactivated' });
    }
    
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    
    const token = generateToken(user._id.toString());
    res.json({
      token,
      user: { 
        id: user._id, 
        name: user.name, 
        email: user.email, 
        phone: user.phone, 
        role: user.role 
      }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.get('/api/auth/me', protect, (req, res) => {
  const { password, ...userWithoutPassword } = req.user;
  res.json({ user: userWithoutPassword });
});

// ============ UPDATE USER ADDRESS ============
app.put('/api/users/address', protect, async (req, res) => {
  try {
    const { address } = req.body;
    
    if (!address || address.trim() === '') {
      return res.status(400).json({ message: 'Address is required' });
    }

    const user = await getUsers().findOne({ _id: new ObjectId(req.user.id) });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const addresses = user.addresses || [];
    let updatedAddresses = [...addresses];
    
    const existingIndex = updatedAddresses.findIndex(a => a.isDefault === true);
    if (existingIndex !== -1) {
      updatedAddresses[existingIndex].address = address.trim();
      updatedAddresses[existingIndex].label = 'Primary';
    } else {
      updatedAddresses.push({
        id: 'addr_' + Date.now(),
        label: 'Primary',
        address: address.trim(),
        isDefault: true
      });
    }

    await getUsers().updateOne(
      { _id: new ObjectId(req.user.id) },
      { 
        $set: { 
          address: address.trim(),
          addresses: updatedAddresses 
        } 
      }
    );

    const updatedUser = await getUsers().findOne({ _id: new ObjectId(req.user.id) });
    const { password, ...userWithoutPassword } = updatedUser;
    
    res.json({
      success: true,
      message: 'Address updated successfully',
      user: userWithoutPassword
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ============ ADDRESS ROUTES ============

app.get('/api/users/addresses', protect, async (req, res) => {
  try {
    const user = await getUsers().findOne({ _id: new ObjectId(req.user.id) });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json({ addresses: user.addresses || [] });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.post('/api/users/addresses', protect, async (req, res) => {
  try {
    const user = await getUsers().findOne({ _id: new ObjectId(req.user.id) });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const address = {
      id: Date.now().toString(36) + Math.random().toString(36).substr(2, 5),
      ...req.body,
      isDefault: req.body.isDefault || false
    };

    let addresses = user.addresses || [];
    if (addresses.length === 0 || address.isDefault) {
      addresses = addresses.map(a => ({ ...a, isDefault: false }));
      address.isDefault = true;
    }

    addresses.push(address);

    await getUsers().updateOne(
      { _id: new ObjectId(req.user.id) },
      { $set: { addresses } }
    );

    res.json({ 
      success: true, 
      message: 'Address added successfully',
      addresses 
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.put('/api/users/addresses/:id', protect, async (req, res) => {
  try {
    const user = await getUsers().findOne({ _id: new ObjectId(req.user.id) });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    let addresses = user.addresses || [];
    const addressIndex = addresses.findIndex(a => a.id === req.params.id);
    if (addressIndex === -1) {
      return res.status(404).json({ message: 'Address not found' });
    }

    if (req.body.isDefault) {
      addresses = addresses.map(a => ({ ...a, isDefault: false }));
    }

    addresses[addressIndex] = {
      ...addresses[addressIndex],
      ...req.body
    };

    await getUsers().updateOne(
      { _id: new ObjectId(req.user.id) },
      { $set: { addresses } }
    );

    res.json({ 
      success: true, 
      message: 'Address updated successfully',
      addresses 
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.delete('/api/users/addresses/:id', protect, async (req, res) => {
  try {
    const user = await getUsers().findOne({ _id: new ObjectId(req.user.id) });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    let addresses = user.addresses || [];
    addresses = addresses.filter(a => a.id !== req.params.id);
    
    if (addresses.length > 0 && !addresses.some(a => a.isDefault)) {
      addresses[0].isDefault = true;
    }

    await getUsers().updateOne(
      { _id: new ObjectId(req.user.id) },
      { $set: { addresses } }
    );

    res.json({ 
      success: true, 
      message: 'Address deleted successfully',
      addresses 
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.put('/api/users/addresses/:id/default', protect, async (req, res) => {
  try {
    const user = await getUsers().findOne({ _id: new ObjectId(req.user.id) });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    let addresses = user.addresses || [];
    const addressExists = addresses.some(a => a.id === req.params.id);
    if (!addressExists) {
      return res.status(404).json({ message: 'Address not found' });
    }

    addresses = addresses.map(a => ({ ...a, isDefault: a.id === req.params.id }));

    await getUsers().updateOne(
      { _id: new ObjectId(req.user.id) },
      { $set: { addresses } }
    );

    res.json({ 
      success: true, 
      message: 'Default address updated',
      addresses 
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ============ SHOP ROUTES ============

app.get('/api/shops', async (req, res) => {
  try {
    const shops = await getShops().find({ isActive: { $ne: false } }).toArray();
    res.json({ shops });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.get('/api/shops/:id', async (req, res) => {
  try {
    const shop = await getShops().findOne({ _id: new ObjectId(req.params.id) });
    if (!shop) {
      return res.status(404).json({ message: 'Shop not found' });
    }
    const products = await getProducts().find({ shopId: req.params.id, isArchived: { $ne: true } }).toArray();
    res.json({ shop, products });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.post('/api/shops', protect, authorize('admin'), async (req, res) => {
  try {
    const { name, description, category, address, latitude, longitude, contactNumber, email } = req.body;
    
    if (!name || !description || !category) {
      return res.status(400).json({ message: 'Name, description, and category are required' });
    }
    
    const shop = {
      _id: new ObjectId(),
      name,
      description,
      category,
      address: address || '',
      latitude: latitude || 0,
      longitude: longitude || 0,
      contactNumber: contactNumber || '',
      email: email || '',
      deliveryRadius: 10,
      deliveryChargePerKm: 10,
      isOpen: true,
      rating: 0,
      totalOrders: 0,
      isActive: true,
      createdAt: new Date().toISOString()
    };
    await getShops().insertOne(shop);
    res.status(201).json({ shop });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.put('/api/shops/:id', protect, authorize('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = {};
    const allowedFields = ['name', 'description', 'category', 'address', 'latitude', 'longitude', 
                         'contactNumber', 'email', 'deliveryRadius', 'deliveryChargePerKm', 'isOpen'];
    
    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) {
        updateData[field] = req.body[field];
      }
    });

    const result = await getShops().updateOne(
      { _id: new ObjectId(id) },
      { $set: updateData }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ message: 'Shop not found' });
    }

    const shop = await getShops().findOne({ _id: new ObjectId(id) });
    res.json({ shop });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.delete('/api/shops/:id', protect, authorize('admin'), async (req, res) => {
  try {
    const result = await getShops().updateOne(
      { _id: new ObjectId(req.params.id) },
      { $set: { isActive: false } }
    );
    if (result.matchedCount === 0) {
      return res.status(404).json({ message: 'Shop not found' });
    }
    res.json({ message: 'Shop deactivated successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ============ PRODUCT ROUTES ============

app.get('/api/products', async (req, res) => {
  try {
    const query = { isArchived: { $ne: true } };
    if (req.query.shopId) {
      query.shopId = req.query.shopId;
    }
    const products = await getProducts().find(query).toArray();
    res.json({ products });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.get('/api/products/:id', async (req, res) => {
  try {
    const product = await getProducts().findOne({ _id: new ObjectId(req.params.id), isArchived: { $ne: true } });
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }
    res.json({ product });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.post('/api/products', protect, authorize('admin'), async (req, res) => {
  try {
    const { name, description, category, shopId, price, mrp, stock, unit } = req.body;
    
    if (!name || !price || !mrp || !shopId) {
      return res.status(400).json({ message: 'Name, price, mrp, and shopId are required' });
    }
    
    const shop = await getShops().findOne({ _id: new ObjectId(shopId) });
    if (!shop) {
      return res.status(404).json({ message: 'Shop not found' });
    }
    
    const discount = ((mrp - price) / mrp * 100).toFixed(2);
    
    const product = {
      _id: new ObjectId(),
      name,
      description: description || '',
      category: category || 'General',
      subCategory: req.body.subCategory || '',
      shopId,
      price: parseFloat(price),
      mrp: parseFloat(mrp),
      discount: parseFloat(discount),
      stock: parseInt(stock) || 0,
      unit: unit || 'piece',
      images: req.body.images || [],
      isAvailable: parseInt(stock) > 0,
      isArchived: false,
      rating: 0,
      createdAt: new Date().toISOString()
    };
    await getProducts().insertOne(product);
    res.status(201).json({ product });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.put('/api/products/:id', protect, authorize('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = {};
    const allowedFields = ['name', 'description', 'category', 'subCategory', 'price', 'mrp', 'stock', 'unit', 'images', 'isAvailable'];
    
    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) {
        updateData[field] = req.body[field];
      }
    });
    
    const product = await getProducts().findOne({ _id: new ObjectId(id) });
    if (!product || product.isArchived) {
      return res.status(404).json({ message: 'Product not found' });
    }

    if (req.body.price || req.body.mrp) {
      const newPrice = req.body.price || product.price;
      const newMrp = req.body.mrp || product.mrp;
      updateData.discount = ((newMrp - newPrice) / newMrp * 100).toFixed(2);
    }

    await getProducts().updateOne(
      { _id: new ObjectId(id) },
      { $set: updateData }
    );

    const updatedProduct = await getProducts().findOne({ _id: new ObjectId(id) });
    res.json({ product: updatedProduct });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.delete('/api/products/:id', protect, authorize('admin'), async (req, res) => {
  try {
    const result = await getProducts().updateOne(
      { _id: new ObjectId(req.params.id) },
      { $set: { isArchived: true, isAvailable: false } }
    );
    if (result.matchedCount === 0) {
      return res.status(404).json({ message: 'Product not found' });
    }
    res.json({ message: 'Product archived successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ============ ORDER ROUTES ============

app.post('/api/orders', protect, authorize('customer'), async (req, res) => {
  try {
    const { shopId, items, deliveryAddress, paymentMethod } = req.body;
    
    if (!shopId || !items || items.length === 0) {
      return res.status(400).json({ message: 'Shop and items are required' });
    }
    
    let subtotal = 0;
    const orderItems = [];
    
    for (const item of items) {
      const product = await getProducts().findOne({ _id: new ObjectId(item.productId), isArchived: { $ne: true } });
      if (!product) {
        return res.status(404).json({ message: `Product ${item.productId} not found` });
      }
      if (product.stock < item.quantity) {
        return res.status(400).json({ message: `Insufficient stock for ${product.name}` });
      }
      
      const total = product.price * item.quantity;
      subtotal += total;
      orderItems.push({
        productId: item.productId,
        name: product.name,
        price: product.price,
        quantity: item.quantity,
        total
      });
      
      await getProducts().updateOne(
        { _id: new ObjectId(item.productId) },
        { $inc: { stock: -item.quantity } }
      );
    }
    
    const deliveryCharge = 20;
    const totalAmount = subtotal + deliveryCharge;
    
    const order = {
      _id: new ObjectId(),
      orderNumber: 'ORD-' + Date.now().toString(36).toUpperCase(),
      userId: req.user.id,
      shopId,
      items: orderItems,
      subtotal,
      deliveryCharge,
      totalAmount,
      deliveryAddress: deliveryAddress || {},
      paymentMethod: paymentMethod || 'cash_on_delivery',
      orderStatus: 'pending',
      deliveryAgentId: null,
      deliveryOTP: null,
      otpVerified: false,
      createdAt: new Date().toISOString(),
      statusHistory: [
        { status: 'pending', note: 'Order created', timestamp: new Date().toISOString() }
      ]
    };
    await getOrders().insertOne(order);
    res.status(201).json({ order });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.get('/api/orders', protect, async (req, res) => {
  try {
    const orders = await getOrders().find({ userId: req.user.id }).toArray();
    const ordersWithAgent = await Promise.all(orders.map(async (order) => {
      let deliveryAgentName = null;
      if (order.deliveryAgentId) {
        const agent = await getDeliveryAgents().findOne({ userId: order.deliveryAgentId });
        if (agent) {
          const agentUser = await getUsers().findOne({ _id: new ObjectId(agent.userId) });
          deliveryAgentName = agentUser ? agentUser.name : null;
        }
      }
      return { ...order, deliveryAgentName };
    }));
    res.json({ orders: ordersWithAgent });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.get('/api/admin/orders', protect, authorize('admin'), async (req, res) => {
  try {
    const orders = await getOrders().find({}).toArray();
    const ordersWithAgent = await Promise.all(orders.map(async (order) => {
      let deliveryAgentName = null;
      if (order.deliveryAgentId) {
        const agent = await getDeliveryAgents().findOne({ userId: order.deliveryAgentId });
        if (agent) {
          const agentUser = await getUsers().findOne({ _id: new ObjectId(agent.userId) });
          deliveryAgentName = agentUser ? agentUser.name : null;
        }
      }
      return { ...order, deliveryAgentName };
    }));
    res.json({ orders: ordersWithAgent });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ============ UPDATE ORDER STATUS WITH OTP VERIFICATION ============
app.put('/api/orders/:id/status', protect, async (req, res) => {
  try {
    const order = await getOrders().findOne({ _id: new ObjectId(req.params.id) });
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }
    
    if (req.user.role === 'delivery_agent' && order.deliveryAgentId !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized to update this order' });
    }
    
    if (req.user.role === 'customer') {
      return res.status(403).json({ message: 'Customers cannot update order status' });
    }
    
    const { status, otp } = req.body;
    const validStatuses = ['pending', 'accepted', 'picked_up', 'on_the_way', 'delivered', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }
    
    // If trying to mark as delivered, OTP is required
    if (status === 'delivered') {
      // Check if OTP is provided
      if (!otp) {
        return res.status(400).json({ message: 'OTP is required to mark as delivered' });
      }
      
      // Check if OTP matches
      if (order.deliveryOTP !== otp) {
        return res.status(400).json({ message: 'Invalid OTP' });
      }
      
      // Check if OTP is already verified
      if (order.otpVerified) {
        return res.status(400).json({ message: 'OTP already verified for this order' });
      }
      
      // Mark OTP as verified
      await getOrders().updateOne(
        { _id: new ObjectId(req.params.id) },
        { $set: { otpVerified: true } }
      );
    }
    
    const statusHistory = [...order.statusHistory, {
      status,
      note: status === 'delivered' ? 'Order delivered (OTP verified)' : `Order ${status}`,
      timestamp: new Date().toISOString(),
      updatedBy: req.user.id
    }];
    
    const updateData = {
      orderStatus: status,
      statusHistory
    };
    
    if (status === 'delivered') {
      updateData.actualDeliveryTime = new Date().toISOString();
      await getShops().updateOne(
        { _id: new ObjectId(order.shopId) },
        { $inc: { totalOrders: 1 } }
      );
    }
    
    await getOrders().updateOne(
      { _id: new ObjectId(req.params.id) },
      { $set: updateData }
    );
    
    const updatedOrder = await getOrders().findOne({ _id: new ObjectId(req.params.id) });
    res.json({ order: updatedOrder });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.put('/api/orders/:id/assign', protect, authorize('admin'), async (req, res) => {
  try {
    const order = await getOrders().findOne({ _id: new ObjectId(req.params.id) });
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }
    
    const { deliveryAgentId } = req.body;
    const agent = await getUsers().findOne({ _id: new ObjectId(deliveryAgentId), role: 'delivery_agent' });
    if (!agent) {
      return res.status(404).json({ message: 'Delivery agent not found' });
    }
    
    // Generate OTP for delivery
    const otp = generateOTP();
    
    const statusHistory = [...order.statusHistory, {
      status: 'accepted',
      note: `Assigned to delivery agent ${agent.name}`,
      timestamp: new Date().toISOString(),
      updatedBy: req.user.id
    }];
    
    await getOrders().updateOne(
      { _id: new ObjectId(req.params.id) },
      { 
        $set: { 
          deliveryAgentId, 
          orderStatus: order.orderStatus === 'pending' ? 'accepted' : order.orderStatus,
          statusHistory,
          deliveryOTP: otp,
          otpVerified: false
        } 
      }
    );
    
    await getDeliveryAgents().updateOne(
      { userId: deliveryAgentId },
      { $set: { availabilityStatus: 'busy' } }
    );
    
    const updatedOrder = await getOrders().findOne({ _id: new ObjectId(req.params.id) });
    
    // Return OTP in response so delivery agent can see it
    res.json({ 
      order: updatedOrder,
      otp: otp // Include OTP in response for delivery agent
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ============ GET ORDER OTP (For delivery agent to view) ============
app.get('/api/orders/:id/otp', protect, authorize('delivery_agent'), async (req, res) => {
  try {
    const order = await getOrders().findOne({ _id: new ObjectId(req.params.id) });
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }
    
    // Verify this delivery agent is assigned to this order
    if (order.deliveryAgentId !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized to view this OTP' });
    }
    
    res.json({ 
      otp: order.deliveryOTP,
      otpVerified: order.otpVerified || false
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ============ DELIVERY AGENT ROUTES ============

app.get('/api/delivery/orders', protect, authorize('delivery_agent'), async (req, res) => {
  try {
    const orders = await getOrders().find({ deliveryAgentId: req.user.id }).toArray();
    
    const ordersWithCustomer = await Promise.all(orders.map(async (order) => {
      const customer = await getUsers().findOne({ _id: new ObjectId(order.userId) });
      return {
        ...order,
        customer: customer ? {
          id: customer._id,
          name: customer.name,
          email: customer.email,
          phone: customer.phone,
          addresses: customer.addresses || []
        } : null
      };
    }));
    
    res.json({ orders: ordersWithCustomer });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.get('/api/delivery/stats', protect, authorize('delivery_agent'), async (req, res) => {
  try {
    const agent = await getDeliveryAgents().findOne({ userId: req.user.id });
    if (!agent) {
      return res.status(404).json({ message: 'Delivery agent profile not found' });
    }
    res.json({ agent });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.put('/api/delivery/status', protect, authorize('delivery_agent'), async (req, res) => {
  try {
    const { status } = req.body;
    if (!['available', 'busy', 'offline'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }
    
    await getDeliveryAgents().updateOne(
      { userId: req.user.id },
      { $set: { availabilityStatus: status } }
    );
    
    const agent = await getDeliveryAgents().findOne({ userId: req.user.id });
    res.json({ agent });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ============ ADMIN ROUTES ============

app.get('/api/admin/dashboard', protect, authorize('admin'), async (req, res) => {
  try {
    const totalUsers = await getUsers().countDocuments({ role: 'customer' });
    const totalShops = await getShops().countDocuments({ isActive: { $ne: false } });
    const totalProducts = await getProducts().countDocuments({ isArchived: { $ne: true } });
    const totalOrders = await getOrders().countDocuments();
    const totalDeliveryAgents = await getUsers().countDocuments({ role: 'delivery_agent' });
    
    const deliveredOrders = await getOrders().find({ orderStatus: 'delivered' }).toArray();
    const revenue = deliveredOrders.reduce((sum, o) => sum + o.totalAmount, 0);
    
    const orders = await getOrders().find({}).sort({ createdAt: -1 }).limit(10).toArray();
    
    const ordersByStatus = {
      pending: await getOrders().countDocuments({ orderStatus: 'pending' }),
      accepted: await getOrders().countDocuments({ orderStatus: 'accepted' }),
      picked_up: await getOrders().countDocuments({ orderStatus: 'picked_up' }),
      on_the_way: await getOrders().countDocuments({ orderStatus: 'on_the_way' }),
      delivered: await getOrders().countDocuments({ orderStatus: 'delivered' }),
      cancelled: await getOrders().countDocuments({ orderStatus: 'cancelled' })
    };
    
    res.json({
      stats: {
        totalUsers,
        totalShops,
        totalProducts,
        totalOrders,
        totalDeliveryAgents,
        totalRevenue: revenue
      },
      recentOrders: orders,
      ordersByStatus
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.get('/api/admin/users', protect, authorize('admin'), async (req, res) => {
  try {
    const users = await getUsers().find({}).toArray();
    const usersWithoutPassword = users.map(({ password, ...user }) => user);
    res.json({ users: usersWithoutPassword });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.get('/api/admin/agents', protect, authorize('admin'), async (req, res) => {
  try {
    const agents = await getDeliveryAgents().find({}).toArray();
    const agentsWithUser = await Promise.all(agents.map(async (agent) => {
      const user = await getUsers().findOne({ _id: new ObjectId(agent.userId) });
      return {
        ...agent,
        user: user ? { id: user._id, name: user.name, email: user.email, phone: user.phone } : null
      };
    }));
    res.json({ agents: agentsWithUser });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.post('/api/admin/agents', protect, authorize('admin'), async (req, res) => {
  try {
    const { name, email, phone, password, vehicleType, vehicleNumber } = req.body;

    if (!name || !email || !phone || !password) {
      return res.status(400).json({ message: 'Name, email, phone, and password are required' });
    }

    const existing = await getUsers().findOne({ email });
    if (existing) {
      return res.status(400).json({ message: 'User with this email already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = {
      _id: new ObjectId(),
      name,
      email,
      password: hashedPassword,
      phone,
      role: 'delivery_agent',
      addresses: [],
      isActive: true,
      createdAt: new Date().toISOString()
    };
    await getUsers().insertOne(user);

    const deliveryAgent = {
      _id: new ObjectId(),
      userId: user._id.toString(),
      vehicleType: vehicleType || 'motorcycle',
      vehicleNumber: vehicleNumber || '',
      availabilityStatus: 'available',
      totalDeliveries: 0,
      rating: 0,
      totalEarnings: 0
    };
    await getDeliveryAgents().insertOne(deliveryAgent);

    res.status(201).json({
      success: true,
      message: 'Delivery agent created successfully',
      user: { id: user._id, name, email, phone, role: user.role }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.put('/api/admin/users/:id/status', protect, authorize('admin'), async (req, res) => {
  try {
    const result = await getUsers().updateOne(
      { _id: new ObjectId(req.params.id) },
      { $set: { isActive: req.body.isActive } }
    );
    if (result.matchedCount === 0) {
      return res.status(404).json({ message: 'User not found' });
    }
    const user = await getUsers().findOne({ _id: new ObjectId(req.params.id) });
    res.json({ user: { id: user._id, name: user.name, isActive: user.isActive } });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ============ BULK IMPORT ROUTES ============

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = './uploads';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir);
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const upload = multer({ 
  storage: storage,
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'text/csv'
    ];
    if (allowedTypes.includes(file.mimetype) || 
        file.originalname.endsWith('.xlsx') || 
        file.originalname.endsWith('.xls') || 
        file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Only Excel and CSV files are allowed'));
    }
  }
});

// ============ IMPORT TEMPLATE DOWNLOAD ============
app.get('/api/admin/import/template/:shopId', protect, authorize('admin'), async (req, res) => {
  try {
    console.log('🔍 Template download - shopId received:', req.params.shopId);
    
    let shop;
    try {
      shop = await getShops().findOne({ _id: new ObjectId(req.params.shopId) });
    } catch (err) {
      console.log('⚠️ ObjectId conversion failed, trying string id...');
      shop = await getShops().findOne({ id: req.params.shopId });
    }
    
    if (!shop) {
      console.log('❌ Shop not found for ID:', req.params.shopId);
      return res.status(404).json({ message: 'Shop not found' });
    }

    console.log('✅ Shop found:', shop.name);

    const templateData = [
      {
        'Product Name': 'Fresh Apples',
        'Description': 'Crisp and juicy red apples',
        'Category': 'Groceries',
        'Sub Category': 'Fruits',
        'Price': 100,
        'MRP': 120,
        'Stock': 50,
        'Unit': 'kg',
        'Image URL': 'https://example.com/apple.jpg'
      },
      {
        'Product Name': 'Organic Bananas',
        'Description': 'Fresh organic bananas',
        'Category': 'Groceries',
        'Sub Category': 'Fruits',
        'Price': 60,
        'MRP': 80,
        'Stock': 30,
        'Unit': 'kg',
        'Image URL': 'https://example.com/banana.jpg'
      }
    ];

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(templateData);
    XLSX.utils.book_append_sheet(wb, ws, 'Products');
    
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=products_${shop.name.replace(/\s/g, '_')}.xlsx`);
    res.send(buffer);
  } catch (error) {
    console.error('Template download error:', error);
    res.status(500).json({ message: error.message });
  }
});

// ============ IMPORT PRODUCTS ============
app.post('/api/admin/import/products/:shopId', 
  protect, 
  authorize('admin'),
  upload.single('file'),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: 'No file uploaded' });
      }

      const shop = await getShops().findOne({ _id: new ObjectId(req.params.shopId) });
      if (!shop) {
        fs.unlinkSync(req.file.path);
        return res.status(404).json({ message: 'Shop not found' });
      }

      const filePath = req.file.path;
      const workbook = XLSX.readFile(filePath);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json(worksheet);

      if (!data || data.length === 0) {
        fs.unlinkSync(filePath);
        return res.status(400).json({ message: 'No data found in file' });
      }

      const errors = [];
      const imported = [];
      const skipped = [];
      const productsToInsert = [];

      for (const row of data) {
        try {
          if (!row['Product Name'] || !row['Price'] || !row['MRP']) {
            skipped.push({ row, reason: 'Missing required fields: Product Name, Price, or MRP' });
            continue;
          }

          const price = parseFloat(row['Price']);
          const mrp = parseFloat(row['MRP']);
          const stock = parseInt(row['Stock']) || 0;

          if (isNaN(price) || isNaN(mrp)) {
            skipped.push({ row, reason: 'Price and MRP must be valid numbers' });
            continue;
          }

          if (price > mrp) {
            skipped.push({ row, reason: `Price (${price}) cannot be greater than MRP (${mrp})` });
            continue;
          }

          const discount = ((mrp - price) / mrp * 100).toFixed(2);

          const product = {
            _id: new ObjectId(),
            name: row['Product Name'].trim(),
            description: row['Description'] || '',
            category: row['Category'] || 'General',
            subCategory: row['Sub Category'] || '',
            shopId: req.params.shopId,
            price: price,
            mrp: mrp,
            discount: parseFloat(discount),
            stock: stock,
            unit: row['Unit'] || 'piece',
            images: row['Image URL'] ? [row['Image URL']] : [],
            isAvailable: stock > 0,
            isArchived: false,
            rating: 0,
            createdAt: new Date().toISOString()
          };

          productsToInsert.push(product);
          imported.push(product);
        } catch (error) {
          skipped.push({ row, reason: error.message });
        }
      }

      if (productsToInsert.length > 0) {
        await getProducts().insertMany(productsToInsert);
      } else {
        fs.unlinkSync(filePath);
        return res.status(400).json({ 
          success: false, 
          message: 'No valid products found in file',
          skipped: skipped.length
        });
      }

      fs.unlinkSync(filePath);

      res.json({
        success: true,
        message: `Imported ${imported.length} products to "${shop.name}" successfully`,
        shop: shop.name,
        imported: imported.length,
        skipped: skipped.length,
        errors: skipped,
        products: imported
      });

    } catch (error) {
      if (req.file && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      res.status(500).json({ message: error.message });
    }
  }
);

app.get('/api/admin/shops/:shopId/products', protect, authorize('admin'), async (req, res) => {
  try {
    const shop = await getShops().findOne({ _id: new ObjectId(req.params.shopId) });
    if (!shop) {
      return res.status(404).json({ message: 'Shop not found' });
    }

    const products = await getProducts().find({ shopId: req.params.shopId, isArchived: { $ne: true } }).toArray();
    res.json({
      success: true,
      shop: shop.name,
      products
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ============ HEALTH CHECK ============

app.get('/api/health', async (req, res) => {
  try {
    res.json({ 
      status: 'OK', 
      message: 'Doorzy API is running with MongoDB',
      users: await getUsers().countDocuments(),
      shops: await getShops().countDocuments(),
      products: await getProducts().countDocuments(),
      orders: await getOrders().countDocuments()
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ============ START SERVER ============

const PORT = process.env.PORT || 5000;

connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`\n🚀 Server running on http://localhost:${PORT}`);
    console.log('✅ MongoDB connected and ready');
    console.log('\n🔑 Admin Login:');
    console.log(`   Email: admin@nearcart.com`);
    console.log(`   Password: admin123`);
  });
});