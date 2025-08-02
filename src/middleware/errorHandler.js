const logger = require('../config/logger');

/**
 * Custom Error Classes for better error handling
 */
class AppError extends Error {
    constructor(message, statusCode, errorCode = null, details = null) {
        super(message);
        this.statusCode = statusCode;
        this.errorCode = errorCode;
        this.details = details;
        this.isOperational = true;
        this.timestamp = new Date().toISOString();

        Error.captureStackTrace(this, this.constructor);
    }
}

class ValidationError extends AppError {
    constructor(message, details = null) {
        super(message, 400, 'VALIDATION_ERROR', details);
    }
}

class AuthenticationError extends AppError {
    constructor(message = 'Authentication failed') {
        super(message, 401, 'AUTHENTICATION_ERROR');
    }
}

class AuthorizationError extends AppError {
    constructor(message = 'Access denied') {
        super(message, 403, 'AUTHORIZATION_ERROR');
    }
}

class NotFoundError extends AppError {
    constructor(message = 'Resource not found') {
        super(message, 404, 'NOT_FOUND_ERROR');
    }
}

class DatabaseError extends AppError {
    constructor(message = 'Database operation failed', details = null) {
        super(message, 500, 'DATABASE_ERROR', details);
    }
}

class FileOperationError extends AppError {
    constructor(message = 'File operation failed', details = null) {
        super(message, 500, 'FILE_OPERATION_ERROR', details);
    }
}

/**
 * Error handler middleware
 */
const errorHandler = (err, req, res, next) => {
    let error = { ...err };
    error.message = err.message;

    // Log error details
    const errorLog = {
        method: req.method,
        url: req.originalUrl,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        timestamp: new Date().toISOString(),
        error: {
            name: err.name,
            message: err.message,
            stack: err.stack,
            statusCode: err.statusCode
        }
    };

    // Log based on error severity
    if (err.statusCode >= 500) {
        logger.error('Server Error:', errorLog);
    } else if (err.statusCode >= 400) {
        logger.warn('Client Error:', errorLog);
    } else {
        logger.info('Error handled:', errorLog);
    }

    // TypeORM/Database errors
    if (err.name === 'QueryFailedError') {
        const message = 'Database query failed';
        error = new DatabaseError(message, {
            query: err.query,
            parameters: err.parameters
        });
    }

    // TypeORM Entity not found
    if (err.name === 'EntityNotFound') {
        error = new NotFoundError('Requested resource not found');
    }

    // Validation errors
    if (err.name === 'ValidationError') {
        const message = Object.values(err.errors).map(val => val.message).join(', ');
        error = new ValidationError(message, err.errors);
    }

    // JWT errors
    if (err.name === 'JsonWebTokenError') {
        error = new AuthenticationError('Invalid token');
    }

    if (err.name === 'TokenExpiredError') {
        error = new AuthenticationError('Token expired');
    }

    // Multer errors
    if (err.code === 'LIMIT_FILE_SIZE') {
        error = new ValidationError('File too large');
    }

    if (err.code === 'LIMIT_UNEXPECTED_FILE') {
        error = new ValidationError('Too many files or unexpected field');
    }

    // PostgreSQL specific errors
    if (err.code === '23505') { // Unique constraint violation
        error = new ValidationError('Duplicate entry detected');
    }

    if (err.code === '23503') { // Foreign key constraint violation
        error = new ValidationError('Referenced record does not exist');
    }

    if (err.code === '23502') { // Not null constraint violation
        error = new ValidationError('Required field is missing');
    }

    // Security errors
    if (err.message && err.message.includes('[SECURITY]')) {
        error = new ValidationError('Security policy violation', {
            reason: err.message
        });
    }

    // Default to 500 server error
    if (!error.statusCode) {
        error = new AppError('Internal Server Error', 500, 'INTERNAL_ERROR');
    }

    // Prepare response
    const response = {
        success: false,
        error: {
            message: error.message,
            code: error.errorCode || 'UNKNOWN_ERROR',
            timestamp: error.timestamp || new Date().toISOString()
        }
    };

    // Add details in development mode
    if (process.env.NODE_ENV === 'development') {
        response.error.details = error.details;
        response.error.stack = error.stack;
    }

    // Add error details for validation errors
    if (error instanceof ValidationError && error.details) {
        response.error.validation = error.details;
    }

    res.status(error.statusCode).json(response);
};

/**
 * Async error wrapper
 */
const asyncHandler = (fn) => (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
};

/**
 * 404 Not Found handler
 */
const notFoundHandler = (req, res, next) => {
    const error = new NotFoundError(`Route ${req.originalUrl} not found`);
    next(error);
};

/**
 * Unhandled rejection handler
 */
const handleUnhandledRejection = () => {
    process.on('unhandledRejection', (err, promise) => {
        logger.error('Unhandled Promise Rejection:', {
            error: err.message,
            stack: err.stack,
            promise: promise
        });

        // Close server gracefully
        process.exit(1);
    });
};

/**
 * Uncaught exception handler
 */
const handleUncaughtException = () => {
    process.on('uncaughtException', (err) => {
        logger.error('Uncaught Exception:', {
            error: err.message,
            stack: err.stack
        });

        // Close server gracefully
        process.exit(1);
    });
};

module.exports = {
    AppError,
    ValidationError,
    AuthenticationError,
    AuthorizationError,
    NotFoundError,
    DatabaseError,
    FileOperationError,
    errorHandler,
    asyncHandler,
    notFoundHandler,
    handleUnhandledRejection,
    handleUncaughtException
};
