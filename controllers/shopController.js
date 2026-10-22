const Shop = require('../models/Shop');
const Product = require('../models/Product');

const getShops = async (req, res) => {
  try {
    const shops = await Shop.findActive();
    res.json({ shops });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getShopById = async (req, res) => {
  try {
    const shop = await Shop.findById(req.params.id);
    if (!shop) {
      return res.status(404).json({ message: 'Shop not found' });
    }
    const products = await Product.findActiveByShop(req.params.id);
    res.json({ shop, products });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const createShop = async (req, res) => {
  try {
    const { name, description, category, address, latitude, longitude, contactNumber, email } = req.body;

    if (!name || !description || !category) {
      return res.status(400).json({ message: 'Name, description, and category are required' });
    }

    const shop = await Shop.create({
      name,
      description,
      category,
      address,
      latitude,
      longitude,
      contactNumber,
      email
    });

    res.status(201).json({ shop });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const updateShop = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = {};
    const allowedFields = [
      'name',
      'description',
      'category',
      'address',
      'latitude',
      'longitude',
      'contactNumber',
      'email',
      'deliveryRadius',
      'deliveryChargePerKm',
      'isOpen'
    ];

    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        updateData[field] = req.body[field];
      }
    });

    const result = await Shop.updateById(id, updateData);
    if (result.matchedCount === 0) {
      return res.status(404).json({ message: 'Shop not found' });
    }

    const shop = await Shop.findById(id);
    res.json({ shop });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const deleteShop = async (req, res) => {
  try {
    const result = await Shop.deactivate(req.params.id);
    if (result.matchedCount === 0) {
      return res.status(404).json({ message: 'Shop not found' });
    }
    res.json({ message: 'Shop deactivated successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getShops,
  getShopById,
  createShop,
  updateShop,
  deleteShop
};
