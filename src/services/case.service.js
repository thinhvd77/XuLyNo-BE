const AppDataSource = require("../config/dataSource");
const xlsx = require("xlsx");
const { Not } = require("typeorm");
const fs = require('fs');
const path = require('path');
const { getRelativeFilePath, getAbsoluteFilePath } = require('../utils/filePathHelper');
const logger = require('../config/logger');

/**
 * Xử lý import hồ sơ nợ từ file Excel, tổng hợp dư nợ theo mã khách hàng
 * @param {Buffer} fileBuffer - Nội dung file Excel từ multer
 */
exports.importCasesFromExcel = async (fileBuffer) => {
    let workbook = null;
    let data = [];

    try {
        // Validate input buffer
        if (!fileBuffer || fileBuffer.length === 0) {
            throw new Error('File buffer rỗng hoặc không hợp lệ');
        }

        // Check if buffer has Excel file signature
        const excelSignatures = [
            Buffer.from([0xD0, 0xCF, 0x11, 0xE0]), // .xls signature (OLE2)
            Buffer.from([0x50, 0x4B, 0x03, 0x04]), // .xlsx signature (ZIP)
            Buffer.from([0x50, 0x4B, 0x07, 0x08]), // Alternative .xlsx signature
        ];

        const hasValidSignature = excelSignatures.some(signature => 
            fileBuffer.subarray(0, signature.length).equals(signature)
        );

        if (!hasValidSignature) {
            throw new Error('File không phải là file Excel hợp lệ. Vui lòng kiểm tra lại định dạng file.');
        }

        const caseRepository = AppDataSource.getRepository("DebtCase");

        // 1. Đọc dữ liệu từ file Excel with enhanced error handling
        try {
            workbook = xlsx.read(fileBuffer, { type: 'buffer' });
        } catch (error) {
            logger.error('Failed to parse Excel file:', error);
            throw new Error('Không thể đọc file Excel. Vui lòng kiểm tra định dạng file và thử lại.');
        }

        if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
            throw new Error('Excel file contains no sheets');
        }

        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];

        if (!worksheet) {
            throw new Error('First sheet is empty or corrupted');
        }

        try {
            data = xlsx.utils.sheet_to_json(worksheet);
        } catch (error) {
            logger.error('Failed to convert sheet to JSON:', error);
            throw new Error('Failed to read Excel data');
        }

        if (!Array.isArray(data) || data.length === 0) {
            throw new Error('Excel file contains no data rows');
        }

        const allowedDebtGroups = [3, 4, 5];
        const customerDebtMap = new Map();

        // 2. Lọc và tổng hợp dữ liệu vào Map with error handling
        for (let i = 0; i < data.length; i++) {
            try {
                const row = data[i];
                const debtGroupString = row.AQCCDFIN;

                // **THAY ĐỔI Ở ĐÂY: Logic trích xuất số từ chuỗi**
                let debtGroupNumber = 0;
                if (typeof debtGroupString === "string") {
                    const match = debtGroupString.match(/\d+/); // Tìm một hoặc nhiều chữ số
                    if (match) {
                        debtGroupNumber = parseInt(match[0], 10);
                    }
                } else if (typeof debtGroupString === "number") {
                    debtGroupNumber = debtGroupString;
                }

                // Lọc theo nhóm nợ đã được trích xuất
                if (!allowedDebtGroups.includes(debtGroupNumber)) {
                    continue;
                }

                const customerCode = row.brcd;
                const outstandingDebt = Number(row.dsbsbal) || 0;
                const employeeCode = row.ofcno; // **THAY ĐỔI Ở ĐÂY: Dùng cột 'ofcno'**
                const customerName = row.custnm;

                if (!customerCode) {
                    logger.warn(`Row ${i + 1}: Missing customer code, skipping`);
                    continue;
                }

                if (customerDebtMap.has(customerCode)) {
                    const currentData = customerDebtMap.get(customerCode);
                    currentData.outstanding_debt += outstandingDebt;
                    // Cập nhật CBTD nếu cần, hoặc giữ người đầu tiên tìm thấy
                    customerDebtMap.set(customerCode, currentData);
                } else {
                    customerDebtMap.set(customerCode, {
                        customer_code: customerCode,
                        customer_name: customerName,
                        outstanding_debt: outstandingDebt,
                        assigned_employee_code: employeeCode,
                        case_type: "internal",
                    });
                }
            } catch (rowError) {
                logger.warn(`Error processing row ${i + 1}:`, rowError.message);
                // Continue processing other rows
                continue;
            }
        }

        // 3. Chuyển Map thành mảng để xử lý
        const aggregatedData = Array.from(customerDebtMap.values());

        let createdCount = 0;
        let updatedCount = 0;
        const errors = [];

        // 4. Lặp qua dữ liệu đã tổng hợp và cập nhật CSDL
        for (let i = 0; i < aggregatedData.length; i++) {
            const customer = aggregatedData[i];
            try {
                if (
                    !customer.customer_code ||
                    !customer.customer_name ||
                    !customer.assigned_employee_code
                ) {
                    const errorMsg = `Khách hàng với mã ${customer.customer_code} bị thiếu thông tin Tên hoặc CBTD.`;
                    errors.push(errorMsg);
                    logger.warn(errorMsg);
                    continue;
                }

                let existingCase = await caseRepository.findOneBy({
                    customer_code: customer.customer_code,
                    case_type: "internal", // **THAY ĐỔI Ở ĐÂY**
                });

                if (existingCase) {
                    existingCase.outstanding_debt = customer.outstanding_debt;
                    existingCase.assigned_employee_code =
                        customer.assigned_employee_code;
                    await caseRepository.save(existingCase);
                    updatedCount++;
                } else {
                    const newCase = caseRepository.create(customer);
                    await caseRepository.save(newCase);
                    createdCount++;
                }
            } catch (error) {
                const errorMsg = `Lỗi xử lý khách hàng ${customer.customer_code}: ${error.message}`;
                errors.push(errorMsg);
                logger.error(`Database error for customer ${customer.customer_code}:`, error);
            }
        }

        // 5. Trả về kết quả
        const result = {
            totalRowsInFile: data.length,
            processedCustomers: aggregatedData.length,
            created: createdCount,
            updated: updatedCount,
            errors: errors,
        };

        logger.info('Excel import completed:', result);
        return result;

    } catch (error) {
        logger.error('Fatal error in importCasesFromExcel:', error);
        throw error;
    }
};

