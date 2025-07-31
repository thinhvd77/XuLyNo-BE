const passport = require('passport');

// Middleware để xác thực token JWT
exports.protect = passport.authenticate('jwt', { session: false });

// Middleware để kiểm tra vai trò người dùng
exports.authorize = (...roles) => {
  return (req, res, next) => { 
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Bạn không có quyền truy cập chức năng này.',
      });
    }
    next();
  };
};