const express = require("express");
const router = express.Router();
const passport = require("passport");
const authController = require("../controllers/auth.controller");

// URL: POST /api/auth/login
router.post("/login", (req, res, next) => {
    passport.authenticate("local", { session: false }, (err, user, info) => {
        // Xử lý các lỗi hệ thống (ví dụ: không kết nối được CSDL)
        if (err) {
            return next(err);
        }
        // Nếu xác thực thất bại (username sai, password sai)
        // `user` sẽ là `false`, và `info` sẽ chứa message chúng ta đã định nghĩa
        if (!user) {
            return res.status(401).json({
                success: false,
                message: info.message, // Trả về message chi tiết từ passport.js
            });
        }
        // Nếu xác thực thành công, `user` sẽ chứa thông tin người dùng
        // Gắn user vào request để controller có thể sử dụng
        req.user = user;
        // Chuyển tiếp đến controller để tạo token như bình thường
        authController.login(req, res);
    })(req, res, next);
});

module.exports = router;