/**
 * MỚI: Tìm tất cả hồ sơ được phân công cho một nhân viên cụ thể
 */
exports.findCasesByEmployeeCode = async (employeeCode) => {
    try {
        if (!employeeCode) {
            throw new Error('Employee code is required');
        }

        const caseRepository = AppDataSource.getRepository("DebtCase");
        const cases = await caseRepository.find({
            where: {
                assigned_employee_code: employeeCode,
            },
            order: {
                last_modified_date: "DESC", // Sắp xếp theo ngày cập nhật mới nhất
            },
        });

        logger.info(`Found ${cases.length} cases for employee ${employeeCode}`);
        return cases;
    } catch (error) {
        logger.error(`Error finding cases for employee ${employeeCode}:`, error);
        throw error;
    }
};

/**
 * NEW: Tìm hồ sơ của nhân viên với phân trang và bộ lọc (giống như findDepartmentCases)
 */
exports.findMyCases = async (employeeCode, page = 1, filters = {}, limit = 20, sorting = {}) => {
    try {
        if (!employeeCode) {
            throw new Error('Employee code is required');
        }

        if (page < 1) {
            throw new Error('Page must be greater than 0');
        }

        if (limit < 1 || limit > 1000) {
            throw new Error('Limit must be between 1 and 1000');
        }

        const caseRepository = AppDataSource.getRepository("DebtCase");
        const offset = (page - 1) * limit;

        // Tạo query builder với join officer
        let queryBuilder = caseRepository
            .createQueryBuilder("debt_cases")
            .leftJoinAndSelect("debt_cases.officer", "officer");

        // Bộ lọc cơ bản: chỉ hiển thị cases được gán cho nhân viên này
        queryBuilder = queryBuilder.andWhere("debt_cases.assigned_employee_code = :employeeCode", { employeeCode });

        // Áp dụng bộ lọc tìm kiếm with sanitization
        if (filters.search && typeof filters.search === 'string') {
            const sanitizedSearch = filters.search.trim().substring(0, 100); // Limit search length
            queryBuilder = queryBuilder.andWhere(
                "(debt_cases.customer_name ILIKE :search OR debt_cases.case_id ILIKE :search OR debt_cases.customer_code ILIKE :search)",
                { search: `%${sanitizedSearch}%` }
            );
        }

        if (filters.type && typeof filters.type === 'string') {
            queryBuilder = queryBuilder.andWhere("debt_cases.case_type = :type", { type: filters.type });
        }

        if (filters.status && typeof filters.status === 'string') {
            queryBuilder = queryBuilder.andWhere("debt_cases.state = :status", { status: filters.status });
        }

        // Áp dụng sorting with validation
        if (sorting.sortBy && sorting.sortOrder) {
            let orderByField;
            let orderDirection = sorting.sortOrder.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';

            switch (sorting.sortBy) {
                case 'case_id':
                    orderByField = 'debt_cases.case_id';
                    break;
                case 'customer_code':
                    orderByField = 'debt_cases.customer_code';
                    break;
                case 'customer_name':
                    orderByField = 'debt_cases.customer_name';
                    break;
                case 'outstanding_debt':
                    orderByField = 'debt_cases.outstanding_debt';
                    break;
                case 'case_type':
                    orderByField = 'debt_cases.case_type';
                    break;
                case 'state':
                    orderByField = 'debt_cases.state';
                    break;
                case 'last_modified_date':
                    orderByField = 'debt_cases.last_modified_date';
                    break;
                default:
                    orderByField = 'debt_cases.last_modified_date';
                    orderDirection = 'DESC';
            }

            queryBuilder = queryBuilder.orderBy(orderByField, orderDirection);
        } else {
            // Default sorting
            queryBuilder = queryBuilder.orderBy('debt_cases.last_modified_date', 'DESC');
        }

        // Execute query with error handling
        let cases, totalCount;
        try {
            [cases, totalCount] = await Promise.all([
                queryBuilder.skip(offset).take(limit).getMany(),
                queryBuilder.getCount()
            ]);
        } catch (dbError) {
            logger.error('Database query error in findMyCases:', dbError);
            throw new Error('Failed to retrieve cases from database');
        }

        const result = {
            cases,
            total: totalCount,
            page: parseInt(page),
            limit: parseInt(limit),
            totalPages: Math.ceil(totalCount / limit)
        };

        logger.info(`Found ${cases.length} cases for employee ${employeeCode} (page ${page})`);
        return result;

    } catch (error) {
        logger.error(`Error in findMyCases for employee ${employeeCode}:`, error);
        throw error;
    }
};

