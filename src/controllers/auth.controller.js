const jwt = require("jsonwebtoken");

exports.login = (req, res) => {
    // Passport đã xác thực thành công và gắn `user` vào `req.user`
    const user = req.user;

    const payload = {
        sub: user.employee_code,
        username: user.username,
        role: user.role,
    };

    // Ký token
    const token = jwt.sign(payload, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_EXPIRES_IN || "1d",
    });

    res.status(200).json({
        success: true,
        access_token: token,
    });
};
