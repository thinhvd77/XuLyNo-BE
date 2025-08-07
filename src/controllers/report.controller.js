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
            query = query.andWhere("case_update.created_date >= :startDate", { startDate });
        }

        if (endDate) {
            query = query.andWhere("case_update.created_date <= :endDate", { endDate });
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
            'Ngày cập nhật mới nh��t': item.update_date ?
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
                "user.fullname AS fullname",
                "user.branch_code AS branch_code"
            ])
            .groupBy("user.employee_code, user.fullname, user.branch_code")
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

/**
 * Lấy danh sách nhân viên theo chi nhánh
 */
exports.getEmployeesByBranch = async (req, res) => {
    try {
        const { branch } = req.query;
        const userRepository = AppDataSource.getRepository("User");

        let query = userRepository
            .createQueryBuilder("user")
            .innerJoin("debt_cases", "cases", "cases.assigned_employee_code = user.employee_code")
            .select([
                "user.employee_code AS employee_code",
                "user.fullname AS fullname",
                "user.branch_code AS branch_code"
            ])
            .groupBy("user.employee_code, user.fullname, user.branch_code")
            .orderBy("user.fullname", "ASC");

        if (branch) {
            query = query.where("user.branch_code = :branch", { branch });
        }

        const employees = await query.getRawMany();

        res.json({
            success: true,
            data: {
                employees: employees
            }
        });

    } catch (error) {
        console.error('Error getting employees by branch:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi khi lấy danh sách nhân viên theo chi nhánh',
            error: error.message
        });
    }
};

/**
 * Export report for all cases with ALL updates from their most recent update date
 */
