const express = require('express');
const router = express.Router();
const {
  getAdminOrders,
  getDashboardStats,
  getAllUsers,
  getAllAgents,
  createAgent,
  updateUserStatus,
  downloadImportTemplate,
  importProducts,
  getShopProducts
} = require('../controllers/adminController');
const { protect, authorize } = require('../middlewares/authMiddleware');
const upload = require('../middlewares/uploadMiddleware');

router.use(protect, authorize('admin'));

router.get('/orders', getAdminOrders);
router.get('/dashboard', getDashboardStats);
router.get('/users', getAllUsers);
router.get('/agents', getAllAgents);
router.post('/agents', createAgent);
router.put('/users/:id/status', updateUserStatus);
router.get('/import/template/:shopId', downloadImportTemplate);
router.post('/import/products/:shopId', upload.single('file'), importProducts);
router.get('/shops/:shopId/products', getShopProducts);

module.exports = router;
