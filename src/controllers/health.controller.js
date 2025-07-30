const AppDataSource = require('../config/dataSource');
const { createChildLogger } = require('../config/logger');
const { asyncHandler } = require('../middleware/errorHandler');

const healthLogger = createChildLogger('health-check');

// Health check controller
const healthCheck = asyncHandler(async (req, res) => {
    const healthcheck = {
        uptime: process.uptime(),
        message: 'OK',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development',
        version: process.env.npm_package_version || '1.0.0'
    };

    try {
        // Check database connection
        if (AppDataSource.isInitialized) {
            await AppDataSource.query('SELECT NOW()');
            healthcheck.database = 'Connected';
        } else {
            healthcheck.database = 'Disconnected';
            healthcheck.message = 'Database not connected';
        }

        // Check memory usage
        const memoryUsage = process.memoryUsage();
        healthcheck.memory = {
            rss: `${Math.round(memoryUsage.rss / 1024 / 1024)} MB`,
            heapTotal: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)} MB`,
            heapUsed: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)} MB`,
            external: `${Math.round(memoryUsage.external / 1024 / 1024)} MB`
        };

        // Log health check
        healthLogger.info('Health check performed', {
            status: healthcheck.message,
            database: healthcheck.database,
            uptime: healthcheck.uptime,
            ip: req.ip,
            userAgent: req.get('User-Agent')
        });

        const statusCode = healthcheck.database === 'Connected' ? 200 : 503;
        res.status(statusCode).json({
            success: statusCode === 200,
            data: healthcheck
        });

    } catch (error) {
        healthcheck.database = 'Error';
        healthcheck.message = 'Database connection failed';
        
        healthLogger.error('Health check failed', {
            error: error.message,
            stack: error.stack
        });

        res.status(503).json({
            success: false,
            data: healthcheck,
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// Detailed health check for monitoring systems
const detailedHealthCheck = asyncHandler(async (req, res) => {
    const checks = {
        timestamp: new Date().toISOString(),
        status: 'healthy',
        checks: {}
    };

    try {
        // Database check
        if (AppDataSource.isInitialized) {
            const startTime = Date.now();
            await AppDataSource.query('SELECT NOW()');
            const endTime = Date.now();
            
            checks.checks.database = {
                status: 'healthy',
                responseTime: `${endTime - startTime}ms`,
                message: 'Database connection successful'
            };
        } else {
            checks.checks.database = {
                status: 'unhealthy',
                message: 'Database not initialized'
            };
            checks.status = 'unhealthy';
        }

        // System checks
        const memoryUsage = process.memoryUsage();
        const heapUsedPercent = (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100;
        
        checks.checks.memory = {
            status: heapUsedPercent > 90 ? 'unhealthy' : 'healthy',
            heapUsedPercent: `${heapUsedPercent.toFixed(2)}%`,
            heapUsed: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)} MB`,
            heapTotal: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)} MB`
        };

        // Uptime check
        const uptimeSeconds = process.uptime();
        checks.checks.uptime = {
            status: 'healthy',
            uptime: `${Math.floor(uptimeSeconds / 3600)}h ${Math.floor((uptimeSeconds % 3600) / 60)}m ${Math.floor(uptimeSeconds % 60)}s`,
            seconds: uptimeSeconds
        };

        // Overall status
        const allHealthy = Object.values(checks.checks).every(check => check.status === 'healthy');
        checks.status = allHealthy ? 'healthy' : 'unhealthy';

        healthLogger.info('Detailed health check performed', {
            status: checks.status,
            checks: Object.keys(checks.checks),
            ip: req.ip
        });

        res.status(checks.status === 'healthy' ? 200 : 503).json({
            success: checks.status === 'healthy',
            data: checks
        });

    } catch (error) {
        checks.status = 'unhealthy';
        checks.error = process.env.NODE_ENV === 'development' ? error.message : 'Internal error';

        healthLogger.error('Detailed health check failed', {
            error: error.message,
            stack: error.stack
        });

        res.status(503).json({
            success: false,
            data: checks
        });
    }
});

module.exports = {
    healthCheck,
    detailedHealthCheck
};
