const AppDataSource = require("../config/dataSource");
const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');
const { normalizeStatus, normalizeCaseType } = require('../constants/caseConstants');

/**
 * Lấy dữ liệu báo cáo với các bộ lọc
 */
exports.getReportData = async (req, res) => {
    try {
        const { 
            status, 
            caseType,
            branch, 
            department, 
            employeeCode,
            startDate,
            endDate 
        } = req.query;

        const caseRepository = AppDataSource.getRepository("DebtCase");
        const updateRepository = AppDataSource.getRepository("CaseUpdate");

        let query = caseRepository
            .createQueryBuilder("debt_cases")
            .leftJoin("User", "user", "user.employee_code = debt_cases.assigned_employee_code")
            .leftJoin(
                (qb) => {
                    return qb
                        .select("case_update.case_id", "case_id")
                        .addSelect("MAX(case_update.created_date)", "latest_date")
                        .from("case_updates", "case_update")
                        .groupBy("case_update.case_id");
                },
                "latest_updates",
                "latest_updates.case_id = debt_cases.case_id"
            )
            .leftJoin(
                "case_updates",
                "case_update",
                "case_update.case_id = debt_cases.case_id AND case_update.created_date = latest_updates.latest_date"
            )
            .select([
                "debt_cases.customer_code",
                "debt_cases.customer_name", 
                "debt_cases.state",
                "debt_cases.outstanding_debt",
                "debt_cases.case_type",
                "debt_cases.assigned_employee_code",
                "user.branch_code",
                "user.dept",
                "debt_cases.created_date",
                "user.fullname",
                "case_update.update_content",
                "case_update.created_date as update_date"
            ]);

        // Áp dụng các bộ lọc
        if (status) {
            query = query.andWhere("debt_cases.state = :status", { status });
        }

        if (caseType) {
            query = query.andWhere("debt_cases.case_type = :caseType", { caseType });
        }

        if (branch) {
            query = query.andWhere("user.branch_code = :branch", { branch });
        }

        if (department) {
            query = query.andWhere("user.dept = :department", { department });
        }

        if (employeeCode) {
            query = query.andWhere("debt_cases.assigned_employee_code = :employeeCode", { employeeCode });
        }

        if (startDate) {
            query = query.andWhere("debt_cases.created_date >= :startDate", { startDate });
        }

        if (endDate) {
            query = query.andWhere("debt_cases.created_date <= :endDate", { endDate });
        }

        const reportData = await query
            .orderBy("debt_cases.customer_code", "ASC")
            .getRawMany();

        // Chuyển đổi dữ liệu sang tiếng Việt
        const processedData = reportData.map(item => ({
            ...item,
            debt_cases_state: normalizeStatus(item.debt_cases_state),
            debt_cases_case_type: normalizeCaseType(item.debt_cases_case_type)
        }));

        res.json({
            success: true,
            data: processedData,
            total: processedData.length
        });

    } catch (error) {
        console.error('Error getting report data:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi khi lấy dữ liệu báo cáo',
            error: error.message
        });
    }
};

/**
 * Xuất báo cáo Excel
 */
