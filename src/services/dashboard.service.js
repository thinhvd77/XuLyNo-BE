const AppDataSource = require("../config/dataSource");

/**
 * Lấy dữ liệu thống kê cho dashboard.
 */
exports.getDashboardStats = async () => {
    const caseRepository = AppDataSource.getRepository("DebtCase");
    const officerRepository = AppDataSource.getRepository("User");

    // 1. Lấy thống kê tổng hợp
    const totalStats = await caseRepository
        .createQueryBuilder("debt_cases")
        .select("COUNT(debt_cases.case_id)", "totalCases")
        .addSelect("SUM(debt_cases.outstanding_debt)", "totalDebt")
        .getRawOne();

    // 2. Lấy thống kê nội bảng và ngoại bảng
    const internalStats = await caseRepository
        .createQueryBuilder("debt_cases")
        .select("COUNT(debt_cases.case_id)", "internalCases")
        .addSelect("SUM(debt_cases.outstanding_debt)", "internalDebt")
        .where("debt_cases.case_type = :type", { type: "internal" })
        .getRawOne();

    const externalStats = await caseRepository
        .createQueryBuilder("debt_cases")
        .select("COUNT(debt_cases.case_id)", "externalCases")
        .addSelect("SUM(debt_cases.outstanding_debt)", "externalDebt")
        .where("debt_cases.case_type = :type", { type: "external" })
        .getRawOne();

    // 3. SỬA LẠI Ở ĐÂY: Lấy danh sách CBTD và số case của từng người bằng LEFT JOIN
    const officersWithCaseCount = await officerRepository
        .createQueryBuilder("user")
        .leftJoin("debt_cases", "cases", "cases.assigned_employee_code = user.employee_code")
        .select([
            "user.employee_code AS employee_code",
            "user.fullname AS fullname",
            "user.role AS role",
        ])
        .addSelect("COUNT(cases.case_id)", "caseCount")
        .where("user.role = :role", { role: "employee" })
        .groupBy("user.employee_code, user.fullname, user.role") // Nhóm theo tất cả các trường không tổng hợp
        .orderBy("\"caseCount\"", "DESC") // Dùng dấu ngoặc kép để tham chiếu đến alias
        .getRawMany();

    return {
        totalCases: parseInt(totalStats.totalCases, 10) || 0,
        totalOutstandingDebt: parseFloat(totalStats.totalDebt) || 0,
        // Thống kê nội bảng
        internalCases: parseInt(internalStats.internalCases, 10) || 0,
        internalOutstandingDebt: parseFloat(internalStats.internalDebt) || 0,
        // Thống kê ngoại bảng
        externalCases: parseInt(externalStats.externalCases, 10) || 0,
        externalOutstandingDebt: parseFloat(externalStats.externalDebt) || 0,
        officerStats: officersWithCaseCount.map(officer => ({
            ...officer,
            caseCount: parseInt(officer.caseCount, 10)
        })),
    };
};

/**
 * Lấy dữ liệu thống kê chi tiết cho Ban Giám Đốc
 */
