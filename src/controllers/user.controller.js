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
            const errorMessages = errors.array().map(err => `${err.param}: ${err.msg}`).join(', ');
            logger.warn('Validation errors in createUser:', errorMessages);
            
            return res.status(400).json({
                success: false,
                message: "Dữ liệu không hợp lệ",
                errors: errors.array()
            });
        }

        if (!req.body || Object.keys(req.body).length === 0) {
            return res.status(400).json({
                success: false,
                message: "Dữ liệu yêu cầu không được để trống"
            });
        }

        logger.info('Creating user with data:', { 
            ...req.body, 
            password: '[HIDDEN]' 
        });

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
        logger.error("Error in createUser:", {
            error: error.message,
            stack: error.stack,
            requestBy: req.user?.employee_code,
            requestData: req.body ? { ...req.body, password: '[HIDDEN]' } : null
        });
        
        // Return specific error message to client
        res.status(error.message.includes('đã tồn tại') ? 409 : 500).json({
            success: false,
            message: error.message || "Đã có lỗi xảy ra khi tạo người dùng"
        });
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
    const { newPassword } = req.body; // Admin doesn't need oldPassword
    const currentUser = req.user; // From JWT middleware

    try {
        // Only admin can use this route
        const isAdmin = currentUser.role === 'administrator';
        
        if (!isAdmin) {
            return res.status(403).json({
                success: false,
                message: "Chỉ quản trị viên mới có quyền sử dụng chức năng này."
            });
        }

        // 2. Gọi service để đổi mật khẩu (admin không cần oldPassword)
        const updatedUser = await userService.changeUserPassword(id, newPassword, null, true);
        
        logger.info(`Password changed for user ${id} by admin ${currentUser.employee_code}`);
        
        res.status(200).json({
            success: true,
            message: "Đổi mật khẩu thành công!",
            user: updatedUser,
        });
    } catch (error) {
        logger.error(`Error changing password for user ${id}:`, error);
        
        // 3. Xử lý lỗi
        if (error.message.includes('không tìm thấy')) {
            res.status(404).json({ success: false, message: error.message });
        } else {
            res.status(500).json({ success: false, message: error.message });
        }
    }
});

// NEW: Route for users to change their own password
exports.changeMyPassword = asyncHandler(async (req, res) => {
    // 1. Kiểm tra kết quả validation
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ 
            success: false,
            message: "Dữ liệu không hợp lệ.",
            errors: errors.array() 
        });
    }

    const { newPassword, oldPassword } = req.body;
    const currentUser = req.user; // From JWT middleware

    try {
        // 2. Gọi service để đổi mật khẩu của chính mình
        const updatedUser = await userService.changeUserPassword(
            currentUser.employee_code, 
            newPassword, 
            oldPassword, 
            false // Not admin, so requires oldPassword verification
        );
        
        logger.info(`User ${currentUser.employee_code} changed their own password`);
        
        res.status(200).json({
            success: true,
            message: "Đổi mật khẩu thành công!",
            user: updatedUser,
        });
    } catch (error) {
        logger.error(`Error changing own password for user ${currentUser.employee_code}:`, error);
        
        // 3. Xử lý lỗi cụ thể
        if (error.message.includes('không đúng') || error.message.includes('sai')) {
            res.status(400).json({ success: false, message: error.message });
        } else if (error.message.includes('không tìm thấy')) {
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
        logger.error("Error in findOfficersByManager:", {
            error: error.message,
            manager: req.user?.employee_code
        });
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
        
        // Extract query parameters for filtering
        const { branchCode, departmentCode } = req.query;

        logger.info("Fetching employees for filter with branch-based access control", {
            director: req.user.employee_code,
            directorBranch: directorBranchCode,
            selectedBranch: branchCode,
            selectedDepartment: departmentCode
        });

        const employees = await userService.getEmployeesForFilter(
            directorBranchCode, 
            branchCode, 
            departmentCode
        );

        if (!Array.isArray(employees)) {
            throw new Error("Invalid response from user service");
        }

        // Log the filtering result for audit purposes
        logger.info(`Employee filter applied successfully`, {
            director: req.user.employee_code,
            directorBranch: directorBranchCode,
            selectedBranch: branchCode,
            selectedDepartment: departmentCode,
            employeesReturned: employees.length,
            isUnrestricted: directorBranchCode === '6421'
        });

        res.status(200).json({
            success: true,
            employees: employees,
            metadata: {
                totalEmployees: employees.length,
                branchFilter: branchCode || (directorBranchCode !== '6421' ? directorBranchCode : null),
                departmentFilter: departmentCode || null,
                isUnrestricted: directorBranchCode === '6421'
            }
        });
    } catch (error) {
        logger.error("Error in getEmployeesForFilter:", {
            error: error.message,
            user: req.user?.employee_code,
            branch: req.user?.branch_code,
            selectedBranch: req.query?.branchCode,
            selectedDepartment: req.query?.departmentCode
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
        logger.error("Error in getBranchesForFilter:", {
            error: error.message,
            user: req.user?.employee_code
        });
        res.status(500).json({ success: false, message: "Đã có lỗi xảy ra trên server." });
    }
});

/**
 * API để lấy danh sách phòng ban theo chi nhánh được chọn
 */
exports.getDepartmentsForFilter = asyncHandler(async (req, res) => {
    try {
        const { branchCode } = req.query;
        const departments = await userService.getDepartmentsForFilter(branchCode);
        res.status(200).json({
            success: true,
            departments: departments
        });
    } catch (error) {
        logger.error("Error in getDepartmentsForFilter:", {
            error: error.message,
            branchCode: req.query.branchCode,
            user: req.user?.employee_code
        });
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
