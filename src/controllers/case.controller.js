const caseService = require("../services/case.service");
const { validationResult } = require("express-validator");

/**
 * MỚI: Xử lý request upload file Excel
 */
exports.importCases = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: "Vui lòng tải lên một file Excel.",
            });
        }

        const result = await caseService.importCasesFromExcel(req.file.buffer);

        res.status(200).json({
            success: true,
            message: "Import hoàn tất!",
            data: result,
        });
    } catch (error) {
        console.error("Lỗi khi import file Excel:", error);
        res.status(500).json({
            success: false,
            message: "Đã có lỗi xảy ra trên server.",
        });
    }
};

exports.importExternalCases = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: "Vui lòng tải lên một file Excel.",
            });
        }

        const result = await caseService.importExternalCasesFromExcel(
            req.file.buffer
        );

        res.status(200).json({
            success: true,
            message: "Import hoàn tất!",
            data: result,
        });
    } catch (error) {
        console.error("Lỗi khi import file Excel:", error);
        res.status(500).json({
            success: false,
            message: "Đã có lỗi xảy ra trên server.",
        });
    }
};

/**
 * MỚI: Lấy danh sách hồ sơ của người dùng đang đăng nhập
 */
exports.getMyCases = async (req, res) => {
    try {
        // req.user được Passport.js thêm vào sau khi xác thực JWT thành công
        const employeeCode = req.user.employee_code;

        if (!employeeCode) {
            return res
                .status(400)
                .json({ message: "Không tìm thấy thông tin nhân viên." });
        }

        const cases = await caseService.findCasesByEmployeeCode(employeeCode);
        res.status(200).json(cases);
    } catch (error) {
        console.error("Lỗi khi lấy danh sách hồ sơ:", error);
        res.status(500).json({ message: "Đã có lỗi xảy ra trên server." });
    }
};

/**
 * MỚI: Lấy thông tin chi tiết của một hồ sơ theo ID
 * @param {string} req.params.caseId - ID của hồ sơ cần lấy thông tin
 */
exports.getCaseDetails = async (req, res) => {
    try {
        const caseId = req.params.caseId;
        if (!caseId) {
            return res.status(400).json({ message: "ID hồ sơ không hợp lệ." });
        }

        const debtCase = await caseService.getCaseById(caseId);
        if (!debtCase) {
            return res.status(404).json({ message: "Hồ sơ không tìm thấy." });
        }

        res.status(200).json(debtCase);
    } catch (error) {
        console.error("Lỗi khi lấy thông tin hồ sơ:", error);
        res.status(500).json({ message: "Đã có lỗi xảy ra trên server." });
    }
};

/**
 * MỚI: Tạo một cập nhật mới cho hồ sơ
 */
exports.createCaseUpdate = async (req, res) => {
    // Kiểm tra validation
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    try {
        const caseId = req.params.caseId;
        const { content } = req.body;
        const uploader = req.user; // Lấy thông tin từ token
        console.log(uploader);

        const newUpdate = await caseService.addCaseUpdate(
            caseId,
            content,
            uploader
        );

        res.status(201).json({
            success: true,
            message: "Cập nhật hồ sơ thành công!",
            data: newUpdate,
        });
    } catch (error) {
        // Trả về lỗi cụ thể hơn nếu có
        res.status(400).json({ success: false, message: error.message });
    }
};

exports.getCaseUpdateContent = async (req, res) => {
    try {
        const caseId = req.params.caseId;
        const contents = await caseService.getUpdateContentByCase(caseId);

        res.status(201).json({
            success: true,
            message: "Lấy nhật ký xử lý nợ thành công",
            data: contents,
        });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};