exports.exportLatestDateUpdatesReport = async (req, res) => {
    try {
        const { status, caseType, branch, department, employeeCode } = req.query;

        // BƯỚC 1: Lấy danh sách ID các hồ sơ thỏa mãn điều kiện lọc.
        // Cách này đảm bảo không bị lặp dữ liệu do JOIN.
        const caseIdQuery = AppDataSource.getRepository("DebtCase")
            .createQueryBuilder("debt_case")
            .select("DISTINCT debt_case.case_id", "case_id")
            .leftJoin("debt_case.officer", "user");

        if (status) caseIdQuery.andWhere("debt_case.state = :status", { status });
        if (caseType) caseIdQuery.andWhere("debt_case.case_type = :caseType", { caseType });
        if (branch) caseIdQuery.andWhere("user.branch_code = :branch", { branch });
        if (department) caseIdQuery.andWhere("user.dept = :department", { department });
        if (employeeCode) caseIdQuery.andWhere("debt_case.assigned_employee_code = :employeeCode", { employeeCode });

        const filteredCases = await caseIdQuery.getRawMany();
        if (filteredCases.length === 0) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy dữ liệu phù hợp để xuất báo cáo.' });
        }
        const caseIds = filteredCases.map(c => c.case_id);

        // BƯỚC 2: Lấy tất cả dữ liệu cần thiết cho các hồ sơ đã lọc trong 2 câu truy vấn hiệu quả.
        // Lấy thông tin chi tiết của các hồ sơ (cases)
        const casesData = await AppDataSource.getRepository("DebtCase")
            .createQueryBuilder("debt_case")
            .leftJoinAndSelect("debt_case.officer", "user")
            .where("debt_case.case_id IN (:...caseIds)", { caseIds })
            .getMany();

        // Lấy tất cả cập nhật (updates) của các hồ sơ đó
        const allUpdates = await AppDataSource.getRepository("CaseUpdate")
            .createQueryBuilder("update")
            .leftJoinAndSelect("update.officer", "updater")
            .where("update.case_id IN (:...caseIds)", { caseIds })
            .orderBy("update.created_date", "ASC")
            .getMany();

        // BƯỚC 3: Xử lý dữ liệu trong code ứng dụng - an toàn và dễ kiểm soát.
        // Nhóm các cập nhật theo từng case_id
        const updatesByCaseId = allUpdates.reduce((acc, update) => {
            const id = update.case_id;
            if (!acc[id]) acc[id] = [];
            acc[id].push(update);
            return acc;
        }, {});

        // Chuẩn bị dữ liệu cuối cùng cho Excel
        const excelData = casesData.map(caseInfo => {
            const updatesForThisCase = updatesByCaseId[caseInfo.case_id] || [];
            let formattedUpdates = 'Chưa có cập nhật nào';
            let latestUpdateDateStr = '';

            if (updatesForThisCase.length > 0) {
                // Tìm ngày cập nhật gần nhất
                const latestDate = new Date(Math.max(...updatesForThisCase.map(u => new Date(u.created_date))));
                const latestDateString = latestDate.toISOString().split('T')[0];
                latestUpdateDateStr = latestDate.toLocaleDateString('vi-VN');

                // Lọc ra các cập nhật trong ngày gần nhất đó
                const updatesOnLatestDate = updatesForThisCase.filter(u => {
                    return new Date(u.created_date).toISOString().split('T')[0] === latestDateString;
                });

                // Gộp nội dung cập nhật vào một ô, có kiểm tra giới hạn
                if (updatesOnLatestDate.length > 0) {
                    const updateContents = updatesOnLatestDate.map(update => {
                        const time = new Date(update.created_date).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
                        const updaterName = update.officer?.fullname || 'Không rõ';
                        return `[${time}] ${updaterName}: ${update.update_content}`;
                    });

                    const joinedContent = updateContents.join('\n');
                    const CHAR_LIMIT = 32000; // Giới hạn an toàn

                    if (joinedContent.length > CHAR_LIMIT) {
                        let truncatedContent = '';
                        let hiddenCount = updateContents.length;
                        for (const content of updateContents) {
                            if ((truncatedContent.length + content.length + 1) < CHAR_LIMIT) {
                                truncatedContent += content + '\n';
                                hiddenCount--;
                            }
                        }
                        formattedUpdates = truncatedContent.trim() + `\n... [và ${hiddenCount} cập nhật khác đã bị ẩn do vượt quá giới hạn]`;
                    } else {
                        formattedUpdates = joinedContent;
                    }
                }
            }

            return {
                'Mã khách hàng': caseInfo.customer_code,
                'Tên khách hàng': caseInfo.customer_name,
                'Loại hồ sơ': normalizeCaseType(caseInfo.case_type),
                'Trạng thái': normalizeStatus(caseInfo.state),
                'Dư nợ (VND)': parseFloat(caseInfo.outstanding_debt || 0),
                'CBTD được giao': caseInfo.officer?.fullname || '',
                'Chi nhánh': caseInfo.officer?.branch_code || '',
                'Phòng ban': caseInfo.officer?.dept || '',
                'Tất cả cập nhật ngày mới nhất': formattedUpdates,
                'Ngày cập nhật mới nhất': latestUpdateDateStr,
                'Ngày tạo case': caseInfo.created_date ? new Date(caseInfo.created_date).toLocaleDateString('vi-VN') : '',
            };
        });

        // BƯỚC 4: Tạo và gửi file Excel
        const workbook = XLSX.utils.book_new();
        const worksheet = XLSX.utils.json_to_sheet(excelData);

        worksheet['!cols'] = [
            { wch: 15 }, { wch: 30 }, { wch: 12 }, { wch: 20 }, { wch: 18 },
            { wch: 25 }, { wch: 15 }, { wch: 15 }, { wch: 80 }, { wch: 18 }, { wch: 15 }
        ];

        const range = XLSX.utils.decode_range(worksheet['!ref']);
        for (let row = 1; row <= range.e.r; row++) {
            const cellAddress = XLSX.utils.encode_cell({ r: row, c: 8 }); // Cột "Tất cả cập nhật"
            if (worksheet[cellAddress]) {
                worksheet[cellAddress].s = { alignment: { wrapText: true, vertical: 'top' } };
            }
        }

        XLSX.utils.book_append_sheet(workbook, worksheet, 'Bao cao cap nhat');
        const currentDate = new Date().toLocaleDateString('vi-VN').replace(/\//g, '-');
        const filename = `Bao_cao_cap_nhat_moi_nhat_${currentDate}.xlsx`;
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`);
        const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
        res.send(buffer);

    } catch (error) {
        console.error('Error exporting latest date updates report:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi khi xuất báo cáo chi tiết cập nhật',
            error: error.message
        });
    }
};

// const normalizeStatus = (status) => {
//     const statusMap = {
//         'beingFollowedUp': 'Đang đôn đốc', 'beingSued': 'Đang khởi kiện',
//         'awaitingJudgmentEffect': 'Chờ hiệu lực án', 'beingExecuted': 'Đang thi hành án',
//         'proactivelySettled': 'Chủ động XLTS', 'debtSold': 'Bán nợ',
//         'amcHired': 'Thuê AMC XLN', 'completed': 'Hoàn thành'
//     };
//     return statusMap[status] || status;
// };
//
// const normalizeCaseType = (caseType) => {
//     const typeMap = { 'internal': 'Nội bảng', 'external': 'Ngoại bảng' };
//     return typeMap[caseType] || caseType;
// };

// Helper function for status display (reuse existing function)
const getStatusDisplayName = (status) => {
    const statusMap = {
        'beingFollowedUp': 'Đang đôn đốc',
        'beingSued': 'Đang khởi kiện',
        'awaitingJudgmentEffect': 'Chờ hiệu lực án',
        'beingExecuted': 'Đang thi hành án',
        'proactivelySettled': 'Chủ động XLTS',
        'debtSold': 'Bán nợ',
        'amcHired': 'Thuê AMC XLN'
    };
    return statusMap[status] || status;
};
