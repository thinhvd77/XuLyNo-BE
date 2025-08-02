const { validationResult } = require("express-validator");
const userService = require("../services/user.service");
const logger = require("../config/logger");
const {
    asyncHandler,
    ValidationError,
    NotFoundError
} = require("../middleware/errorHandler");

exports.createUser = asyncHandler(async (req, res) => {
    try {
        // 1. Kiểm tra kết quả validation
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            throw new ValidationError("Dữ liệu không hợp lệ", errors.array());
        }

        if (!req.body) {
            throw new ValidationError("Request body is required");
        }

        // 2. Gọi service để tạo user
        const newUser = await userService.createUser(req.body);

        if (!newUser) {
            throw new Error("Failed to create user");
        }

        logger.info(`User created successfully by ${req.user?.employee_code}: ${newUser.employee_code}`);

        res.status(201).json({
            success: true,
            message: "Tạo người dùng thành công!",
            user: newUser,
        });
    } catch (error) {
        logger.error("Error in createUser:", error);
        throw error;
    }
});

exports.getAllUsers = asyncHandler(async (req, res) => {
    try {
        if (!req.user || !req.user.employee_code) {
            throw new ValidationError("User authentication required");
        }

        // Extract filter parameters from query string with validation
        const filters = {
            dept: req.query.dept && typeof req.query.dept === 'string' ? req.query.dept : undefined,
            branch_code: req.query.branch_code && typeof req.query.branch_code === 'string' ? req.query.branch_code : undefined
        };

        // 1. Gọi service để lấy danh sách người dùng với filters
        const users = await userService.getAllUsers(req.user.employee_code, filters);

        if (!Array.isArray(users)) {
            throw new Error("Invalid response from user service");
        }

        logger.info(`Retrieved ${users.length} users for ${req.user.employee_code}`);

        res.status(200).json({
            success: true,
            users: users,
        });
    } catch (error) {
        logger.error("Error in getAllUsers:", error);
        throw error;
    }
});

exports.getUserById = asyncHandler(async (req, res) => {
    try {
        const { id } = req.params;

        if (!id) {
            throw new ValidationError("User ID is required");
        }

        // 1. Gọi service để lấy người dùng theo ID
        const user = await userService.getUserById(id);

        if (!user) {
            throw new NotFoundError("User not found");
        }

        logger.info(`User retrieved: ${id}`);

        res.status(200).json({
            success: true,
            user: user,
        });
    } catch (error) {
        logger.error(`Error in getUserById for ${req.params.id}:`, error);
        throw error;
    }
});

/**
 * Update user by ID
 */
exports.updateUser = asyncHandler(async (req, res) => {
    try {
        // 1. Kiểm tra kết quả validation
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            throw new ValidationError("Dữ liệu không hợp lệ", errors.array());
        }

        const { id } = req.params;

        if (!id) {
            throw new ValidationError("User ID is required");
        }

        if (!req.body || Object.keys(req.body).length === 0) {
            throw new ValidationError("Update data is required");
        }

        // 2. Gọi service để cập nhật user
        const updatedUser = await userService.updateUser(id, req.body);

        if (!updatedUser) {
            throw new NotFoundError("User not found or update failed");
        }

        logger.info(`User updated successfully by ${req.user?.employee_code}: ${id}`);

        res.status(200).json({
            success: true,
            message: "Cập nhật người dùng thành công!",
            user: updatedUser,
        });
    } catch (error) {
        logger.error(`Error in updateUser for ${req.params.id}:`, error);
        throw error;
    }
});

/**
 * Toggle user status (enable/disable)
 */
exports.toggleUserStatus = asyncHandler(async (req, res) => {
    const { id } = req.params;

    try {
        // Gọi service để toggle user status
        const updatedUser = await userService.toggleUserStatus(id);
        res.status(200).json({
            success: true,
            message: `Đã ${updatedUser.status === 'active' ? 'kích hoạt' : 'vô hiệu hóa'} người dùng thành công!`,
            user: updatedUser,
        });
    } catch (error) {
        // Xử lý lỗi (ví dụ: user không tồn tại)
        if (error.message.includes('không tìm thấy')) {
            res.status(404).json({ success: false, message: error.message });
        } else {
            res.status(500).json({ success: false, message: error.message });
        }
    }
});

