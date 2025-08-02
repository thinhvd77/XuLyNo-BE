const dashboardService = require('../services/dashboard.service');
const logger = require('../config/logger');
const {
    asyncHandler,
    ValidationError,
    AuthenticationError
} = require('../middleware/errorHandler');

exports.getDashboardStats = asyncHandler(async (req, res) => {
    try {
        const stats = await dashboardService.getDashboardStats();

        if (!stats) {
            throw new Error('Failed to retrieve dashboard statistics');
        }

        logger.info('Dashboard stats retrieved successfully');

        res.status(200).json({
            success: true,
            data: stats,
        });
    } catch (error) {
        logger.error("Error retrieving dashboard stats:", error);
        throw error;
    }
});

exports.getDirectorStats = asyncHandler(async (req, res) => {
    try {
        const { period = 'month' } = req.query;

        // Validate period parameter
        const validPeriods = ['week', 'month', 'quarter', 'year'];
        if (period && !validPeriods.includes(period)) {
            throw new ValidationError(`Invalid period. Must be one of: ${validPeriods.join(', ')}`);
        }

        // Extract director's branch code from authenticated user
        const directorBranchCode = req.user?.branch_code;

        if (!directorBranchCode) {
            logger.warn('Director branch code not found in user context:', {
                user: req.user?.employee_code,
                url: req.originalUrl
            });
            throw new AuthenticationError('Director branch information not available');
        }

        // Call service with director's branch code for proper access control
        const stats = await dashboardService.getDirectorStats(directorBranchCode);

        if (!stats) {
            throw new Error('Failed to retrieve director statistics');
        }

        logger.info(`Director stats retrieved successfully for branch: ${directorBranchCode}`, {
            director: req.user.employee_code,
            totalCases: stats.totalCases,
            isUnrestricted: stats.isUnrestricted
        });

        res.status(200).json({
            success: true,
            data: stats,
            period: period,
            metadata: {
                branchCode: stats.branchCode,
                isUnrestricted: stats.isUnrestricted,
                calculationScope: stats.isUnrestricted ? 'All branches' : `Branch ${stats.branchCode} only`
            }
        });
    } catch (error) {
        logger.error(`Error retrieving director stats:`, {
            error: error.message,
            user: req.user?.employee_code,
            branch: req.user?.branch_code
        });
        throw error;
    }
});
