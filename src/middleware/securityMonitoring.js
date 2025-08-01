const fs = require('fs');
const path = require('path');

/**
 * Security Monitoring Middleware
 * Detects and logs potential security threats including path traversal attacks
 */

// Security event types
const SECURITY_EVENT_TYPES = {
    PATH_TRAVERSAL_ATTEMPT: 'PATH_TRAVERSAL_ATTEMPT',
    INVALID_FILE_ACCESS: 'INVALID_FILE_ACCESS',
    SUSPICIOUS_FILENAME: 'SUSPICIOUS_FILENAME',
    DANGEROUS_FILE_EXTENSION: 'DANGEROUS_FILE_EXTENSION',
    UNAUTHORIZED_MIME_TYPE: 'UNAUTHORIZED_MIME_TYPE',
    DIRECTORY_ESCAPE_ATTEMPT: 'DIRECTORY_ESCAPE_ATTEMPT'
};

// Create logs directory if it doesn't exist
const logsDir = path.join(__dirname, '../../logs');
if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
}

// Security log file path
const securityLogFile = path.join(logsDir, 'security.log');

/**
 * Log security events to file and console
 * @param {string} eventType - Type of security event
 * @param {Object} details - Event details
 * @param {Object} req - Express request object
 */
const logSecurityEvent = (eventType, details, req = null) => {
    const timestamp = new Date().toISOString();
    const userInfo = req?.user ? {
        id: req.user.id,
        employee_code: req.user.employee_code,
        role: req.user.role
    } : { user: 'anonymous' };

    const clientInfo = req ? {
        ip: req.ip || req.connection.remoteAddress,
        userAgent: req.get('User-Agent'),
        method: req.method,
        url: req.originalUrl,
        headers: {
            host: req.get('Host'),
            referer: req.get('Referer'),
            origin: req.get('Origin')
        }
    } : {};

    const securityEvent = {
        timestamp,
        eventType,
        severity: getSeverityLevel(eventType),
        details,
        user: userInfo,
        client: clientInfo
    };

    // Log to console with color coding
    const severityColors = {
        CRITICAL: '\x1b[91m', // Bright red
        HIGH: '\x1b[31m',     // Red
        MEDIUM: '\x1b[33m',   // Yellow
        LOW: '\x1b[36m',      // Cyan
        RESET: '\x1b[0m'      // Reset
    };

    const color = severityColors[securityEvent.severity] || severityColors.MEDIUM;
    console.log(`${color}[SECURITY ${securityEvent.severity}] ${eventType}: ${JSON.stringify(details)}${severityColors.RESET}`);

    // Log to file
    try {
        const logEntry = JSON.stringify(securityEvent) + '\n';
        fs.appendFileSync(securityLogFile, logEntry);
    } catch (error) {
        console.error('Failed to write security log:', error);
    }

    // For critical events, also log to error log
    if (securityEvent.severity === 'CRITICAL') {
        console.error(`CRITICAL SECURITY EVENT: ${eventType}`, securityEvent);
    }
};

/**
 * Get severity level for security event type
 * @param {string} eventType - Security event type
 * @returns {string} Severity level
 */
const getSeverityLevel = (eventType) => {
    const severityMap = {
        [SECURITY_EVENT_TYPES.PATH_TRAVERSAL_ATTEMPT]: 'CRITICAL',
        [SECURITY_EVENT_TYPES.DIRECTORY_ESCAPE_ATTEMPT]: 'CRITICAL',
        [SECURITY_EVENT_TYPES.INVALID_FILE_ACCESS]: 'HIGH',
        [SECURITY_EVENT_TYPES.DANGEROUS_FILE_EXTENSION]: 'HIGH',
        [SECURITY_EVENT_TYPES.SUSPICIOUS_FILENAME]: 'MEDIUM',
        [SECURITY_EVENT_TYPES.UNAUTHORIZED_MIME_TYPE]: 'MEDIUM'
    };

    return severityMap[eventType] || 'LOW';
};

/**
 * Middleware to monitor file-related requests for security issues
 */
