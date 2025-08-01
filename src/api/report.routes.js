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

// GET /api/report/export-latest-updates - Xuất báo cáo tất cả case_updates có cùng ngày mới nhất
router.get('/export-latest-updates', reportController.exportLatestDateUpdatesReport);

// GET /api/report/filters - Lấy danh sách options cho filter
router.get('/filters', reportController.getFilterOptions);

module.exports = router;
