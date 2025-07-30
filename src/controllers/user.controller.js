const { validationResult } = require("express-validator");
const userService = require("../services/user.service");
const { createChildLogger } = require("../config/logger");
const { AppError, asyncHandler } = require("../middleware/errorHandler");

const logger = createChildLogger("user.controller");

exports.createUser = asyncHandler(async (req, res, next) => {
    // 1. Kiểm tra kết quả validation
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        logger.warn("User creation validation failed", { 
            errors: errors.array(),
            requestData: req.body?.username || 'unknown'
        });
        return next(new AppError("Dữ liệu không hợp lệ", 400, errors.array()));
    }

    try {
        // 2. Gọi service để tạo user
        const newUser = await userService.createUser(req.body);
        
        logger.info("User created successfully", {
            username: newUser.username,
            employee_code: newUser.employee_code,
            createdBy: req.user?.employee_code || 'system'
        });

        res.status(201).json({
            success: true,
            message: "Tạo người dùng thành công!",
            user: newUser,
        });
    } catch (error) {
        logger.error("User creation failed", {
            error: error.message,
            requestData: req.body?.username || 'unknown',
            createdBy: req.user?.employee_code || 'system'
        });
        // 3. Xử lý lỗi (ví dụ: username đã tồn tại)
        return next(new AppError(error.message, 409));
    }
});

exports.getAllUsers = asyncHandler(async (req, res, next) => {
    try {
        // 1. Gọi service để lấy danh sách người dùng
        const users = await userService.getAllUsers(req.user.employee_code);
        
        logger.info("Users retrieved successfully", {
            count: users.length,
            requestedBy: req.user.employee_code
        });

        res.status(200).json({
            success: true,
            users: users,
        });
    } catch (error) {
        logger.error("Failed to retrieve users", {
            error: error.message,
            requestedBy: req.user?.employee_code || 'unknown'
        });
        // 2. Xử lý lỗi nếu có
        return next(new AppError(error.message, 500));
    }
});

exports.getUserById = asyncHandler(async (req, res, next) => {
    const { id } = req.params;

    try {
        // 1. Gọi service để lấy người dùng theo ID
        const user = await userService.getUserById(id);
        
        logger.info("User retrieved by ID", {
            userId: id,
            username: user.username,
            requestedBy: req.user?.employee_code || 'unknown'
        });

        res.status(200).json({
            success: true,
            user: user,
        });
    } catch (error) {
        logger.error("Failed to retrieve user by ID", {
            userId: id,
            error: error.message,
            requestedBy: req.user?.employee_code || 'unknown'
        });
        // 2. Xử lý lỗi nếu người dùng không tồn tại
        return next(new AppError(error.message, 404));
    }
});

/**
 * Update user by ID
 */
exports.updateUser = asyncHandler(async (req, res, next) => {
    // 1. Kiểm tra kết quả validation
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        logger.warn("User update validation failed", { 
            userId: req.params.id,
            errors: errors.array(),
            updatedBy: req.user?.employee_code || 'unknown'
        });
        return next(new AppError("Dữ liệu không hợp lệ", 400, errors.array()));
    }

    const { id } = req.params;

    try {
        // 2. Gọi service để cập nhật user
        const updatedUser = await userService.updateUser(id, req.body);
        
        logger.info("User updated successfully", {
            userId: id,
            username: updatedUser.username,
            updatedBy: req.user?.employee_code || 'unknown'
        });

        res.status(200).json({
            success: true,
            message: "Cập nhật người dùng thành công!",
            user: updatedUser,
        });
    } catch (error) {
        logger.error("User update failed", {
            userId: id,
            error: error.message,
            updatedBy: req.user?.employee_code || 'unknown'
        });
        
        // 3. Xử lý lỗi (ví dụ: user không tồn tại, username đã tồn tại)
        if (error.message.includes('không tìm thấy')) {
            return next(new AppError(error.message, 404));
        } else if (error.message.includes('đã tồn tại')) {
            return next(new AppError(error.message, 409));
        } else {
            return next(new AppError(error.message, 500));
        }
    }
});

/**
 * Toggle user status (enable/disable)
 */
exports.toggleUserStatus = asyncHandler(async (req, res, next) => {
    const { id } = req.params;

    try {
        // Gọi service để toggle user status
        const updatedUser = await userService.toggleUserStatus(id);
        
        logger.info("User status toggled successfully", {
            userId: id,
            username: updatedUser.username,
            newStatus: updatedUser.status,
            updatedBy: req.user?.employee_code || 'unknown'
        });

        res.status(200).json({
            success: true,
            message: `Đã ${updatedUser.status === 'active' ? 'kích hoạt' : 'vô hiệu hóa'} người dùng thành công!`,
            user: updatedUser,
        });
    } catch (error) {
        logger.error("Failed to toggle user status", {
            userId: id,
            error: error.message,
            updatedBy: req.user?.employee_code || 'unknown'
        });

        // Xử lý lỗi (ví dụ: user không tồn tại)
        if (error.message.includes('không tìm thấy')) {
            return next(new AppError(error.message, 404));
        } else {
            return next(new AppError(error.message, 500));
        }
    }
});

/**
 * MỚI: Lấy danh sách nhân viên thuộc quyền quản lý
 */
exports.getManagedOfficers = asyncHandler(async (req, res, next) => {
    try {
        // req.user chứa thông tin của Trưởng/Phó phòng đang đăng nhập
        const manager = req.user;
        const officers = await userService.findOfficersByManager(manager);
        
        logger.info("Managed officers retrieved successfully", {
            managerCode: manager.employee_code,
            officersCount: officers.length
        });

        res.status(200).json(officers);
    } catch (error) {
        logger.error("Failed to retrieve managed officers", {
            managerCode: req.user?.employee_code || 'unknown',
            error: error.message
        });
        return next(new AppError("Đã có lỗi xảy ra trên server.", 500));
    }
});

exports.deleteUserById = asyncHandler(async (req, res, next) => {
    const { id } = req.params;

    try {
        // 1. Gọi service để xóa người dùng theo ID
        const result = await userService.deleteUserById(id);
        
        logger.info("User deleted successfully", {
            userId: id,
            deletedBy: req.user?.employee_code || 'unknown'
        });

        res.status(200).json(result);
    } catch (error) {
        logger.error("Failed to delete user", {
            userId: id,
            error: error.message,
            deletedBy: req.user?.employee_code || 'unknown'
        });
        // 2. Xử lý lỗi nếu người dùng không tồn tại hoặc không thể xóa
        return next(new AppError(error.message, 404));
    }
});