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
        const users = await userService.getAllUsers();
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