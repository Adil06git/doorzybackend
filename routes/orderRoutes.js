const express = require('express');
const router = express.Router();
const {
  createOrder,
  getUserOrders,
  updateOrderStatus,
  assignOrderAgent,
  getOrderOtp
} = require('../controllers/orderController');
const { protect, authorize } = require('../middlewares/authMiddleware');

router.post('/', protect, authorize('customer'), createOrder);
router.get('/', protect, getUserOrders);
router.put('/:id/status', protect, updateOrderStatus);
router.put('/:id/assign', protect, authorize('admin'), assignOrderAgent);
router.get('/:id/otp', protect, authorize('delivery_agent'), getOrderOtp);

module.exports = router;
