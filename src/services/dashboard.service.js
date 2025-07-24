const AppDataSource = require("../config/dataSource");

/**
 * Lấy dữ liệu thống kê cho dashboard.
 */
exports.getDashboardStats = async () => {
    const caseRepository = AppDataSource.getRepository("DebtCase");
    const officerRepository = AppDataSource.getRepository("User");

    // 1. Lấy tổng số hồ sơ và tổng dư nợ (giữ nguyên)
    const totalStats = await caseRepository
        .createQueryBuilder("debt_cases")
        .select("COUNT(debt_cases.case_id)", "totalCases")
        .addSelect("SUM(debt_cases.outstanding_debt)", "totalDebt")
        .getRawOne();

    // 2. SỬA LẠI Ở ĐÂY: Lấy danh sách CBTD và số case của từng người bằng LEFT JOIN
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
        officerStats: officersWithCaseCount.map(officer => ({
            ...officer,
            caseCount: parseInt(officer.caseCount, 10)
        })),
    };
};