/**
 * MỚI: Tìm tất cả hồ sơ với phân trang và bộ lọc (dành cho Ban Giám Đốc)
 */
exports.findAllCases = async (page = 1, filters = {}, limit = 20, sorting = {}, directorBranchCode = null) => {
    try {
        // Input validation
        if (page < 1) {
            throw new Error('Page must be greater than 0');
        }

        if (limit < 1 || limit > 1000) {
            throw new Error('Limit must be between 1 and 1000');
        }

        const caseRepository = AppDataSource.getRepository("DebtCase");

        // Tạo query builder
        const queryBuilder = caseRepository
            .createQueryBuilder("debt_cases")
            .leftJoinAndSelect("debt_cases.officer", "officer");

        // Director-level branch filtering logic
        if (directorBranchCode && directorBranchCode !== '6421') {
            // For directors not from branch '6421', filter cases by customer_code prefix
            queryBuilder.andWhere(
                "LEFT(debt_cases.customer_code, 4) = :directorBranchCode",
                { directorBranchCode }
            );
            logger.info(`Applied branch filtering for director: ${directorBranchCode}`);
        } else if (directorBranchCode === '6421') {
            // Branch '6421' directors can see all cases - no additional filtering
            logger.info('Director from branch 6421 - showing all cases');
        }

        // Apply additional filters with validation
        if (filters.search && typeof filters.search === 'string') {
            const sanitizedSearch = filters.search.trim().substring(0, 100);
            queryBuilder.andWhere(
                "(debt_cases.customer_name ILIKE :search OR debt_cases.customer_code ILIKE :search)",
                { search: `%${sanitizedSearch}%` }
            );
        }

        if (filters.type && typeof filters.type === 'string') {
            queryBuilder.andWhere("debt_cases.case_type = :type", { type: filters.type });
        }

        if (filters.status && typeof filters.status === 'string') {
            queryBuilder.andWhere("debt_cases.state = :status", { status: filters.status });
        }

        if (filters.branch_code && typeof filters.branch_code === 'string') {
            queryBuilder.andWhere("officer.branch_code = :branch_code", { branch_code: filters.branch_code });
        }

        if (filters.department_code && typeof filters.department_code === 'string') {
            queryBuilder.andWhere("officer.dept = :department_code", { department_code: filters.department_code });
        }

        if (filters.employee_code && typeof filters.employee_code === 'string') {
            queryBuilder.andWhere("officer.employee_code = :employee_code", { employee_code: filters.employee_code });
        }

        // Apply sorting with validation
        if (sorting.sortBy && sorting.sortOrder) {
            const orderDirection = sorting.sortOrder.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
            const sortMap = {
                'customer_code': 'debt_cases.customer_code',
                'customer_name': 'debt_cases.customer_name',
                'outstanding_debt': 'debt_cases.outstanding_debt',
                'case_type': 'debt_cases.case_type',
                'state': 'debt_cases.state',
                'created_date': 'debt_cases.created_date',
                'officer': 'officer.fullname',
            };

            const orderByField = sortMap[sorting.sortBy] || 'debt_cases.last_modified_date';
            queryBuilder.orderBy(orderByField, orderDirection);
        } else {
            // Default sorting
            queryBuilder.orderBy("debt_cases.last_modified_date", "DESC");
        }

        // Execute queries with error handling
        const offset = (page - 1) * limit;
        let cases, totalCases;

        // Log applied filters for debugging
        const appliedFilters = Object.entries(filters)
            .filter(([key, value]) => value && value !== '')
            .map(([key, value]) => `${key}=${value}`)
            .join(', ');
            
        logger.info('Case filtering applied:', {
            directorBranch: directorBranchCode,
            appliedFilters: appliedFilters || 'none',
            page,
            limit
        });

        try {
            [cases, totalCases] = await Promise.all([
                queryBuilder.skip(offset).take(limit).getMany(),
                queryBuilder.getCount()
            ]);
        } catch (dbError) {
            logger.error('Database query error in findAllCases:', dbError);
            throw new Error('Failed to retrieve cases from database');
        }

        const totalPages = Math.ceil(totalCases / limit);

        const result = {
            success: true,
            data: {
                cases,
                currentPage: parseInt(page, 10),
                totalPages,
                totalCases,
                limit: parseInt(limit, 10)
            }
        };

        logger.info(`Found ${cases.length} cases for director (branch: ${directorBranchCode || 'unknown'}, page ${page})`);
        return result;

    } catch (error) {
        logger.error('Error in findAllCases:', error);
        throw error;
    }
};

