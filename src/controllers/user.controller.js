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
