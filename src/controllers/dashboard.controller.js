const dashboardService = require('../services/dashboard.service');

exports.getDashboardStats = async (req, res) => {
    try {
        const stats = await dashboardService.getDashboardStats();
        res.status(200).json({
            success: true,
            data: stats,
        });
    } catch (error) {
        console.error("Lỗi khi lấy dữ liệu dashboard:", error);
        res.status(500).json({ success: false, message: "Đã có lỗi xảy ra trên server." });
    }
};