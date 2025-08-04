const {
    ValidationError,
    NotFoundError,
    AuthenticationError,
    AuthorizationError,
    DatabaseError
} = require('../middleware/errorHandler');

/**
 * Utility functions for common error scenarios
 */

/**
 * Validate required fields and throw validation error if missing
 */
const validateRequiredFields = (data, requiredFields) => {
    const missing = requiredFields.filter(field => !data[field]);

    if (missing.length > 0) {
        throw new ValidationError(`Missing required fields: ${missing.join(', ')}`);
    }
};

/**
 * Validate email format
 */
const validateEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        throw new ValidationError('Invalid email format');
    }
};

/**
 * Validate employee code format
 */
const validateEmployeeCode = (code) => {
    if (!code || !/^\d{9}$/.test(code)) {
        throw new ValidationError('Employee code must be 9 digits');
    }
};

/**
 * Validate pagination parameters
 */
const validatePagination = (page, limit) => {
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);

    if (isNaN(pageNum) || pageNum < 1) {
        throw new ValidationError('Page must be a positive number');
    }

    if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
        throw new ValidationError('Limit must be between 1 and 100');
    }

    return { page: pageNum, limit: limitNum };
};

/**
 * Check if user has required role
 */
const requireRole = (user, allowedRoles) => {
    if (!user) {
        throw new AuthenticationError('User authentication required');
    }

    if (!allowedRoles.includes(user.role)) {
        throw new AuthorizationError('Insufficient permissions');
    }
};

/**
 * Check if user can access resource (same employee or admin/manager)
 */
const requireResourceAccess = (user, resourceEmployeeCode) => {
    if (!user) {
        throw new AuthenticationError('User authentication required');
    }

    const canAccess =
        user.employee_code === resourceEmployeeCode ||
        ['administrator', 'manager', 'deputy_manager'].includes(user.role);

    if (!canAccess) {
        throw new AuthorizationError('Access denied to this resource');
    }
};

/**
 * Validate file upload parameters
 */
const validateFileUpload = (file, allowedTypes = [], maxSize = 10 * 1024 * 1024) => {
    if (!file) {
        throw new ValidationError('No file uploaded');
    }

    if (allowedTypes.length > 0 && !allowedTypes.includes(file.mimetype)) {
        throw new ValidationError(`File type not allowed. Allowed types: ${allowedTypes.join(', ')}`);
    }

    if (file.size > maxSize) {
        throw new ValidationError(`File too large. Maximum size: ${maxSize / (1024 * 1024)}MB`);
    }
};

/**
 * Validate case ID format
 */
const validateCaseId = (caseId) => {
    if (!caseId || typeof caseId !== 'string' || caseId.trim() === '') {
        throw new ValidationError('Invalid case ID format');
    }
};

/**
 * Handle database constraint errors
 */
const handleDatabaseConstraintError = (error) => {
    if (error.code === '23505') {
        throw new ValidationError('Record already exists');
    }

    if (error.code === '23503') {
        throw new ValidationError('Referenced record does not exist');
    }

    if (error.code === '23502') {
        throw new ValidationError('Required field cannot be null');
    }

    throw new DatabaseError('Database operation failed');
};

/**
 * Validate date range
 */
const validateDateRange = (startDate, endDate) => {
    const start = new Date(startDate);
    const end = new Date(endDate);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        throw new ValidationError('Invalid date format');
    }

    if (start > end) {
        throw new ValidationError('Start date must be before end date');
    }

    return { startDate: start, endDate: end };
};

/**
 * Sanitize search query
 */
const sanitizeSearchQuery = (query) => {
    if (!query || typeof query !== 'string') {
        return '';
    }

    // Remove SQL injection attempts and XSS
    return query
        .trim()
        .replace(/[<>]/g, '')
        .replace(/['";]/g, '')
        .substring(0, 100); // Limit length
};

/**
 * Validate Excel file format
 */
const validateExcelFile = (file) => {
    if (!file) {
        throw new ValidationError('No file provided');
    }

    // Check MIME type
    const allowedMimeTypes = [
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ];

    if (!allowedMimeTypes.includes(file.mimetype)) {
        throw new ValidationError(`Loại file không hợp lệ. Chỉ chấp nhận file Excel (.xls, .xlsx). File được tải lên có định dạng: ${file.mimetype}`);
    }

    // Check file extension
    const fileExtension = file.originalname.split('.').pop().toLowerCase();
    if (!['xls', 'xlsx'].includes(fileExtension)) {
        throw new ValidationError(`Phần mở rộng file không hợp lệ. Chỉ chấp nhận file .xls và .xlsx. File được tải lên: ${file.originalname}`);
    }

    // Check file buffer
    if (file.buffer && file.buffer.length === 0) {
        throw new ValidationError('File rỗng hoặc không hợp lệ');
    }

    return true;
};

module.exports = {
    validateRequiredFields,
    validateEmail,
    validateEmployeeCode,
    validatePagination,
    requireRole,
    requireResourceAccess,
    validateFileUpload,
    validateCaseId,
    handleDatabaseConstraintError,
    validateDateRange,
    sanitizeSearchQuery,
    validateExcelFile
};
