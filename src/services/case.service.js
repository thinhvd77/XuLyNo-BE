const AppDataSource = require("../config/dataSource");
const xlsx = require("xlsx");
const { Not } = require("typeorm");
const fs = require('fs');
const path = require('path');
const { getRelativeFilePath, getAbsoluteFilePath } = require('../utils/filePathHelper');

/**
 * Xử lý import hồ sơ nợ từ file Excel, tổng hợp dư nợ theo mã khách hàng
 * @param {Buffer} fileBuffer - Nội dung file Excel từ multer
 */
exports.importCasesFromExcel = async (fileBuffer) => {
    const caseRepository = AppDataSource.getRepository("DebtCase");

    // 1. Đọc dữ liệu từ file Excel
    const workbook = xlsx.read(fileBuffer);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = xlsx.utils.sheet_to_json(worksheet);

    const allowedDebtGroups = [3, 4, 5];
    const customerDebtMap = new Map();

    // 2. Lọc và tổng hợp dữ liệu vào Map
    for (const row of data) {
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
};

/**
 * MỚI: Tìm tất cả hồ sơ được phân công cho một nhân viên cụ thể
 */
exports.findCasesByEmployeeCode = async (employeeCode) => {
    const caseRepository = AppDataSource.getRepository("DebtCase");
    const cases = await caseRepository.find({
        where: {
            assigned_employee_code: employeeCode,
        },
        order: {
            last_modified_date: "DESC", // Sắp xếp theo ngày cập nhật mới nhất
        },
    });
    return cases;
};

/**
 * MỚI: Tìm tất cả hồ sơ với phân trang và bộ lọc (dành cho Ban Giám Đốc)
 */
exports.findAllCases = async (page = 1, filters = {}, limit = 20, sorting = {}) => {
    const caseRepository = AppDataSource.getRepository("DebtCase");
    const offset = (page - 1) * limit;

    // Tạo query builder
    let queryBuilder = caseRepository
        .createQueryBuilder("debt_cases")
        .leftJoinAndSelect("debt_cases.officer", "officer");

    // Áp dụng bộ lọc
    if (filters.search) {
        queryBuilder = queryBuilder.andWhere(
            "(debt_cases.customer_name ILIKE :search OR debt_cases.customer_code ILIKE :search)",
            { search: `%${filters.search}%` }
        );
    }

    if (filters.type) {
        queryBuilder = queryBuilder.andWhere("debt_cases.case_type = :type", { type: filters.type });
    }

    if (filters.status) {
        queryBuilder = queryBuilder.andWhere("debt_cases.state = :status", { status: filters.status });
    }

    // Branch-based filtering: BGĐ thuộc chi nhánh khác không phải 6421 chỉ xem cases thuộc branch đó
    if (filters.branch_code) {
        queryBuilder = queryBuilder.andWhere("officer.branch_code = :branch_code", { branch_code: filters.branch_code });
    }

    // Employee-based filtering: Filter by specific employee
    if (filters.employee_code) {
        queryBuilder = queryBuilder.andWhere("officer.employee_code = :employee_code", { employee_code: filters.employee_code });
    }

    // Áp dụng sorting
    if (sorting.sortBy && sorting.sortOrder) {
        let orderByField;
        let orderDirection = sorting.sortOrder.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
        
        // Map frontend field names to database column names
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

    // Đếm tổng số record
    const totalCases = await queryBuilder.getCount();
    const totalPages = Math.ceil(totalCases / limit);

    // Lấy dữ liệu với phân trang
    const cases = await queryBuilder
        .skip(offset)
        .take(limit)
        .getMany();

    return {
        success: true,
        data: {
            cases,
            currentPage: parseInt(page),
            totalPages,
            totalCases,
            limit
        }
    };
};

/**
 * Lấy danh sách hồ sơ theo phòng ban cho Manager/Deputy Manager
 * Hiển thị cases được quản lý bởi CBTD có cùng phòng ban và cùng branch_code
 */
exports.findDepartmentCases = async (page = 1, filters = {}, limit = 20, sorting = {}) => {
    const caseRepository = AppDataSource.getRepository("DebtCase");
    const offset = (page - 1) * limit;

    // Tạo query builder với join officer
    let queryBuilder = caseRepository
        .createQueryBuilder("debt_cases")
        .leftJoinAndSelect("debt_cases.officer", "officer");

    // Áp dụng bộ lọc cơ bản
    if (filters.search) {
        queryBuilder = queryBuilder.andWhere(
            "(debt_cases.customer_name ILIKE :search OR debt_cases.customer_code ILIKE :search)",
            { search: `%${filters.search}%` }
        );
    }

    if (filters.type) {
        queryBuilder = queryBuilder.andWhere("debt_cases.case_type = :type", { type: filters.type });
    }

    if (filters.status) {
        queryBuilder = queryBuilder.andWhere("debt_cases.state = :status", { status: filters.status });
    }

    // Department-based filtering: Chỉ hiển thị cases được quản lý bởi CBTD có cùng phòng ban và branch_code
    if (filters.department && filters.branch_code) {
        queryBuilder = queryBuilder.andWhere(
            "officer.dept = :department AND officer.branch_code = :branch_code", 
            { 
                department: filters.department,
                branch_code: filters.branch_code 
            }
        );
    }

    // Áp dụng sorting (tương tự như findAllCases)
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
        queryBuilder = queryBuilder.orderBy("debt_cases.last_modified_date", "DESC");
    }

    // Đếm tổng số record
    const totalCases = await queryBuilder.getCount();
    const totalPages = Math.ceil(totalCases / limit);

    // Lấy dữ liệu với phân trang
    const cases = await queryBuilder
        .skip(offset)
        .take(limit)
        .getMany();

    return {
        success: true,
        data: {
            cases,
            currentPage: parseInt(page),
            totalPages,
            totalCases,
            limit
        }
    };
};

/**
 * Xử lý import hồ sơ nợ từ file Excel, tổng hợp dư nợ theo mã khách hàng
 * @param {Buffer} fileBuffer - Nội dung file Excel từ multer
 */
exports.importExternalCasesFromExcel = async (fileBuffer) => {
    const caseRepository = AppDataSource.getRepository("DebtCase");

    // 1. Đọc dữ liệu từ file Excel
    const workbook = xlsx.read(fileBuffer);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = xlsx.utils.sheet_to_json(worksheet);

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
};

exports.getAllCases = async () => {
    const caseRepository = AppDataSource.getRepository("DebtCase");
    const cases = await caseRepository.find({
        order: {
            last_modified_date: "DESC", // Sắp xếp theo ngày cập nhật mới nhất
        },
    });
    return cases;
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
 * MỚI: Lấy danh sách cập nhật của hồ sơ
 * @param {string} caseId - ID của hồ sơ
 */
exports.getCaseUpdates = async (caseId) => {
    const caseUpdateRepository = AppDataSource.getRepository("CaseUpdate");
    
    const updates = await caseUpdateRepository.find({
        where: { case_id: caseId },
        relations: ['officer'], // Load thông tin officer thay vì author
        order: { created_date: 'DESC' } // Sắp xếp theo ngày tạo mới nhất
    });
    
    return updates;
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
