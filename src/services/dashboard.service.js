const AppDataSource = require("../config/dataSource");
const logger = require('../config/logger');

/**
 * Lấy dữ liệu thống kê cho dashboard.
 */
exports.getDashboardStats = async () => {
    const caseRepository = AppDataSource.getRepository("DebtCase");
    const officerRepository = AppDataSource.getRepository("User");

    // Optimize: Single query for all case statistics using conditional aggregation
    const caseStats = await caseRepository
        .createQueryBuilder("debt_cases")
        .select([
            "COUNT(debt_cases.case_id) as totalCases",
            "COALESCE(SUM(debt_cases.outstanding_debt), 0) as totalDebt",
            "COUNT(CASE WHEN debt_cases.case_type = 'internal' THEN 1 END) as internalCases",
            "COALESCE(SUM(CASE WHEN debt_cases.case_type = 'internal' THEN debt_cases.outstanding_debt ELSE 0 END), 0) as internalDebt",
            "COUNT(CASE WHEN debt_cases.case_type = 'external' THEN 1 END) as externalCases",
            "COALESCE(SUM(CASE WHEN debt_cases.case_type = 'external' THEN debt_cases.outstanding_debt ELSE 0 END), 0) as externalDebt"
        ])
        .getRawOne();

    // Optimize: More efficient officer query with proper JOIN and grouping
    const officersWithCaseCount = await officerRepository
        .createQueryBuilder("user")
        .innerJoin("debt_cases", "cases", "cases.assigned_employee_code = user.employee_code")
        .select([
            "user.employee_code",
            "user.fullname",
            "user.role",
            "COUNT(cases.case_id) as caseCount"
        ])
        .groupBy("user.employee_code, user.fullname, user.role")
        .orderBy("COUNT(cases.case_id)", "DESC")
        .getRawMany();

    return {
        totalCases: parseInt(caseStats.totalcases, 10) || 0,
        totalOutstandingDebt: parseFloat(caseStats.totaldebt) || 0,
        internalCases: parseInt(caseStats.internalcases, 10) || 0,
        internalOutstandingDebt: parseFloat(caseStats.internaldebt) || 0,
        externalCases: parseInt(caseStats.externalcases, 10) || 0,
        externalOutstandingDebt: parseFloat(caseStats.externaldebt) || 0,
        officerStats: officersWithCaseCount.map(officer => ({
            ...officer,
            caseCount: parseInt(officer.casecount, 10)
        })),
    };
};

/**
 * Get director statistics with branch-based access control
 * @param {string} directorBranchCode - Director's branch code for access control
 */
exports.getDirectorStats = async (directorBranchCode = null) => {
    try {
        if (!directorBranchCode) {
            throw new Error('Director branch code is required for statistics calculation');
        }

        const caseRepository = AppDataSource.getRepository("DebtCase");

        // Create query builder for statistics
        let queryBuilder = caseRepository
            .createQueryBuilder("debt_cases")
            .select([
                "COUNT(debt_cases.case_id) as totalCases",
                "COALESCE(SUM(debt_cases.outstanding_debt), 0) as totalDebt",
                "COUNT(CASE WHEN debt_cases.case_type = 'internal' THEN 1 END) as internalCases",
                "COALESCE(SUM(CASE WHEN debt_cases.case_type = 'internal' THEN debt_cases.outstanding_debt ELSE 0 END), 0) as internalDebt",
                "COUNT(CASE WHEN debt_cases.case_type = 'external' THEN 1 END) as externalCases",
                "COALESCE(SUM(CASE WHEN debt_cases.case_type = 'external' THEN debt_cases.outstanding_debt ELSE 0 END), 0) as externalDebt"
            ]);

        // Apply branch-based access control
        if (directorBranchCode !== '6421') {
            // Non-6421 directors: filter by customer_code prefix (first 4 characters)
            queryBuilder = queryBuilder.andWhere(
                "LEFT(debt_cases.customer_code, 4) = :branchCode",
                { branchCode: directorBranchCode }
            );
            logger.info(`Applied branch filtering for director stats: ${directorBranchCode}`);
        } else {
            // Branch 6421 directors: see all data across the system
            logger.info('Director from branch 6421 - calculating stats for all cases');
        }

        let stats;
        try {
            stats = await queryBuilder.getRawOne();
        } catch (dbError) {
            logger.error('Database error in getDirectorStats:', dbError);
            throw new Error('Failed to retrieve director statistics from database');
        }

        const result = {
            totalCases: parseInt(stats.totalcases, 10) || 0,
            totalOutstandingDebt: parseFloat(stats.totaldebt) || 0,
            internalCases: parseInt(stats.internalcases, 10) || 0,
            internalOutstandingDebt: parseFloat(stats.internaldebt) || 0,
            externalCases: parseInt(stats.externalcases, 10) || 0,
            externalOutstandingDebt: parseFloat(stats.externaldebt) || 0,
            branchCode: directorBranchCode,
            isUnrestricted: directorBranchCode === '6421'
        };

        logger.info(`Director stats calculated successfully`, {
            directorBranch: directorBranchCode,
            totalCases: result.totalCases,
            totalDebt: result.totalOutstandingDebt,
            isUnrestricted: result.isUnrestricted
        });

        return result;

    } catch (error) {
        logger.error('Error in getDirectorStats:', error);
        throw error;
    }
};