const securityMonitoringMiddleware = (req, res, next) => {
    // Monitor file upload requests
    if (req.file) {
        const originalname = req.file.originalname;

        // Check for suspicious patterns in filename
        const suspiciousPatterns = [
            /\.\./,           // Path traversal
            /[<>:"|?*]/,      // Forbidden characters
            /^[\/\\]/,        // Absolute paths
            /\0/,             // Null bytes
            /\.\.\/|\.\.\\/, // Directory traversal
            /%2e%2e/i,        // URL encoded path traversal
            /\.php$|\.asp$|\.jsp$|\.exe$/i // Dangerous extensions
        ];

        for (const pattern of suspiciousPatterns) {
            if (pattern.test(originalname)) {
                logSecurityEvent(
                    SECURITY_EVENT_TYPES.SUSPICIOUS_FILENAME,
                    {
                        filename: originalname,
                        pattern: pattern.toString(),
                        fileSize: req.file.size,
                        mimetype: req.file.mimetype
                    },
                    req
                );
                break;
            }
        }
    }

    // Monitor URL parameters for path traversal attempts
    const checkForPathTraversal = (value, paramName) => {
        if (typeof value === 'string') {
            const dangerousPatterns = [
                /\.\./,
                /%2e%2e/i,
                /%252e%252e/i,
                /\.\.\/|\.\.\\/,
                /%2f%2e%2e/i,
                /%5c%2e%2e/i
            ];

            for (const pattern of dangerousPatterns) {
                if (pattern.test(value)) {
                    logSecurityEvent(
                        SECURITY_EVENT_TYPES.PATH_TRAVERSAL_ATTEMPT,
                        {
                            parameter: paramName,
                            value: value,
                            pattern: pattern.toString()
                        },
                        req
                    );

                    // Block the request for critical security violations
                    return res.status(403).json({
                        success: false,
                        message: 'Access denied - security violation detected'
                    });
                }
            }
        }
    };

    // Check query parameters
    for (const [key, value] of Object.entries(req.query || {})) {
        const result = checkForPathTraversal(value, `query.${key}`);
        if (result) return result;
    }

    // Check URL parameters
    for (const [key, value] of Object.entries(req.params || {})) {
        const result = checkForPathTraversal(value, `params.${key}`);
        if (result) return result;
    }

    // Check body parameters for file-related operations
    if (req.body && typeof req.body === 'object') {
        for (const [key, value] of Object.entries(req.body)) {
            if (key.toLowerCase().includes('path') || key.toLowerCase().includes('file')) {
                const result = checkForPathTraversal(value, `body.${key}`);
                if (result) return result;
            }
        }
    }

    next();
};

/**
 * Rate limiting for suspicious activities
 */
const suspiciousActivityTracker = new Map();

const rateLimitSecurityViolations = (req, res, next) => {
    const clientId = req.ip || 'unknown';
    const now = Date.now();
    const windowMs = 5 * 60 * 1000; // 5 minutes
    const maxViolations = 5;

    if (!suspiciousActivityTracker.has(clientId)) {
        suspiciousActivityTracker.set(clientId, { count: 0, firstViolation: now });
    }

    const clientData = suspiciousActivityTracker.get(clientId);

    // Reset counter if window has passed
    if (now - clientData.firstViolation > windowMs) {
        clientData.count = 0;
        clientData.firstViolation = now;
    }

    // Check if client has too many violations
    if (clientData.count >= maxViolations) {
        logSecurityEvent(
            'RATE_LIMIT_EXCEEDED',
            {
                client: clientId,
                violations: clientData.count,
                timeWindow: `${windowMs/1000}s`
            },
            req
        );

        return res.status(429).json({
            success: false,
            message: 'Too many security violations. Please try again later.'
        });
    }

    next();
};

/**
 * Clean up old tracking data periodically
 */
setInterval(() => {
    const now = Date.now();
    const windowMs = 5 * 60 * 1000;

    for (const [clientId, data] of suspiciousActivityTracker.entries()) {
        if (now - data.firstViolation > windowMs) {
            suspiciousActivityTracker.delete(clientId);
        }
    }
}, 60 * 1000); // Clean up every minute

module.exports = {
    securityMonitoringMiddleware,
    rateLimitSecurityViolations,
    logSecurityEvent,
    SECURITY_EVENT_TYPES
};
