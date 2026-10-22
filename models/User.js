const { ObjectId } = require('mongodb');
const { getUsers } = require('../config/db');

class User {
  static collection() {
    return getUsers();
  }

  static async findById(id) {
    if (!id) return null;
    const query = typeof id === 'string' && ObjectId.isValid(id) ? { _id: new ObjectId(id) } : { _id: id };
    return await this.collection().findOne(query);
  }

  static async findByEmail(email) {
    return await this.collection().findOne({ email });
  }

  static async create(userData) {
    const user = {
      _id: new ObjectId(),
      addresses: [],
      isActive: true,
      createdAt: new Date().toISOString(),
      ...userData
    };
    await this.collection().insertOne(user);
    return user;
  }

  static async updateById(id, updateData) {
    const query = typeof id === 'string' && ObjectId.isValid(id) ? { _id: new ObjectId(id) } : { _id: id };
    return await this.collection().updateOne(query, { $set: updateData });
  }

  static async updateRaw(filter, updateOperation) {
    return await this.collection().updateOne(filter, updateOperation);
  }

  static async findAll(query = {}, projection = {}) {
    return await this.collection().find(query, projection).toArray();
  }

  static async count(query = {}) {
    return await this.collection().countDocuments(query);
  }

  static sanitize(user) {
    if (!user) return null;
    const { password, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }
}

module.exports = User;
