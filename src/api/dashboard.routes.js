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

module.exports = router;