require("dotenv").config();
require("reflect-metadata");
const express = require("express");
const cors = require("cors");
const passport = require("passport");
const bcrypt = require("bcrypt");
const apiRoutes = require("./api");
const AppDataSource = require("./config/dataSource");
const { User } = require("./models/User");
const { logger, createChildLogger } = require('./config/logger');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');

// Create module-specific logger
const appLogger = createChildLogger('app');

// Khởi tạo server
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
// Cấu hình CORS chi tiết và mạnh mẽ cho phép truy cập từ mạng LAN
const corsOptions = {
    origin: function (origin, callback) {
        // Cho phép requests không có origin (mobile apps, Postman, etc.)
        if (!origin) return callback(null, true);
        
        // Các pattern cho phép
        const allowedPatterns = [
            /^http:\/\/localhost:\d+$/,           // localhost với bất kỳ port nào
            /^http:\/\/127\.0\.0\.1:\d+$/,        // 127.0.0.1 với bất kỳ port nào  
            /^http:\/\/192\.168\.\d+\.\d+:\d+$/,  // Mạng LAN 192.168.x.x
            /^http:\/\/10\.\d+\.\d+\.\d+:\d+$/,   // Mạng LAN 10.x.x.x
            /^http:\/\/172\.(1[6-9]|2\d|3[01])\.\d+\.\d+:\d+$/ // Mạng LAN 172.16-31.x.x
        ];
        
        const isAllowed = allowedPatterns.some(pattern => pattern.test(origin));
        
        if (isAllowed) {
            callback(null, true);
        } else {
            appLogger.warn('CORS blocked origin', { origin });
            callback(null, true); // Tạm thời cho phép tất cả để debug
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD'],
    allowedHeaders: [
        'Content-Type', 
        'Authorization', 
        'X-Requested-With', 
        'Accept',
        'Origin',
        'Cache-Control',
        'X-File-Name'
    ],
    exposedHeaders: [
        'Content-Disposition', 
        'Content-Type', 
        'Content-Length',
        'X-Total-Count'
    ],
    optionsSuccessStatus: 200,
    preflightContinue: false
};

app.use(cors(corsOptions));

// Middleware xử lý preflight requests
app.options('*', cors(corsOptions));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Middleware để đảm bảo CORS headers cho tất cả responses
app.use((req, res, next) => {
    const origin = req.headers.origin;
    
    // Log request details cho debugging
    appLogger.info('Request received', {
        method: req.method,
        path: req.path,
        origin: origin,
        userAgent: req.get('User-Agent'),
        ip: req.ip
    });
    
    // Các pattern cho phép (giống như trong corsOptions)
    const allowedPatterns = [
        /^http:\/\/localhost:\d+$/,           
        /^http:\/\/127\.0\.0\.1:\d+$/,        
        /^http:\/\/192\.168\.\d+\.\d+:\d+$/,  
        /^http:\/\/10\.\d+\.\d+\.\d+:\d+$/,   
        /^http:\/\/172\.(1[6-9]|2\d|3[01])\.\d+\.\d+:\d+$/
    ];
    
    // Set CORS headers
    if (!origin) {
        res.header('Access-Control-Allow-Origin', '*');
    } else {
        const isAllowed = allowedPatterns.some(pattern => pattern.test(origin));
        if (isAllowed) {
            res.header('Access-Control-Allow-Origin', origin);
        } else {
            appLogger.warn('Non-standard origin, allowing anyway', { origin });
            res.header('Access-Control-Allow-Origin', origin); // Cho phép để debug
        }
    }
    
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS, HEAD');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin, Cache-Control, X-File-Name');
    res.header('Access-Control-Expose-Headers', 'Content-Disposition, Content-Type, Content-Length, X-Total-Count');
    
    // Handle preflight requests
    if (req.method === 'OPTIONS') {
        res.header('Access-Control-Max-Age', '86400'); // 24 hours
        appLogger.debug('Handling OPTIONS request', { path: req.path });
        return res.status(200).end();
    }
    
    // Set default content type cho JSON endpoints
    if (!req.path.includes('/preview') && !req.path.includes('/download')) {
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
    }
    
    next();
});

// Cấu hình Passport
app.use(passport.initialize());
require("./config/passport")(passport);

// Kết nối CSDL và khởi động server
AppDataSource.initialize()
    .then(async () => {
        appLogger.info("Database connection established successfully");

        const officerRepository = AppDataSource.getRepository("User");

        let admin = await officerRepository.findOneBy({
            username: "admin",
        });
        if (!admin) {
            appLogger.info("Creating Administrator account...");
            const adminData = {
                employee_code: "99999999",
                username: "admin",
                fullname: "Administrator",
                dept: "IT",
                branch_code: "6421",
                role: "administrator",
                password: await bcrypt.hash("Admin@6421", 10),
            };
            admin = officerRepository.create(adminData);
            await officerRepository.save(admin);
            appLogger.info("Administrator account created successfully");
        }

        // Routes
        app.use("/api", apiRoutes);

        // Route gốc để health check
        app.get("/", (req, res) => {
            res.json({
                success: true,
                message: "Welcome to Debt Collection API with Express.js!",
                timestamp: new Date().toISOString(),
                uptime: process.uptime()
            });
        });

        // 404 handler for undefined routes
        app.use(notFoundHandler);

        // Global error handling middleware (must be last)
        app.use(errorHandler);

        app.listen(PORT, '0.0.0.0', () => {
            appLogger.info('Server started successfully', {
                port: PORT,
                environment: process.env.NODE_ENV || 'development',
                localhost: `http://localhost:${PORT}`,
                network: `http://[your-ip]:${PORT}`,
                apiHealth: `http://localhost:${PORT}/api/health`
            });
        });
    })
    .catch((error) => {
        appLogger.error("Database connection failed", { 
            error: error.message, 
            stack: error.stack 
        });
        process.exit(1);
    });
