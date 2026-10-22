const fs = require('fs');
const XLSX = require('xlsx');
const bcrypt = require('bcryptjs');
const { ObjectId } = require('mongodb');
const User = require('../models/User');
const Shop = require('../models/Shop');
const Product = require('../models/Product');
const Order = require('../models/Order');
const DeliveryAgent = require('../models/DeliveryAgent');

const getAdminOrders = async (req, res) => {
  try {
    const orders = await Order.findAll({});
    const ordersWithAgent = await Promise.all(
      orders.map(async (order) => {
        let deliveryAgentName = null;
        if (order.deliveryAgentId) {
          const agent = await DeliveryAgent.findByUserId(order.deliveryAgentId);
          if (agent) {
            const agentUser = await User.findById(agent.userId);
            deliveryAgentName = agentUser ? agentUser.name : null;
          }
        }
        return { ...order, deliveryAgentName };
      })
    );
    res.json({ orders: ordersWithAgent });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getDashboardStats = async (req, res) => {
  try {
    const totalUsers = await User.count({ role: 'customer' });
    const totalShops = await Shop.count({ isActive: { $ne: false } });
    const totalProducts = await Product.count({ isArchived: { $ne: true } });
    const totalOrders = await Order.count();
    const totalDeliveryAgents = await User.count({ role: 'delivery_agent' });

    const deliveredOrders = await Order.findAll({ orderStatus: 'delivered' });
    const revenue = deliveredOrders.reduce((sum, o) => sum + o.totalAmount, 0);

    const orders = await Order.findAll({}, { createdAt: -1 }, 10);

    const ordersByStatus = {
      pending: await Order.count({ orderStatus: 'pending' }),
      accepted: await Order.count({ orderStatus: 'accepted' }),
      picked_up: await Order.count({ orderStatus: 'picked_up' }),
      on_the_way: await Order.count({ orderStatus: 'on_the_way' }),
      delivered: await Order.count({ orderStatus: 'delivered' }),
      cancelled: await Order.count({ orderStatus: 'cancelled' })
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
};

const getAllUsers = async (req, res) => {
  try {
    const users = await User.findAll({});
    const usersWithoutPassword = users.map(({ password, ...user }) => user);
    res.json({ users: usersWithoutPassword });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getAllAgents = async (req, res) => {
  try {
    const agents = await DeliveryAgent.findAll();
    const agentsWithUser = await Promise.all(
      agents.map(async (agent) => {
        const user = await User.findById(agent.userId);
        return {
          ...agent,
          user: user
            ? {
                id: user._id,
                name: user.name,
                email: user.email,
                phone: user.phone
              }
            : null
        };
      })
    );
    res.json({ agents: agentsWithUser });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const createAgent = async (req, res) => {
  try {
    const { name, email, phone, password, vehicleType, vehicleNumber } = req.body;

    if (!name || !email || !phone || !password) {
      return res.status(400).json({ message: 'Name, email, phone, and password are required' });
    }

    const existing = await User.findByEmail(email);
    if (existing) {
      return res.status(400).json({ message: 'User with this email already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await User.create({
      name,
      email,
      password: hashedPassword,
      phone,
      role: 'delivery_agent'
    });

    await DeliveryAgent.create({
      userId: user._id.toString(),
      vehicleType: vehicleType || 'motorcycle',
      vehicleNumber: vehicleNumber || '',
      availabilityStatus: 'available'
    });

    res.status(201).json({
      success: true,
      message: 'Delivery agent created successfully',
      user: { id: user._id, name, email, phone, role: user.role }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const updateUserStatus = async (req, res) => {
  try {
    const result = await User.updateById(req.params.id, { isActive: req.body.isActive });
    if (result.matchedCount === 0) {
      return res.status(404).json({ message: 'User not found' });
    }
    const user = await User.findById(req.params.id);
    res.json({ user: { id: user._id, name: user.name, isActive: user.isActive } });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const downloadImportTemplate = async (req, res) => {
  try {
    console.log('🔍 Template download - shopId received:', req.params.shopId);

    const shop = await Shop.findById(req.params.shopId);
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
};

const importProducts = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    const shop = await Shop.findById(req.params.shopId);
    if (!shop) {
      if (fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
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

    const skipped = [];
    const imported = [];
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
      await Product.insertMany(productsToInsert);
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
};

const getShopProducts = async (req, res) => {
  try {
    const shop = await Shop.findById(req.params.shopId);
    if (!shop) {
      return res.status(404).json({ message: 'Shop not found' });
    }

    const products = await Product.findActiveByShop(req.params.shopId);
    res.json({
      success: true,
      shop: shop.name,
      products
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getAdminOrders,
  getDashboardStats,
  getAllUsers,
  getAllAgents,
  createAgent,
  updateUserStatus,
  downloadImportTemplate,
  importProducts,
  getShopProducts
};
