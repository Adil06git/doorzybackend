const Order = require('../models/Order');
const Product = require('../models/Product');
const Shop = require('../models/Shop');
const User = require('../models/User');
const DeliveryAgent = require('../models/DeliveryAgent');
const { generateOTP } = require('../utils/otpGenerator');

const createOrder = async (req, res) => {
  try {
    const { shopId, items, deliveryAddress, paymentMethod } = req.body;

    if (!shopId || !items || items.length === 0) {
      return res.status(400).json({ message: 'Shop and items are required' });
    }

    let subtotal = 0;
    const orderItems = [];

    for (const item of items) {
      const product = await Product.findById(item.productId);
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

      await Product.decrementStock(item.productId, item.quantity);
    }

    const deliveryCharge = 20;
    const totalAmount = subtotal + deliveryCharge;

    const order = await Order.create({
      userId: req.user.id,
      shopId,
      items: orderItems,
      subtotal,
      deliveryCharge,
      totalAmount,
      deliveryAddress: deliveryAddress || {},
      paymentMethod: paymentMethod || 'cash_on_delivery'
    });

    res.status(201).json({ order });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getUserOrders = async (req, res) => {
  try {
    const orders = await Order.findByUserId(req.user.id);
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

const updateOrderStatus = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
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

    if (status === 'delivered') {
      if (!otp) {
        return res.status(400).json({ message: 'OTP is required to mark as delivered' });
      }

      if (order.deliveryOTP !== otp) {
        return res.status(400).json({ message: 'Invalid OTP' });
      }

      if (order.otpVerified) {
        return res.status(400).json({ message: 'OTP already verified for this order' });
      }

      await Order.updateById(req.params.id, { otpVerified: true });
    }

    const statusHistory = [
      ...order.statusHistory,
      {
        status,
        note: status === 'delivered' ? 'Order delivered (OTP verified)' : `Order ${status}`,
        timestamp: new Date().toISOString(),
        updatedBy: req.user.id
      }
    ];

    const updateData = {
      orderStatus: status,
      statusHistory
    };

    if (status === 'delivered') {
      updateData.actualDeliveryTime = new Date().toISOString();
      await Shop.incrementTotalOrders(order.shopId);
    }

    await Order.updateById(req.params.id, updateData);

    const updatedOrder = await Order.findById(req.params.id);
    res.json({ order: updatedOrder });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const assignOrderAgent = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    const { deliveryAgentId } = req.body;
    const agent = await User.findById(deliveryAgentId);
    if (!agent || agent.role !== 'delivery_agent') {
      return res.status(404).json({ message: 'Delivery agent not found' });
    }

    const otp = generateOTP();

    const statusHistory = [
      ...order.statusHistory,
      {
        status: 'accepted',
        note: `Assigned to delivery agent ${agent.name}`,
        timestamp: new Date().toISOString(),
        updatedBy: req.user.id
      }
    ];

    await Order.updateById(req.params.id, {
      deliveryAgentId,
      orderStatus: order.orderStatus === 'pending' ? 'accepted' : order.orderStatus,
      statusHistory,
      deliveryOTP: otp,
      otpVerified: false
    });

    await DeliveryAgent.updateStatus(deliveryAgentId, 'busy');

    const updatedOrder = await Order.findById(req.params.id);

    res.json({
      order: updatedOrder,
      otp: otp
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getOrderOtp = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

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
};

module.exports = {
  createOrder,
  getUserOrders,
  updateOrderStatus,
  assignOrderAgent,
  getOrderOtp
};
