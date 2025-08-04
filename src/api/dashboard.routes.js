const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth.middleware');
const dashboardController = require('../controllers/dashboard.controller');

// Định nghĩa route: GET /api/dashboard/stats
// API này dành cho các cấp quản lý
router.get(
    '/stats',
    protect, // Yêu cầu đăng nhập
    authorize('manager', 'deputy_manager', 'director', 'deputy_director', 'administrator'), // Các vai trò được phép
    dashboardController.getDashboardStats
);

// Định nghĩa route: GET /api/dashboard/director-stats
// API này dành riêng cho Ban Giám Đốc
router.get(
    '/director-stats',
    protect, // Yêu cầu đăng nhập
    authorize('manager', 'director', 'deputy_director', 'administrator'), // Chỉ Ban Giám Đốc được phép
    dashboardController.getDirectorStats
);

module.exports = router;