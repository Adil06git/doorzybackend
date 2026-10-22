const Order = require('../models/Order');
const User = require('../models/User');
const DeliveryAgent = require('../models/DeliveryAgent');

const getDeliveryOrders = async (req, res) => {
  try {
    const orders = await Order.findByDeliveryAgentId(req.user.id);

    const ordersWithCustomer = await Promise.all(
      orders.map(async (order) => {
        const customer = await User.findById(order.userId);
        return {
          ...order,
          customer: customer
            ? {
                id: customer._id,
                name: customer.name,
                email: customer.email,
                phone: customer.phone,
                addresses: customer.addresses || []
              }
            : null
        };
      })
    );

    res.json({ orders: ordersWithCustomer });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getDeliveryStats = async (req, res) => {
  try {
    const agent = await DeliveryAgent.findByUserId(req.user.id);
    if (!agent) {
      return res.status(404).json({ message: 'Delivery agent profile not found' });
    }
    res.json({ agent });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const updateDeliveryStatus = async (req, res) => {
  try {
    const { status } = req.body;
    if (!['available', 'busy', 'offline'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    await DeliveryAgent.updateStatus(req.user.id, status);

    const agent = await DeliveryAgent.findByUserId(req.user.id);
    res.json({ agent });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getDeliveryOrders,
  getDeliveryStats,
  updateDeliveryStatus
};