/** * MỚI: Tìm tất cả hồ sơ theo bộ lọc department và branch
 * @param {number} page - Trang hiện tại (mặc định: 1)
 * @param {object} filters - Bộ lọc tùy chọn (bao gồm department, branch_code, search, type, status, employee_code)
 * @param {number} limit - Số lượng bản ghi trên mỗi trang (mặc định: 20, tối đa: 1000)
 * @param {object} sorting - Thông tin sắp xếp (bao gồm sortBy và sortOrder)
 * @return {Promise<object>} - Kết quả tìm kiếm với phân trang và bộ lọc
 * @throws {Error} - Nếu có lỗi trong quá trình tìm kiếm hoặc phân trang
 * * Core Requirement: Tìm kiếm hồ sơ theo department và branch_code, áp dụng AND logic
 * * Core Requirement: Chỉ cho phép tìm kiếm hồ sơ của nhân viên trong cùng department và branch_code
 * * * Core Requirement: Phải có phân trang với page và limit, mặc định là 1 và 20
 * * * Core Requirement: Phải có bộ lọc tìm kiếm theo tên khách hàng, mã khách hàng, loại hồ sơ, trạng thái hồ sơ
 * * * Core Requirement: Phải có sắp xếp theo trường hợp định nghĩa trong sorting
 * * * Core Requirement: Phải có thông tin về người phụ trách hồ sơ (officer) trong kết quả
 */
exports.findDepartmentCases = async (page = 1, filters = {}, limit = 20, sorting = {}) => {
    try {
        // Input validation
        if (page < 1) {
            throw new Error('Page must be greater than 0');
        }

        if (limit < 1 || limit > 1000) {
            throw new Error('Limit must be between 1 and 1000');
        }

        // Validate required department and branch filters
        if (!filters.department || typeof filters.department !== 'string') {
            throw new Error('Department filter is required and must be a string');
        }

        if (!filters.branch_code || typeof filters.branch_code !== 'string') {
            throw new Error('Branch code filter is required and must be a string');
        }

        const caseRepository = AppDataSource.getRepository("DebtCase");
        const offset = (page - 1) * limit;

        // Tạo query builder với join officer
        let queryBuilder = caseRepository
            .createQueryBuilder("debt_cases")
            .leftJoinAndSelect("debt_cases.officer", "officer");

        // CORE REQUIREMENT: Apply BOTH department AND branch filters together (AND logic)
        queryBuilder = queryBuilder.andWhere(
            "officer.dept = :department AND officer.branch_code = :branch_code",
            {
                department: filters.department,
                branch_code: filters.branch_code
            }
        );

        // Apply additional optional filters
        if (filters.search && typeof filters.search === 'string') {
            const sanitizedSearch = filters.search.trim().substring(0, 100);
            queryBuilder = queryBuilder.andWhere(
                "(debt_cases.customer_name ILIKE :search OR debt_cases.customer_code ILIKE :search)",
                { search: `%${sanitizedSearch}%` }
            );
        }

        if (filters.type && typeof filters.type === 'string') {
            queryBuilder = queryBuilder.andWhere("debt_cases.case_type = :type", { type: filters.type });
        }

        if (filters.status && typeof filters.status === 'string') {
            queryBuilder = queryBuilder.andWhere("debt_cases.state = :status", { status: filters.status });
        }

        // Apply specific employee filter if provided (within the same department/branch)
        if (filters.employee_code && typeof filters.employee_code === 'string') {
            queryBuilder = queryBuilder.andWhere("officer.employee_code = :employee_code", { employee_code: filters.employee_code });
        }

        // Apply sorting with validation
        if (sorting.sortBy && sorting.sortOrder) {
            let orderByField;
            let orderDirection = sorting.sortOrder.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';

            switch (sorting.sortBy) {
                case 'customer_code':
                    orderByField = 'debt_cases.customer_code';
                    break;
                case 'customer_name':
                    orderByField = 'debt_cases.customer_name';
                    break;
                case 'outstanding_debt':
                    orderByField = 'debt_cases.outstanding_debt';
                    break;
                case 'case_type':
                    orderByField = 'debt_cases.case_type';
                    break;
                case 'state':
                    orderByField = 'debt_cases.state';
                    break;
                case 'created_date':
                    orderByField = 'debt_cases.created_date';
                    break;
                case 'officer':
                    orderByField = 'officer.fullname';
                    break;
                default:
                    orderByField = 'debt_cases.last_modified_date';
                    orderDirection = 'DESC';
            }

            queryBuilder = queryBuilder.orderBy(orderByField, orderDirection);
        } else {
            // Default sorting
            queryBuilder = queryBuilder.orderBy("debt_cases.last_modified_date", "DESC");
        }

        // Execute queries with error handling
        let totalCases, cases;
        try {
            [cases, totalCases] = await Promise.all([
                queryBuilder.skip(offset).take(limit).getMany(),
                queryBuilder.getCount()
            ]);
        } catch (dbError) {
            logger.error('Database query error in findDepartmentCases:', dbError);
            throw new Error('Failed to retrieve department cases from database');
        }

        const totalPages = Math.ceil(totalCases / limit);

        const result = {
            success: true,
            data: {
                cases,
                currentPage: parseInt(page),
                totalPages,
                totalCases,
                limit
            }
        };

        logger.info(`Found ${cases.length} department cases for dept: ${filters.department}, branch: ${filters.branch_code} (page ${page})`);
        return result;

    } catch (error) {
        logger.error(`Error in findDepartmentCases:`, error);
        throw error;
    }
};