exports.exportReport = async (req, res) => {
    try {
        const { 
            status, 
            caseType,
            branch, 
            department, 
            employeeCode,
            startDate,
            endDate 
        } = req.query;

        const caseRepository = AppDataSource.getRepository("DebtCase");

        let query = caseRepository
            .createQueryBuilder("debt_cases")
            .leftJoin("User", "user", "user.employee_code = debt_cases.assigned_employee_code")
            .leftJoin(
                (qb) => {
                    return qb
                        .select("case_update.case_id", "case_id")
                        .addSelect("MAX(case_update.created_date)", "latest_date")
                        .from("case_updates", "case_update")
                        .groupBy("case_update.case_id");
                },
                "latest_updates",
                "latest_updates.case_id = debt_cases.case_id"
            )
            .leftJoin(
                "case_updates",
                "case_update",
                "case_update.case_id = debt_cases.case_id AND case_update.created_date = latest_updates.latest_date"
            )
            .select([
                "debt_cases.customer_code",
                "debt_cases.customer_name", 
                "debt_cases.state",
                "debt_cases.outstanding_debt",
                "debt_cases.case_type",
                "debt_cases.assigned_employee_code",
                "user.branch_code",
                "user.dept",
                "debt_cases.created_date",
                "user.fullname",
                "case_update.update_content",
                "case_update.created_date as update_date"
            ]);

        // Áp dụng các bộ lọc
        if (status) {
            query = query.andWhere("debt_cases.state = :status", { status });
        }

        if (caseType) {
            query = query.andWhere("debt_cases.case_type = :caseType", { caseType });
        }

        if (branch) {
            query = query.andWhere("user.branch_code = :branch", { branch });
        }

        if (department) {
            query = query.andWhere("user.dept = :department", { department });
        }

        if (employeeCode) {
            query = query.andWhere("debt_cases.assigned_employee_code = :employeeCode", { employeeCode });
        }

        if (startDate) {
            query = query.andWhere("debt_cases.created_date >= :startDate", { startDate });
        }

        if (endDate) {
            query = query.andWhere("debt_cases.created_date <= :endDate", { endDate });
        }

        const reportData = await query
            .orderBy("debt_cases.customer_code", "ASC")
            .getRawMany();

        // Tạo workbook Excel
        const workbook = XLSX.utils.book_new();

        // Chuẩn bị dữ liệu cho Excel
        const excelData = reportData.map((item, index) => ({
            'STT': index + 1,
            'Mã KH': item.debt_cases_customer_code,
            'Tên KH': item.debt_cases_customer_name,
            'Trạng thái khoản vay': normalizeStatus(item.debt_cases_state),
            'Dư nợ': item.debt_cases_outstanding_debt ? 
                new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' })
                    .format(item.debt_cases_outstanding_debt) : '',
            'Loại Case': normalizeCaseType(item.debt_cases_case_type),
            'Chi nhánh': item.user_branch_code,
            'Phòng ban': item.user_dept,
            'CBTD': item.user_fullname || '',
            'Mã CBTD': item.debt_cases_assigned_employee_code,
            'Nội dung cập nhật mới nhất': item.case_update_update_content || '',
            'Ngày cập nhật mới nhất': item.update_date ? 
                new Date(item.update_date).toLocaleDateString('vi-VN') : '',
            'Ngày tạo case': new Date(item.debt_cases_created_date).toLocaleDateString('vi-VN')
        }));

        // Tạo worksheet
        const worksheet = XLSX.utils.json_to_sheet(excelData);

        // Thiết lập độ rộng cột
        const colWidths = [
            { wch: 5 },   // STT
            { wch: 15 },  // Mã KH
            { wch: 25 },  // Tên KH
            { wch: 20 },  // Trạng thái
            { wch: 20 },  // Dư nợ
            { wch: 15 },  // Loại Case
            { wch: 20 },  // Chi nhánh
            { wch: 20 },  // Phòng ban
            { wch: 25 },  // CBTD
            { wch: 15 },  // Mã CBTD
            { wch: 40 },  // Nội dung cập nhật
            { wch: 18 },  // Ngày cập nhật
            { wch: 15 }   // Ngày tạo
        ];
        worksheet['!cols'] = colWidths;

        // Thêm worksheet vào workbook
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Báo cáo');

        // Tạo tên file với timestamp
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
        const fileName = `BaoCao_${timestamp}.xlsx`;
        const filePath = path.join(__dirname, '../../uploads', fileName);

        // Đảm bảo thư mục uploads tồn tại
        const uploadsDir = path.join(__dirname, '../../uploads');
        if (!fs.existsSync(uploadsDir)) {
            fs.mkdirSync(uploadsDir, { recursive: true });
        }

        // Ghi file Excel
        XLSX.writeFile(workbook, filePath);

        // Gửi file cho client
        res.download(filePath, fileName, (err) => {
            if (err) {
                console.error('Error downloading file:', err);
                res.status(500).json({
                    success: false,
                    message: 'Lỗi khi tải file'
                });
            } else {
                // Xóa file sau khi gửi thành công
                setTimeout(() => {
                    if (fs.existsSync(filePath)) {
                        fs.unlinkSync(filePath);
                    }
                }, 5000);
            }
        });

    } catch (error) {
        console.error('Error exporting report:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi khi xuất báo cáo',
            error: error.message
        });
    }
};

/**
 * Lấy danh sách giá trị để filter
 */
exports.getFilterOptions = async (req, res) => {
    try {
        const caseRepository = AppDataSource.getRepository("DebtCase");
        const userRepository = AppDataSource.getRepository("User");

        // Lấy danh sách trạng thái
        const statuses = await caseRepository
            .createQueryBuilder("debt_cases")
            .select("DISTINCT debt_cases.state", "state")
            .where("debt_cases.state IS NOT NULL")
            .getRawMany();

        // Lấy danh sách chi nhánh
        const branches = await userRepository
            .createQueryBuilder("user")
            .innerJoin("debt_cases", "cases", "cases.assigned_employee_code = user.employee_code")
            .select("DISTINCT user.branch_code", "branch_code")
            .where("user.branch_code IS NOT NULL")
            .getRawMany();

        // Lấy danh sách phòng ban
        const departments = await userRepository
            .createQueryBuilder("user")
            .innerJoin("debt_cases", "cases", "cases.assigned_employee_code = user.employee_code")
            .select("DISTINCT user.dept", "dept")
            .where("user.dept IS NOT NULL")
            .getRawMany();

        // Lấy danh sách CBTD
        const employees = await userRepository
            .createQueryBuilder("user")
            .innerJoin("debt_cases", "cases", "cases.assigned_employee_code = user.employee_code")
            .select([
                "user.employee_code AS employee_code",
                "user.fullname AS fullname"
            ])
            .groupBy("user.employee_code, user.fullname")
            .orderBy("user.fullname", "ASC")
            .getRawMany();

        res.json({
            success: true,
            data: {
                statuses: statuses.map(s => ({
                    value: s.state,
                    label: normalizeStatus(s.state)
                })),
                branches: branches.map(b => b.branch_code),
                departments: departments.map(d => d.dept),
                employees: employees
            }
        });

    } catch (error) {
        console.error('Error getting filter options:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi khi lấy danh sách bộ lọc',
            error: error.message
        });
    }
};
