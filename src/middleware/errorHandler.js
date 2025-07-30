const { createChildLogger } = require('../config/logger');

const errorLogger = createChildLogger('error-handler');

// Custom error class for application-specific errors
class AppError extends Error {
    constructor(message, statusCode, isOperational = true, stack = '') {
        super(message);
        this.statusCode = statusCode;
        this.isOperational = isOperational;

        if (stack) {
            this.stack = stack;
        } else {
            Error.captureStackTrace(this, this.constructor);
        }
    }
}

// Error handling middleware
const errorHandler = (err, req, res, next) => {
    let error = { ...err };
    error.message = err.message;

    // Log error details
    const errorContext = {
        url: req.originalUrl,
        method: req.method,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        user: req.user?.employee_code || 'anonymous',
        body: req.method !== 'GET' ? req.body : undefined,
        params: req.params,
        query: req.query
    };

    // Log based on error severity
    if (err.statusCode >= 500) {
        errorLogger.error('Server Error', {
            message: err.message,
            stack: err.stack,
            statusCode: err.statusCode,
            ...errorContext
        });
    } else {
        errorLogger.warn('Client Error', {
            message: err.message,
            statusCode: err.statusCode,
            ...errorContext
        });
    }

    // Handle different types of errors
    if (err.name === 'CastError') {
        const message = 'Resource not found';
        error = new AppError(message, 404);
    }

    if (err.code === 11000) {
        const message = 'Duplicate field value entered';
        error = new AppError(message, 400);
    }

    if (err.name === 'ValidationError') {
        const message = Object.values(err.errors).map(val => val.message);
        error = new AppError(message, 400);
    }

    if (err.name === 'JsonWebTokenError') {
        const message = 'Invalid token. Please log in again';
        error = new AppError(message, 401);
    }

    if (err.name === 'TokenExpiredError') {
        const message = 'Token expired. Please log in again';
        error = new AppError(message, 401);
    }

    // TypeORM specific errors
    if (err.name === 'QueryFailedError') {
        if (err.code === '23505') { // Unique constraint violation
            const message = 'Duplicate entry found';
            error = new AppError(message, 400);
        } else if (err.code === '23503') { // Foreign key constraint violation
            const message = 'Referenced resource not found';
            error = new AppError(message, 400);
        } else {
            const message = 'Database operation failed';
            error = new AppError(message, 500);
        }
    }

    // Multer errors
    if (err.code === 'LIMIT_FILE_SIZE') {
        const message = 'File too large';
        error = new AppError(message, 400);
    }

    if (err.code === 'LIMIT_UNEXPECTED_FILE') {
        const message = 'Too many files uploaded';
        error = new AppError(message, 400);
    }

    // Default error response
    const statusCode = error.statusCode || 500;
    const message = error.message || 'Internal Server Error';

    // Don't leak error details in production
    const errorResponse = {
        success: false,
        message: message,
        ...(process.env.NODE_ENV === 'development' && {
            error: err,
            stack: err.stack
        })
    };

    res.status(statusCode).json(errorResponse);
};

// Async wrapper to catch errors in async route handlers
const asyncHandler = (fn) => (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
};

// 404 handler for undefined routes
const notFoundHandler = (req, res, next) => {
    const message = `Route ${req.originalUrl} not found`;
    errorLogger.warn('Route not found', {
        url: req.originalUrl,
        method: req.method,
        ip: req.ip
    });
    
    const error = new AppError(message, 404);
    next(error);
};

module.exports = {
    AppError,
    errorHandler,
    asyncHandler,
    notFoundHandler
};
