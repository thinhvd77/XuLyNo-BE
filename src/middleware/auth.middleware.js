const passport = require('passport');
const logger = require('../config/logger');
const { AuthenticationError, AuthorizationError } = require('./errorHandler');

// Middleware để xác thực token JWT với error handling
exports.protect = (req, res, next) => {
    passport.authenticate('jwt', { session: false }, (err, user, info) => {
        try {
            if (err) {
                logger.error('Passport authentication error:', err);
                return next(new AuthenticationError('Authentication failed'));
            }

            if (!user) {
                logger.warn('Authentication failed - no user found:', {
                    url: req.originalUrl,
                    method: req.method,
                    ip: req.ip,
                    info: info?.message
                });
                return next(new AuthenticationError('Invalid or expired token'));
            }

            // Additional user validation
            if (!user.employee_code || !user.role) {
                logger.error('Invalid user object from JWT:', user);
                return next(new AuthenticationError('Invalid user credentials'));
            }

            req.user = user;
            logger.debug(`User authenticated: ${user.employee_code}`);
            next();
        } catch (error) {
            logger.error('Error in protect middleware:', error);
            next(new AuthenticationError('Authentication processing failed'));
        }
    })(req, res, next);
};

// Middleware để kiểm tra vai trò người dùng với enhanced error handling
exports.authorize = (...roles) => {
    return (req, res, next) => {
        try {
            if (!req.user) {
                logger.error('Authorization check failed - no user in request');
                return next(new AuthenticationError('User authentication required'));
            }

            if (!req.user.role) {
                logger.error('Authorization check failed - no role in user object:', req.user);
                return next(new AuthenticationError('User role not found'));
            }

            if (!Array.isArray(roles) || roles.length === 0) {
                logger.error('Authorization middleware misconfigured - no roles specified');
                return next(new Error('Authorization configuration error'));
            }

            if (!roles.includes(req.user.role)) {
                logger.warn('Authorization denied:', {
                    user: req.user.employee_code,
                    userRole: req.user.role,
                    requiredRoles: roles,
                    url: req.originalUrl,
                    method: req.method
                });
                return next(new AuthorizationError('Bạn không có quyền truy cập chức năng này.'));
            }

            logger.debug(`Authorization granted for ${req.user.employee_code} with role ${req.user.role}`);
            next();
        } catch (error) {
            logger.error('Error in authorize middleware:', error);
            next(new AuthorizationError('Authorization processing failed'));
        }
    };
};