/**
 * Xử lý import hồ sơ nợ từ file Excel, tổng hợp dư nợ theo mã khách hàng
 * @param {Buffer} fileBuffer - Nội dung file Excel từ multer
 */
exports.importExternalCasesFromExcel = async (fileBuffer) => {
    try {
        // Validate input buffer
        if (!fileBuffer || fileBuffer.length === 0) {
            throw new Error('File buffer rỗng hoặc không hợp lệ');
        }

        // Check if buffer has Excel file signature
        const excelSignatures = [
            Buffer.from([0xD0, 0xCF, 0x11, 0xE0]), // .xls signature (OLE2)
            Buffer.from([0x50, 0x4B, 0x03, 0x04]), // .xlsx signature (ZIP)
            Buffer.from([0x50, 0x4B, 0x07, 0x08]), // Alternative .xlsx signature
        ];

        const hasValidSignature = excelSignatures.some(signature => 
            fileBuffer.subarray(0, signature.length).equals(signature)
        );

        if (!hasValidSignature) {
            throw new Error('File không phải là file Excel hợp lệ. Vui lòng kiểm tra lại định dạng file.');
        }

        const caseRepository = AppDataSource.getRepository("DebtCase");

        // 1. Đọc dữ liệu từ file Excel with enhanced error handling
        let workbook, sheetName, worksheet, data;
        
        try {
            workbook = xlsx.read(fileBuffer, { type: 'buffer' });
        } catch (error) {
            logger.error('Failed to parse external Excel file:', error);
            throw new Error('Không thể đọc file Excel. Vui lòng kiểm tra định dạng file và thử lại.');
        }

        if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
            throw new Error('File Excel không chứa sheet nào hoặc file bị lỗi.');
        }

        sheetName = workbook.SheetNames[0];
        worksheet = workbook.Sheets[sheetName];

        if (!worksheet) {
            throw new Error('Sheet đầu tiên trong file Excel bị lỗi hoặc rỗng.');
        }

        try {
            data = xlsx.utils.sheet_to_json(worksheet);
        } catch (error) {
            logger.error('Failed to convert sheet to JSON:', error);
            throw new Error('Không thể đọc dữ liệu từ file Excel. Vui lòng kiểm tra cấu trúc file.');
        }

        if (!Array.isArray(data) || data.length === 0) {
            throw new Error('File Excel không chứa dữ liệu hoặc định dạng không đúng.');
        }

        // const allowedDebtGroups = [3, 4, 5];
        const customerDebtMap = new Map();

    // 2. Lọc và tổng hợp dữ liệu vào Map
    for (const row of data) {
        const customerCode = row.makh;
        const outstandingDebt = Number(row.Ngoaibang);
        const employeeCode = row.cbtd; // **THAY ĐỔI Ở ĐÂY: Dùng cột 'ofcno'**
        const customerName = row.TenKhachHang;

        if (!customerCode) {
            continue;
        }

        if (customerDebtMap.has(customerCode)) {
            const currentData = customerDebtMap.get(customerCode);
            currentData.outstanding_debt += outstandingDebt;
            // Cập nhật CBTD nếu cần, hoặc giữ người đầu tiên tìm thấy
            customerDebtMap.set(customerCode, currentData);
        } else {
            customerDebtMap.set(customerCode, {
                customer_code: customerCode,
                customer_name: customerName,
                outstanding_debt: outstandingDebt,
                assigned_employee_code: employeeCode,
                case_type: "external", // **THAY ĐỔI Ở ĐÂY**
            });
        }
    }

    // 3. Chuyển Map thành mảng để xử lý
    const aggregatedData = Array.from(customerDebtMap.values());

    let createdCount = 0;
    let updatedCount = 0;
    const errors = [];

    // 4. Lặp qua dữ liệu đã tổng hợp và cập nhật CSDL
    for (const customer of aggregatedData) {
        try {
            if (
                !customer.customer_code ||
                !customer.customer_name ||
                !customer.assigned_employee_code
            ) {
                errors.push(
                    `Khách hàng với mã ${customer.customer_code} bị thiếu thông tin Tên hoặc CBTD.`
                );
                continue;
            }

            let existingCase = await caseRepository.findOneBy({
                customer_code: customer.customer_code,
                case_type: "external", // **THAY ĐỔI Ở ĐÂY**
            });

            if (existingCase) {
                existingCase.outstanding_debt = customer.outstanding_debt;
                existingCase.assigned_employee_code =
                    customer.assigned_employee_code;
                await caseRepository.save(existingCase);
                updatedCount++;
            } else {
                const newCase = caseRepository.create(customer);
                await caseRepository.save(newCase);
                createdCount++;
            }
        } catch (error) {
            errors.push(
                `Lỗi xử lý khách hàng ${customer.customer_code}: ${error.message}`
            );
        }
        }

        // 5. Trả về kết quả
        return {
            totalRowsInFile: data.length,
            processedCustomers: aggregatedData.length,
            created: createdCount,
            updated: updatedCount,
            errors: errors,
        };

    } catch (error) {
        logger.error('Fatal error in importExternalCasesFromExcel:', error);
        throw error;
    }
};

