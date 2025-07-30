const express = require("express");
const router = express.Router();
const { body } = require("express-validator");
const authorize  = require("../middleware/auth.middleware").authorize;
const protect = require("../middleware/auth.middleware").protect;
const userController = require("../controllers/user.controller");

// Validation rules for creating a user
const createUserValidationRules = [
    body("employee_code").notEmpty().withMessage("Mã nhân viên là bắt buộc."),
    body("username")
        .isLength({ min: 4 })
        .withMessage("Tên đăng nhập phải có ít nhất 4 ký tự."),
    body("password")
        .isLength({ min: 6 })
        .withMessage("Mật khẩu phải có ít nhất 6 ký tự."),
    body("fullname").notEmpty().withMessage("Họ và tên là bắt buộc."),
    body("dept")
        .isIn(["KHCN", "KHDN", "KH", "KH&QLRR", "BGĐ", "IT"])
        .withMessage("Phòng ban không hợp lệ."),
    body("role")
        .isIn([
            "employee",
            "deputy_manager",
            "manager",
            "deputy_director",
            "director",
            "administrator",
        ])
        .withMessage("Vai trò không hợp lệ."),
];

// Định nghĩa route: POST /api/users/create
router.post(
    "/create",
    protect, // 1. Yêu cầu đăng nhập
    authorize("administrator"), // 2. Yêu cầu vai trò là Trưởng phòng hoặc Giám đốc
    createUserValidationRules, // 3. Kiểm tra dữ liệu đầu vào
    userController.createUser // 4. Xử lý logic
);

// Định nghĩa route: GET /api/users
router.get(
    "/",
    protect, // 1. Yêu cầu đăng nhập
    authorize("administrator", "director", "deputy_director"), // 2. Yêu cầu vai trò là Administrator, Giám đốc hoặc Phó giám đốc
    userController.getAllUsers // 3. Xử lý logic
);

// MỚI: Định nghĩa route để Trưởng/Phó phòng lấy danh sách nhân viên
// GET /api/users/managed-officers
router.get(
    "/managed",
    protect, // Yêu cầu đăng nhập
    authorize("manager", "deputy_manager"), // Chỉ Trưởng phòng và Phó phòng được truy cập
    userController.getManagedOfficers
);

// Định nghĩa route: GET /api/users/:id
router.get(
    "/:id",
    protect, // 1. Yêu cầu đăng nhập
    authorize("administrator", "director", "deputy_director"), // 2. Yêu cầu vai trò là Administrator, Giám đốc hoặc Phó giám đốc
    userController.getUserById // 3. Xử lý logic
);

router.delete(
    "/:id",
    protect, // 1. Yêu cầu đăng nhập
    authorize("administrator"), // 2. Yêu cầu vai trò là Administrator
    userController.deleteUserById // 3. Xử lý logic
);

router.patch(
    "/:id",
    protect, // 1. Yêu cầu đăng nhập
    authorize("administrator"), // 2. Yêu cầu vai trò là Administrator
    userController.updateUserById // 3. Xử lý logic
);

router.patch(
    "/:id/change-password",
    protect, // 1. Yêu cầu đăng nhập
    // authorize("administrator"),
    userController.changePassword // 3. Xử lý logic
);


module.exports = router;