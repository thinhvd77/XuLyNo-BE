const AppDataSource = require("../config/dataSource");
const xlsx = require("xlsx");
const { Not } = require("typeorm");

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
        const outstandingDebt = Number(row.Ngoaibang.replace(/,/g, ""));
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
    const debtCase = await caseRepository.findOneBy({ case_id: caseId });
    return debtCase;
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

exports.getUpdateContentByCase = async (caseId) => {
    const caseUpdateRepository = AppDataSource.getRepository("CaseUpdate");
    const contents = await caseUpdateRepository.find({
        where: {
            case_id: caseId
        },
        order: {
            created_date: 'DESC'
        }
    });

    return contents;
}