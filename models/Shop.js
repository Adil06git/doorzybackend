const { ObjectId } = require('mongodb');
const { getShops } = require('../config/db');

class Shop {
  static collection() {
    return getShops();
  }

  static async findActive() {
    return await this.collection().find({ isActive: { $ne: false } }).toArray();
  }

  static async findById(id) {
    if (!id) return null;
    let query;
    if (typeof id === 'string' && ObjectId.isValid(id)) {
      query = { _id: new ObjectId(id) };
    } else if (typeof id === 'string') {
      query = { id: id };
    } else {
      query = { _id: id };
    }
    return await this.collection().findOne(query);
  }

  static async create(shopData) {
    const shop = {
      _id: new ObjectId(),
      name: shopData.name,
      description: shopData.description,
      category: shopData.category,
      address: shopData.address || '',
      latitude: shopData.latitude || 0,
      longitude: shopData.longitude || 0,
      contactNumber: shopData.contactNumber || '',
      email: shopData.email || '',
      deliveryRadius: shopData.deliveryRadius !== undefined ? shopData.deliveryRadius : 10,
      deliveryChargePerKm: shopData.deliveryChargePerKm !== undefined ? shopData.deliveryChargePerKm : 10,
      isOpen: shopData.isOpen !== undefined ? shopData.isOpen : true,
      rating: 0,
      totalOrders: 0,
      isActive: true,
      createdAt: new Date().toISOString()
    };
    await this.collection().insertOne(shop);
    return shop;
  }

  static async updateById(id, updateData) {
    const query = typeof id === 'string' && ObjectId.isValid(id) ? { _id: new ObjectId(id) } : { _id: id };
    return await this.collection().updateOne(query, { $set: updateData });
  }

  static async deactivate(id) {
    const query = typeof id === 'string' && ObjectId.isValid(id) ? { _id: new ObjectId(id) } : { _id: id };
    return await this.collection().updateOne(query, { $set: { isActive: false } });
  }

  static async incrementTotalOrders(id) {
    const query = typeof id === 'string' && ObjectId.isValid(id) ? { _id: new ObjectId(id) } : { _id: id };
    return await this.collection().updateOne(query, { $inc: { totalOrders: 1 } });
  }

  static async count(query = {}) {
    return await this.collection().countDocuments(query);
  }
}

module.exports = Shop;
