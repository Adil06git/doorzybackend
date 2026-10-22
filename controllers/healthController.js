const User = require('../models/User');
const Shop = require('../models/Shop');
const Product = require('../models/Product');
const Order = require('../models/Order');

const getHealth = async (req, res) => {
  try {
    res.json({
      status: 'OK',
      message: 'Doorzy API is running with MongoDB',
      users: await User.count(),
      shops: await Shop.count(),
      products: await Product.count(),
      orders: await Order.count()
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getHealth
};
