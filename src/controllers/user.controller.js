const { validationResult } = require("express-validator");
const userService = require("../services/user.service");

exports.createUser = async (req, res) => {
    // 1. Kiểm tra kết quả validation
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    try {
        // 2. Gọi service để tạo user
        const newUser = await userService.createUser(req.body);
        res.status(201).json({
            success: true,
            message: "Tạo người dùng thành công!",
            user: newUser,
        });
    } catch (error) {
        // 3. Xử lý lỗi (ví dụ: username đã tồn tại)
        res.status(409).json({ success: false, message: error.message });
    }
};

exports.getAllUsers = async (req, res) => {
    try {
        // 1. Gọi service để lấy danh sách người dùng
        const users = await userService.getAllUsers(req.user.employee_code);
        res.status(200).json({
            success: true,
            users: users,
        });
    } catch (error) {
        // 2. Xử lý lỗi nếu có
        res.status(500).json({ success: false, message: error.message });
    }
}

exports.getUserById = async (req, res) => {
    const { id } = req.params;

    try {
        // 1. Gọi service để lấy người dùng theo ID
        const user = await userService.getUserById(id);
        res.status(200).json({
            success: true,
            user: user,
        });
    } catch (error) {
        // 2. Xử lý lỗi nếu người dùng không tồn tại
        res.status(404).json({ success: false, message: error.message });
    }
}

/**
 * Update user by ID
 */
exports.updateUser = async (req, res) => {
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

    try {
        // 2. Gọi service để cập nhật user
        const updatedUser = await userService.updateUser(id, req.body);
        res.status(200).json({
            success: true,
            message: "Cập nhật người dùng thành công!",
            user: updatedUser,
        });
    } catch (error) {
        // 3. Xử lý lỗi (ví dụ: user không tồn tại, username đã tồn tại)
        if (error.message.includes('không tìm thấy')) {
            res.status(404).json({ success: false, message: error.message });
        } else if (error.message.includes('đã tồn tại')) {
            res.status(409).json({ success: false, message: error.message });
        } else {
            res.status(500).json({ success: false, message: error.message });
        }
    }
};

/**
 * Toggle user status (enable/disable)
 */
exports.toggleUserStatus = async (req, res) => {
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
};

/**
 * MỚI: Lấy danh sách nhân viên thuộc quyền quản lý
 */
exports.getManagedOfficers = async (req, res) => {
    try {
        // req.user chứa thông tin của Trưởng/Phó phòng đang đăng nhập
        const manager = req.user;
        const officers = await userService.findOfficersByManager(manager);
        res.status(200).json(officers);
    } catch (error) {
        console.error("Lỗi khi lấy danh sách nhân viên:", error);
        res.status(500).json({ success: false, message: "Đã có lỗi xảy ra trên server." });
    }
};

exports.deleteUserById = async (req, res) => {
    const { id } = req.params;

    try {
        // 1. Gọi service để xóa người dùng theo ID
        const result = await userService.deleteUserById(id);
        res.status(200).json(result);
    } catch (error) {
        // 2. Xử lý lỗi nếu người dùng không tồn tại hoặc không thể xóa
        res.status(404).json({ success: false, message: error.message });
    }
}

exports.updateUserById = async (req, res) => {
    try {
        const id = req.params.id; 
        const dataUpdate = req.body; 
        const result = await userService.updateUserById(id, dataUpdate);
        res.status(200).json(result);
    } catch (error) {
        res.status(404).json({ success: false, message: error.message });
    }
}

exports.changePassword = async (req, res) => {
    try {
        const id = req.params.id; 
        const data = req.body; 
        const role = req.user.role
        const result = await userService.changePassword(id, data, role);
        res.status(200).json(result);
    } catch (error) {
        res.status(404).json({ success: false, message: error.message });
    }
}

