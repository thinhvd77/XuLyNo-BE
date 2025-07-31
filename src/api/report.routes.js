const express = require('express');
const router = express.Router();
const reportController = require('../controllers/report.controller');
const { protect } = require('../middleware/auth.middleware');

// Bảo vệ tất cả routes bằng authentication
router.use(protect);

// GET /api/report/data - Lấy dữ liệu báo cáo
router.get('/data', reportController.getReportData);

// GET /api/report/export - Xuất báo cáo Excel
router.get('/export', reportController.exportReport);

// GET /api/report/filters - Lấy danh sách options cho filter
router.get('/filters', reportController.getFilterOptions);

module.exports = router;