exports.getCaseById = async (caseId) => {
    const caseRepository = AppDataSource.getRepository("DebtCase");
    const debtCase = await caseRepository.findOne({
        where: { case_id: caseId },
        relations: ['officer'] // Include thông tin người phụ trách
    });
    return debtCase;
};

/**
 * NEW: Lấy thông tin tổng hợp của case (bao gồm details, updates, và documents)
 * @param {string} caseId - ID của case
 * @param {number} limit - Số lượng updates tối đa (mặc định 10)
 */
exports.getCaseOverview = async (caseId, limit = 10) => {
    const caseRepository = AppDataSource.getRepository("DebtCase");
    const caseUpdateRepository = AppDataSource.getRepository("CaseUpdate");
    const caseDocumentRepository = AppDataSource.getRepository("CaseDocument");

    // Fetch case details
    const caseDetail = await caseRepository.findOne({
        where: { case_id: caseId },
        relations: ['officer']
    });

    if (!caseDetail) {
        throw new Error("Hồ sơ không tìm thấy.");
    }

    // Fetch recent updates (limited)
    const recentUpdates = await caseUpdateRepository.find({
        where: { case_id: caseId },
        relations: ['officer'],
        order: { created_date: 'DESC' },
        take: limit
    });

    // Fetch all documents with uploader info
    const documents = await caseDocumentRepository.find({
        where: { case_id: caseId },
        relations: ['uploader'],
        order: { upload_date: 'DESC' }
    });

    // Get total update count for pagination info
    const totalUpdates = await caseUpdateRepository.count({
        where: { case_id: caseId }
    });

    return {
        caseDetail,
        recentUpdates,
        documents,
        updatesPagination: {
            total: totalUpdates,
            loaded: recentUpdates.length,
            hasMore: totalUpdates > limit
        }
    };
};

/**
 * MỚI: Lấy danh sách cập nhật của hồ sơ với phân trang
 * @param {string} caseId - ID của hồ sơ
 * @param {number} page - Trang hiện tại (mặc định: 1)
 * @param {number} limit - Số lượng bản ghi trên trang (mặc định: 5)
 */
exports.getCaseUpdates = async (caseId, page = 1, limit = 5) => {
    const caseUpdateRepository = AppDataSource.getRepository("CaseUpdate");
    
    // Tính offset
    const offset = (page - 1) * limit;
    
    // Lấy tổng số bản ghi
    const total = await caseUpdateRepository.count({
        where: { case_id: caseId }
    });
    
    // Lấy dữ liệu với phân trang
    const updates = await caseUpdateRepository.find({
        where: { case_id: caseId },
        relations: ['officer'], // Load thông tin officer thay vì author
        order: { created_date: 'DESC' }, // Sắp xếp theo ngày tạo mới nhất
        skip: offset,
        take: limit
    });
    
    // Tính toán thông tin phân trang
    const totalPages = Math.ceil(total / limit);
    const hasMore = page < totalPages;
    
    return {
        updates,
        pagination: {
            currentPage: page,
            totalPages,
            total,
            limit,
            hasMore
        }
    };
};

/**
 * MỚI: Thêm một cập nhật (ghi chú) vào hồ sơ
 * @param {string} caseId - ID của hồ sơ cần cập nhật
 * @param {string} content - Nội dung cập nhật
 * @param {object} uploader - Thông tin người dùng đang thực hiện cập nhật
 */
