const express = require('express');
const router = express.Router();
const {
  getDeliveryOrders,
  getDeliveryStats,
  updateDeliveryStatus
} = require('../controllers/deliveryController');
const { protect, authorize } = require('../middlewares/authMiddleware');

router.use(protect, authorize('delivery_agent'));

router.get('/orders', getDeliveryOrders);
router.get('/stats', getDeliveryStats);
router.put('/status', updateDeliveryStatus);

module.exports = router;
