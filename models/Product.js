const { ObjectId } = require('mongodb');
const { getProducts } = require('../config/db');

class Product {
  static collection() {
    return getProducts();
  }

  static async find(query = {}) {
    return await this.collection().find(query).toArray();
  }

  static async findActiveByShop(shopId) {
    const query = { isArchived: { $ne: true } };
    if (shopId) {
      query.shopId = shopId;
    }
    return await this.collection().find(query).toArray();
  }

  static async findById(id, includeArchived = false) {
    if (!id) return null;
    const filter = typeof id === 'string' && ObjectId.isValid(id) ? { _id: new ObjectId(id) } : { _id: id };
    if (!includeArchived) {
      filter.isArchived = { $ne: true };
    }
    return await this.collection().findOne(filter);
  }

  static async create(productData) {
    const price = parseFloat(productData.price);
    const mrp = parseFloat(productData.mrp);
    const discount = productData.discount !== undefined
      ? parseFloat(productData.discount)
      : parseFloat(((mrp - price) / mrp * 100).toFixed(2));
    const stock = parseInt(productData.stock) || 0;

    const product = {
      _id: new ObjectId(),
      name: productData.name,
      description: productData.description || '',
      category: productData.category || 'General',
      subCategory: productData.subCategory || '',
      shopId: productData.shopId,
      price: price,
      mrp: mrp,
      discount: isNaN(discount) ? 0 : discount,
      stock: stock,
      unit: productData.unit || 'piece',
      images: productData.images || [],
      isAvailable: stock > 0,
      isArchived: false,
      rating: 0,
      createdAt: new Date().toISOString()
    };

    await this.collection().insertOne(product);
    return product;
  }

  static async insertMany(products) {
    return await this.collection().insertMany(products);
  }

  static async updateById(id, updateData) {
    const query = typeof id === 'string' && ObjectId.isValid(id) ? { _id: new ObjectId(id) } : { _id: id };
    return await this.collection().updateOne(query, { $set: updateData });
  }

  static async decrementStock(id, quantity) {
    const query = typeof id === 'string' && ObjectId.isValid(id) ? { _id: new ObjectId(id) } : { _id: id };
    return await this.collection().updateOne(query, { $inc: { stock: -quantity } });
  }

  static async archive(id) {
    const query = typeof id === 'string' && ObjectId.isValid(id) ? { _id: new ObjectId(id) } : { _id: id };
    return await this.collection().updateOne(query, { $set: { isArchived: true, isAvailable: false } });
  }

  static async count(query = {}) {
    return await this.collection().countDocuments(query);
  }
}

module.exports = Product;
