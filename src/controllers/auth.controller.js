const jwt = require("jsonwebtoken");
const { createChildLogger } = require("../config/logger");
const { AppError, asyncHandler } = require("../middleware/errorHandler");

const logger = createChildLogger("auth.controller");

exports.login = asyncHandler(async (req, res, next) => {
    try {
        // Passport đã xác thực thành công và gắn `user` vào `req.user`
        const user = req.user;

        if (!user) {
            return next(new AppError("Authentication failed", 401));
        }

        const payload = {
            sub: user.employee_code,
            dept: user.dept,
            fullname: user.fullname,
            role: user.role,
            branch_code: user.branch_code,
        };

        // Ký token
        const token = jwt.sign(payload, process.env.JWT_SECRET, {
            expiresIn: process.env.JWT_EXPIRES_IN || "1d",
        });

        logger.info("User login successful", {
            username: user.username,
            employee_code: user.employee_code,
            role: user.role
        });

        res.status(200).json({
            success: true,
            access_token: token,
        });
    } catch (error) {
        logger.error("Login process failed", {
            error: error.message,
            stack: error.stack,
            user: req.body?.username || 'unknown'
        });
        return next(new AppError("Login failed", 500));
    }
});
