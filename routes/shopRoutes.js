const express = require('express');
const router = express.Router();
const {
  getShops,
  getShopById,
  createShop,
  updateShop,
  deleteShop
} = require('../controllers/shopController');
const { protect, authorize } = require('../middlewares/authMiddleware');

router.get('/', getShops);
router.get('/:id', getShopById);
router.post('/', protect, authorize('admin'), createShop);
router.put('/:id', protect, authorize('admin'), updateShop);
router.delete('/:id', protect, authorize('admin'), deleteShop);

module.exports = router;
