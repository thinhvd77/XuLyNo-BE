const jwt = require("jsonwebtoken");
const logger = require("../config/logger");
const {
    asyncHandler,
    AuthenticationError,
    ValidationError
} = require("../middleware/errorHandler");

exports.login = asyncHandler(async (req, res) => {
    try {
        // Passport đã xác thực thành công và gắn `user` vào `req.user`
        const user = req.user;

        if (!user) {
            throw new AuthenticationError("User authentication failed");
        }

        if (!user.employee_code || !user.role) {
            logger.error('User object missing required fields:', user);
            throw new AuthenticationError("Invalid user data");
        }

        const payload = {
            sub: user.employee_code,
            dept: user.dept,
            fullname: user.fullname,
            role: user.role,
            branch_code: user.branch_code,
        };

        const jwtSecret = process.env.JWT_SECRET;
        if (!jwtSecret) {
            logger.error('JWT_SECRET environment variable not set');
            throw new Error('Server configuration error');
        }

        // Ký token with error handling
        let token;
        try {
            token = jwt.sign(payload, jwtSecret, {
                expiresIn: process.env.JWT_EXPIRES_IN || "1d",
            });
        } catch (jwtError) {
            logger.error('JWT signing error:', jwtError);
            throw new AuthenticationError("Failed to generate authentication token");
        }

        logger.info(`User logged in successfully: ${user.employee_code}`);

        res.status(200).json({
            success: true,
            access_token: token,
        });

    } catch (error) {
        logger.error('Login error:', error);
        throw error;
    }
});
