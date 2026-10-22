const { ObjectId } = require('mongodb');
const { getDeliveryAgents } = require('../config/db');

class DeliveryAgent {
  static collection() {
    return getDeliveryAgents();
  }

  static async findByUserId(userId) {
    return await this.collection().findOne({ userId });
  }

  static async findAll() {
    return await this.collection().find({}).toArray();
  }

  static async create(agentData) {
    const deliveryAgent = {
      _id: new ObjectId(),
      userId: agentData.userId,
      vehicleType: agentData.vehicleType || 'motorcycle',
      vehicleNumber: agentData.vehicleNumber || '',
      availabilityStatus: agentData.availabilityStatus || 'available',
      totalDeliveries: 0,
      rating: 0,
      totalEarnings: 0
    };
    await this.collection().insertOne(deliveryAgent);
    return deliveryAgent;
  }

  static async updateStatus(userId, status) {
    return await this.collection().updateOne(
      { userId },
      { $set: { availabilityStatus: status } }
    );
  }

  static async updateById(id, updateData) {
    const query = typeof id === 'string' && ObjectId.isValid(id) ? { _id: new ObjectId(id) } : { _id: id };
    return await this.collection().updateOne(query, { $set: updateData });
  }
}

module.exports = DeliveryAgent;