/**
 * Change user password
 */
exports.changeUserPassword = asyncHandler(async (req, res) => {
    // 1. Kiểm tra kết quả validation
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ 
            success: false,
            message: "Dữ liệu không hợp lệ.",
            errors: errors.array() 
        });
    }

    const { id } = req.params;
    const { newPassword } = req.body;

    try {
        // 2. Gọi service để đổi mật khẩu
        const updatedUser = await userService.changeUserPassword(id, newPassword);
        res.status(200).json({
            success: true,
            message: "Đổi mật khẩu thành công!",
            user: updatedUser,
        });
    } catch (error) {
        // 3. Xử lý lỗi (ví dụ: user không tồn tại)
        if (error.message.includes('không tìm thấy')) {
            res.status(404).json({ success: false, message: error.message });
        } else {
            res.status(500).json({ success: false, message: error.message });
        }
    }
});

/**
 * MỚI: Lấy danh sách nhân viên thuộc quyền quản lý
 */
exports.getManagedOfficers = asyncHandler(async (req, res) => {
    try {
        // req.user chứa thông tin của Trưởng/Phó phòng đang đăng nhập
        const manager = req.user;
        const officers = await userService.findOfficersByManager(manager);
        res.status(200).json(officers);
    } catch (error) {
        console.error("Lỗi khi lấy danh sách nhân viên:", error);
        res.status(500).json({ success: false, message: "Đã có lỗi xảy ra trên server." });
    }
});

/**
 * MỚI: Lấy danh sách tất cả nhân viên để sử dụng cho filter dropdown
 */
exports.getEmployeesForFilter = asyncHandler(async (req, res) => {
    try {
        if (!req.user || !req.user.branch_code) {
            throw new ValidationError("User branch information not available");
        }

        // Extract director's branch code from authenticated user
        const directorBranchCode = req.user.branch_code;

        logger.info("Fetching employees for filter with branch-based access control", {
            director: req.user.employee_code,
            directorBranch: directorBranchCode
        });

        const employees = await userService.getEmployeesForFilter(directorBranchCode);

        if (!Array.isArray(employees)) {
            throw new Error("Invalid response from user service");
        }

        // Log the filtering result for audit purposes
        logger.info(`Employee filter applied successfully`, {
            director: req.user.employee_code,
            directorBranch: directorBranchCode,
            employeesReturned: employees.length,
            isUnrestricted: directorBranchCode === '6421'
        });

        res.status(200).json({
            success: true,
            employees: employees,
            metadata: {
                totalEmployees: employees.length,
                branchFilter: directorBranchCode !== '6421' ? directorBranchCode : null,
                isUnrestricted: directorBranchCode === '6421'
            }
        });
    } catch (error) {
        logger.error("Error in getEmployeesForFilter:", {
            error: error.message,
            user: req.user?.employee_code,
            branch: req.user?.branch_code
        });
        throw error;
    }
});

/**
 * API để lấy danh sách chi nhánh (branch) để hiển thị trong dropdown filter
 */
exports.getBranchesForFilter = asyncHandler(async (req, res) => {
    try {
        const branches = await userService.getBranchesForFilter();
        res.status(200).json({
            success: true,
            branches: branches
        });
    } catch (error) {
        console.error("Lỗi khi lấy danh sách chi nhánh cho filter:", error);
        res.status(500).json({ success: false, message: "Đã có lỗi xảy ra trên server." });
    }
});

exports.deleteUserById = asyncHandler(async (req, res) => {
    const { id } = req.params;

    try {
        // 1. Gọi service để xóa người dùng theo ID
        const result = await userService.deleteUserById(id);
        res.status(200).json(result);
    } catch (error) {
        // 2. Xử lý lỗi nếu người dùng không tồn tại hoặc không thể xóa
        res.status(404).json({ success: false, message: error.message });
    }
});
