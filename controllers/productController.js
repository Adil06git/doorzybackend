const Product = require('../models/Product');
const Shop = require('../models/Shop');

const getProducts = async (req, res) => {
  try {
    const query = { isArchived: { $ne: true } };
    if (req.query.shopId) {
      query.shopId = req.query.shopId;
    }
    const products = await Product.find(query);
    res.json({ products });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getProductById = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }
    res.json({ product });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const createProduct = async (req, res) => {
  try {
    const { name, description, category, shopId, price, mrp, stock, unit } = req.body;

    if (!name || !price || !mrp || !shopId) {
      return res.status(400).json({ message: 'Name, price, mrp, and shopId are required' });
    }

    const shop = await Shop.findById(shopId);
    if (!shop) {
      return res.status(404).json({ message: 'Shop not found' });
    }

    const product = await Product.create({
      name,
      description,
      category,
      subCategory: req.body.subCategory,
      shopId,
      price,
      mrp,
      stock,
      unit,
      images: req.body.images
    });

    res.status(201).json({ product });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const updateProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = {};
    const allowedFields = [
      'name',
      'description',
      'category',
      'subCategory',
      'price',
      'mrp',
      'stock',
      'unit',
      'images',
      'isAvailable'
    ];

    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        updateData[field] = req.body[field];
      }
    });

    const product = await Product.findById(id);
    if (!product || product.isArchived) {
      return res.status(404).json({ message: 'Product not found' });
    }

    if (req.body.price !== undefined || req.body.mrp !== undefined) {
      const newPrice = req.body.price !== undefined ? parseFloat(req.body.price) : product.price;
      const newMrp = req.body.mrp !== undefined ? parseFloat(req.body.mrp) : product.mrp;
      updateData.discount = parseFloat(((newMrp - newPrice) / newMrp * 100).toFixed(2));
    }

    if (req.body.price !== undefined) updateData.price = parseFloat(req.body.price);
    if (req.body.mrp !== undefined) updateData.mrp = parseFloat(req.body.mrp);
    if (req.body.stock !== undefined) updateData.stock = parseInt(req.body.stock);

    await Product.updateById(id, updateData);

    const updatedProduct = await Product.findById(id);
    res.json({ product: updatedProduct });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const deleteProduct = async (req, res) => {
  try {
    const result = await Product.archive(req.params.id);
    if (result.matchedCount === 0) {
      return res.status(404).json({ message: 'Product not found' });
    }
    res.json({ message: 'Product archived successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct
};