exports.getDirectorStats = async (period = 'month') => {
    const caseRepository = AppDataSource.getRepository("DebtCase");
    const officerRepository = AppDataSource.getRepository("User");

    // Tính toán khoảng thời gian dựa trên period
    const now = new Date();
    let startDate;
    
    switch (period) {
        case 'week':
            startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            break;
        case 'quarter':
            startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
            break;
        case 'year':
            startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
            break;
        default: // month
            startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    // 1. Thống kê tổng quan
    const totalStats = await caseRepository
        .createQueryBuilder("debt_cases")
        .select("COUNT(debt_cases.case_id)", "totalCases")
        .addSelect("SUM(debt_cases.outstanding_debt)", "totalDebt")
        .getRawOne();

    // 2. Thống kê nội bảng/ngoại bảng
    const internalStats = await caseRepository
        .createQueryBuilder("debt_cases")
        .select("COUNT(debt_cases.case_id)", "internalCases")
        .addSelect("SUM(debt_cases.outstanding_debt)", "internalDebt")
        .where("debt_cases.case_type = :type", { type: "internal" })
        .getRawOne();

    const externalStats = await caseRepository
        .createQueryBuilder("debt_cases")
        .select("COUNT(debt_cases.case_id)", "externalCases")
        .addSelect("SUM(debt_cases.outstanding_debt)", "externalDebt")
        .where("debt_cases.case_type = :type", { type: "external" })
        .getRawOne();

    // 3. Thống kê theo trạng thái
    const completedCases = await caseRepository
        .createQueryBuilder("debt_cases")
        .select("COUNT(debt_cases.case_id)", "count")
        .where("debt_cases.state = :state", { state: "Hoàn thành" })
        .getRawOne();

    const processingCases = await caseRepository
        .createQueryBuilder("debt_cases")
        .select("COUNT(debt_cases.case_id)", "count")
        .where("debt_cases.state IN (:...states)", { states: ["Đang xử lý", "Mới"] })
        .getRawOne();

    const overdueCases = await caseRepository
        .createQueryBuilder("debt_cases")
        .select("COUNT(debt_cases.case_id)", "count")
        .where("debt_cases.state = :state", { state: "Quá hạn" })
        .getRawOne();

    // 4. Top nhân viên xuất sắc (giả lập dữ liệu tỷ lệ hoàn thành và số tiền thu hồi)
    const topPerformers = await officerRepository
        .createQueryBuilder("user")
        .leftJoin("debt_cases", "cases", "cases.assigned_employee_code = user.employee_code")
        .select([
            "user.employee_code AS employee_code",
            "user.fullname AS fullname",
        ])
        .addSelect("COUNT(cases.case_id)", "caseCount")
        .addSelect("SUM(cases.outstanding_debt)", "totalDebt")
        .where("user.role = :role", { role: "employee" })
        .groupBy("user.employee_code, user.fullname")
        .orderBy("\"caseCount\"", "DESC")
        .limit(10)
        .getRawMany();

    // 5. Xu hướng theo tháng (giả lập dữ liệu cho 6 tháng gần nhất)
    const monthlyTrend = [];
    for (let i = 5; i >= 0; i--) {
        const date = new Date();
        date.setMonth(date.getMonth() - i);
        const monthName = date.toLocaleDateString('vi-VN', { month: 'short', year: 'numeric' });
        
        // Giả lập dữ liệu xu hướng
        const internal = Math.random() * 50e9 + 100e9; // 100-150 tỷ
        const external = Math.random() * 30e9 + 50e9;  // 50-80 tỷ
        
        monthlyTrend.push({
            month: monthName,
            internal: internal,
            external: external
        });
    }

    // Tính tỷ lệ thu hồi (giả lập)
    const recoveryRate = 75.8; // Giả lập tỷ lệ thu hồi 75.8%

    return {
        totalCases: parseInt(totalStats.totalCases, 10) || 0,
        totalOutstandingDebt: parseFloat(totalStats.totalDebt) || 0,
        internalCases: parseInt(internalStats.internalCases, 10) || 0,
        internalOutstandingDebt: parseFloat(internalStats.internalDebt) || 0,
        externalCases: parseInt(externalStats.externalCases, 10) || 0,
        externalOutstandingDebt: parseFloat(externalStats.externalDebt) || 0,
        completedCases: parseInt(completedCases.count, 10) || 0,
        processingCases: parseInt(processingCases.count, 10) || 0,
        overdueCases: parseInt(overdueCases.count, 10) || 0,
        recoveryRate: recoveryRate,
        monthlyTrend: monthlyTrend,
        topPerformers: topPerformers.map((performer, index) => ({
            ...performer,
            caseCount: parseInt(performer.caseCount, 10) || 0,
            completionRate: Math.random() * 40 + 60, // 60-100%
            recoveredAmount: (parseFloat(performer.totalDebt) || 0) * (Math.random() * 0.3 + 0.5) // 50-80% của tổng nợ
        }))
    };
};