exports.addCaseUpdate = async (caseId, content, uploader) => {
    const caseUpdateRepository = AppDataSource.getRepository("CaseUpdate");
    const caseRepository = AppDataSource.getRepository("DebtCase");

    // 1. Kiểm tra xem hồ sơ có tồn tại không
    const debtCase = await caseRepository.findOneBy({ case_id: caseId });
    if (!debtCase) {
        throw new Error("Không tìm thấy hồ sơ.");
    }

    // (Tùy chọn nghiệp vụ) Kiểm tra xem người cập nhật có phải là người được phân công không
    // if (debtCase.assigned_employee_code !== uploader.employee_code) {
    //     throw new Error("Bạn không được phân công xử lý hồ sơ này.");
    // }

    // 2. Tạo bản ghi cập nhật mới
    const newUpdateData = {
        case_id: caseId,
        update_content: content,
        created_by_employee_code: uploader.employee_code,
    };

    const update = caseUpdateRepository.create(newUpdateData);
    await caseUpdateRepository.save(update);

    // 3. (Quan trọng) Cập nhật lại ngày last_modified_date của hồ sơ chính
    await caseRepository.update(caseId, { last_modified_date: new Date() });

    return update;
};

/**
 * MỚI: Cập nhật trạng thái hồ sơ
 * @param {string} caseId - ID của hồ sơ cần cập nhật
 * @param {string} status - Trạng thái mới
 * @param {object} updater - Thông tin người dùng đang thực hiện cập nhật
 */
exports.updateCaseStatus = async (caseId, status, updater) => {
    const caseRepository = AppDataSource.getRepository("DebtCase");
    const caseUpdateRepository = AppDataSource.getRepository("CaseUpdate");

    // 1. Kiểm tra xem hồ sơ có tồn tại không
    const debtCase = await caseRepository.findOneBy({ case_id: caseId });
    if (!debtCase) {
        throw new Error("Không tìm thấy hồ sơ.");
    }

    // 2. Kiểm tra xem trạng thái có thay đổi không
    if (debtCase.state === status) {
        throw new Error("Trạng thái mới giống với trạng thái hiện tại.");
    }

    // map trạng thái sang tiếng Việt
    const statusMap = {
        'beingFollowedUp': 'Đang đôn đốc',
        'beingSued': 'Đang khởi kiện',
        'awaitingJudgmentEffect': 'Chờ hiệu lực án',
        'beingExecuted': 'Đang thi hành án',
        'proactivelySettled': 'Chủ động XLTS',
        'debtSold': 'Bán nợ',
        'amcHired': 'Thuê AMC XLN'
    }

    // 3. Kiểm tra trạng thái hợp lệ
    if (!Object.keys(statusMap).includes(status)) {
        throw new Error("Trạng thái không hợp lệ.");
    }

    await caseRepository.update(caseId, { 
        state: status,
        last_modified_date: new Date() 
    });
    status = statusMap[status];
    const oldStatus = statusMap[debtCase.state] || debtCase.state;
    // 4. Tạo log cập nhật trạng thái
    const updateContent = `Cập nhật trạng thái từ "${oldStatus}" sang "${status}"`;
    const updateData = {
        case_id: caseId,
        update_content: updateContent,
        created_by_employee_code: updater.employee_code,
    };

    const update = caseUpdateRepository.create(updateData);
    await caseUpdateRepository.save(update);

    // 5. Lấy lại thông tin hồ sơ đã cập nhật
    const updatedCase = await caseRepository.findOneBy({ case_id: caseId });
    
    return updatedCase;
};

exports.getUpdateContentByCase = async (caseId) => {
    const caseUpdateRepository = AppDataSource.getRepository("CaseUpdate");
    const contents = await caseUpdateRepository.find({
        where: {
            case_id: caseId,
        },
        order: {
            created_date: "DESC",
        },
    });

    return contents;
};

exports.addDocumentToCase = async (caseId, fileInfo, uploader, documentType = 'other') => {
    const caseDocumentRepository = AppDataSource.getRepository("CaseDocument");
    const caseUpdateRepository = AppDataSource.getRepository("CaseUpdate");
    const caseRepository = AppDataSource.getRepository("DebtCase");

    // 1. Kiểm tra xem hồ sơ có tồn tại không
    const debtCase = await caseRepository.findOneBy({ case_id: caseId });
    if (!debtCase) {
        throw new Error("Không tìm thấy hồ sơ.");
    }

    // Decode tên file để xử lý tiếng Việt đúng cách
    const decodeFilename = (filename) => {
        try {
            // Thử decode URIComponent nếu có
            return decodeURIComponent(filename);
        } catch (e) {
            // Nếu không decode được, thử với Buffer
            try {
                return Buffer.from(filename, 'latin1').toString('utf8');
            } catch (e2) {
                // Nếu vẫn không được, giữ nguyên
                return filename;
            }
        }
    };

    const newDocumentData = {
        case_id: caseId,
        original_filename: decodeFilename(fileInfo.originalname),
        file_path: getRelativeFilePath(fileInfo.path), // Lưu relative path thay vì absolute path
        mime_type: fileInfo.mimetype,
        file_size: fileInfo.size,
        document_type: documentType, // Sử dụng document_type được truyền vào
        uploaded_by_employee_code: uploader.employee_code,
    };

    const document = caseDocumentRepository.create(newDocumentData);
    await caseDocumentRepository.save(document);

    // Log thông tin file đã lưu
    console.log('Document saved with structured path:', {
        originalName: fileInfo.originalname,
        relativePath: getRelativeFilePath(fileInfo.path),
        absolutePath: fileInfo.path,
        documentType: documentType,
        caseId: caseId
    });

    // 2. Tạo log cập nhật cho việc upload file
    const getTypeName = (type) => {
        switch (type) {
            case 'enforcement': return 'Thi hành án';
            case 'court': return 'Tòa án';
            case 'notification': return 'Bán nợ';
            case 'proactive': return 'Chủ động xử lý tài sản';
            case 'collateral': return 'Tài sản đảm bảo';
            case 'processed_collateral': return 'Tài sản đã xử lý';
            case 'other': return 'Tài liệu khác';
            default: return 'Không xác định';
        }
    };

    const fileSizeKB = Math.round(fileInfo.size / 1024);
    const updateContent = `Đã tải lên tài liệu "${fileInfo.originalname}" (${getTypeName(documentType)}, ${fileSizeKB} KB)`;
    
    const updateData = {
        case_id: caseId,
        update_content: updateContent,
        created_by_employee_code: uploader.employee_code,
    };

    const update = caseUpdateRepository.create(updateData);
    await caseUpdateRepository.save(update);

    // 3. Cập nhật lại ngày last_modified_date của hồ sơ chính
    await caseRepository.update(caseId, { last_modified_date: new Date() });

    return document;
};

