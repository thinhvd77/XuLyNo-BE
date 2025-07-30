const dashboardService = require('../services/dashboard.service');
const { createChildLogger } = require("../config/logger");
const { AppError, asyncHandler } = require("../middleware/errorHandler");

const logger = createChildLogger("dashboard.controller");

exports.getDashboardStats = asyncHandler(async (req, res, next) => {
    try {
        const stats = await dashboardService.getDashboardStats();
        
        logger.info("Dashboard stats retrieved successfully", {
            requestedBy: req.user?.employee_code || 'unknown',
            statsKeys: Object.keys(stats)
        });

        res.status(200).json({
            success: true,
            data: stats,
        });
    } catch (error) {
        logger.error("Failed to retrieve dashboard stats", {
            requestedBy: req.user?.employee_code || 'unknown',
            error: error.message
        });
        return next(new AppError("Đã có lỗi xảy ra trên server.", 500));
    }
});

exports.getDirectorStats = asyncHandler(async (req, res, next) => {
    try {
        const { period = 'month' } = req.query;
        const stats = await dashboardService.getDirectorStats(period);
        
        logger.info("Director stats retrieved successfully", {
            requestedBy: req.user?.employee_code || 'unknown',
            period: period,
            statsKeys: Object.keys(stats)
        });

        res.status(200).json({
            success: true,
            data: stats,
        });
    } catch (error) {
        logger.error("Failed to retrieve director stats", {
            requestedBy: req.user?.employee_code || 'unknown',
            period: period,
            error: error.message
        });
        return next(new AppError("Đã có lỗi xảy ra trên server.", 500));
    }
});