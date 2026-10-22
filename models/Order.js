const { ObjectId } = require('mongodb');
const { getOrders } = require('../config/db');

class Order {
  static collection() {
    return getOrders();
  }

  static async findById(id) {
    if (!id) return null;
    const query = typeof id === 'string' && ObjectId.isValid(id) ? { _id: new ObjectId(id) } : { _id: id };
    return await this.collection().findOne(query);
  }

  static async findByUserId(userId) {
    return await this.collection().find({ userId }).toArray();
  }

  static async findByDeliveryAgentId(deliveryAgentId) {
    return await this.collection().find({ deliveryAgentId }).toArray();
  }

  static async findAll(query = {}, sort = {}, limit = 0) {
    let cursor = this.collection().find(query);
    if (Object.keys(sort).length > 0) {
      cursor = cursor.sort(sort);
    }
    if (limit > 0) {
      cursor = cursor.limit(limit);
    }
    return await cursor.toArray();
  }

  static async create(orderData) {
    const order = {
      _id: new ObjectId(),
      orderNumber: 'ORD-' + Date.now().toString(36).toUpperCase(),
      userId: orderData.userId,
      shopId: orderData.shopId,
      items: orderData.items,
      subtotal: orderData.subtotal,
      deliveryCharge: orderData.deliveryCharge,
      totalAmount: orderData.totalAmount,
      deliveryAddress: orderData.deliveryAddress || {},
      paymentMethod: orderData.paymentMethod || 'cash_on_delivery',
      orderStatus: 'pending',
      deliveryAgentId: null,
      deliveryOTP: null,
      otpVerified: false,
      createdAt: new Date().toISOString(),
      statusHistory: [
        { status: 'pending', note: 'Order created', timestamp: new Date().toISOString() }
      ]
    };
    await this.collection().insertOne(order);
    return order;
  }

  static async updateById(id, updateData) {
    const query = typeof id === 'string' && ObjectId.isValid(id) ? { _id: new ObjectId(id) } : { _id: id };
    return await this.collection().updateOne(query, { $set: updateData });
  }

  static async count(query = {}) {
    return await this.collection().countDocuments(query);
  }
}

module.exports = Order;