/**
 * Lấy danh sách tài liệu đã tải lên cho một case
 * @param {string} caseId - ID của case cần lấy danh sách tài liệu
 */
exports.getDocumentsByCase = async (caseId) => {
    console.log('getDocumentsByCase called with caseId:', caseId);
    const caseDocumentRepository = AppDataSource.getRepository("CaseDocument");
    
    const documents = await caseDocumentRepository.find({
        where: {
            case_id: caseId,
        },
        relations: ['uploader'], // Include uploader relationship
        order: {
            upload_date: "DESC", // Sắp xếp theo ngày tải lên mới nhất
        },
    });

    console.log('Found documents:', documents.length);
    return documents;
};

/**
 * Lấy thông tin chi tiết của một tài liệu theo ID
 * @param {string} documentId - ID của tài liệu cần lấy thông tin
 */
exports.getDocumentById = async (documentId) => {
    const caseDocumentRepository = AppDataSource.getRepository("CaseDocument");
    
    const document = await caseDocumentRepository.findOne({ 
        where: { document_id: documentId },
        relations: ['uploader'], // Include uploader relationship
    });

    return document;
};

/**
 * Xóa tài liệu theo ID
 * @param {string} documentId - ID của tài liệu cần xóa
 * @param {object} deleter - Thông tin người dùng đang thực hiện xóa
 */
exports.deleteDocumentById = async (documentId, deleter) => {
    const caseDocumentRepository = AppDataSource.getRepository("CaseDocument");
    const caseUpdateRepository = AppDataSource.getRepository("CaseUpdate");
    const caseRepository = AppDataSource.getRepository("DebtCase");
    const fs = require('fs');
    
    // Lấy thông tin tài liệu trước khi xóa
    const document = await caseDocumentRepository.findOneBy({ 
        document_id: documentId 
    });

    if (!document) {
        throw new Error("Không tìm thấy tài liệu.");
    }

    // Lấy thông tin case để tạo log
    const caseId = document.case_id;

    // Xóa file vật lý nếu tồn tại
    const absolutePath = getAbsoluteFilePath(document.file_path);
    if (fs.existsSync(absolutePath)) {
        try {
            fs.unlinkSync(absolutePath);
            console.log('File deleted from:', absolutePath);
        } catch (fileError) {
            console.error('Lỗi khi xóa file vật lý:', fileError);
            // Không throw error ở đây để vẫn có thể xóa record trong DB
        }
    } else {
        console.log('File not found for deletion:', absolutePath);
    }

    // Xóa record trong database
    const result = await caseDocumentRepository.delete({ document_id: documentId });
    
    if (result.affected === 0) {
        throw new Error("Không thể xóa tài liệu.");
    }

    // Tạo log cập nhật cho việc xóa file
    const getTypeName = (type) => {
        switch (type) {
            case 'enforcement': return 'Thi hành án';
            case 'court': return 'Tòa án';
            case 'notification': return 'Báo nợ';
            case 'proactive': return 'Chủ động XLN';
            case 'collateral': return 'Tài sản đảm bảo';
            case 'processed_collateral': return 'TS đã xử lý';
            case 'other': return 'Tài liệu khác';
            default: return 'Không xác định';
        }
    };

    const fileSizeKB = Math.round(document.file_size / 1024);
    const updateContent = `Đã xóa tài liệu "${document.original_filename}" (${getTypeName(document.document_type)}, ${fileSizeKB} KB)`;
    
    const updateData = {
        case_id: caseId,
        update_content: updateContent,
        created_by_employee_code: deleter.employee_code,
    };

    const update = caseUpdateRepository.create(updateData);
    await caseUpdateRepository.save(update);

    // Cập nhật lại ngày last_modified_date của hồ sơ chính
    await caseRepository.update(caseId, { last_modified_date: new Date() });

    return result;
};
