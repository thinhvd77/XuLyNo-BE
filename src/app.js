require("dotenv").config();
require("reflect-metadata");
const express = require("express");
const cors = require("cors");
const passport = require("passport");
const bcrypt = require("bcrypt");
const apiRoutes = require("./api");
const AppDataSource = require("./config/dataSource");
const {
    errorHandler,
    notFoundHandler,
    handleUnhandledRejection,
    handleUncaughtException
} = require("./middleware/errorHandler");

// Initialize global error handlers
handleUnhandledRejection();
handleUncaughtException();

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
            /^http:\/\/localhost(:\d+)?$/,        // localhost với hoặc không có port
            /^http:\/\/127\.0\.0\.1:\d+$/,        // 127.0.0.1 với bất kỳ port nào  
            /^http:\/\/192\.168\.\d+\.\d+:\d+$/,  // Mạng LAN 192.168.x.x
            /^http:\/\/10\.\d+\.\d+\.\d+:\d+$/,   // Mạng LAN 10.x.x.x
            /^http:\/\/172\.(1[6-9]|2\d|3[01])\.\d+\.\d+:\d+$/ // Mạng LAN 172.16-31.x.x
        ];
        
        const isAllowed = allowedPatterns.some(pattern => pattern.test(origin));
        
        if (isAllowed) {
            callback(null, true);
        } else {
            console.log('CORS blocked origin:', origin);
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

// Basic Express configuration with UTF-8 support for Vietnamese characters
app.use(express.json({ 
    limit: '50mb',
    charset: 'utf-8'
}));
app.use(express.urlencoded({ 
    extended: true, 
    limit: '50mb',
    charset: 'utf-8'
}));

// Middleware để đảm bảo CORS headers cho tất cả responses
app.use((req, res, next) => {
    const origin = req.headers.origin;
    
    // Log request details cho debugging
    console.log(`${req.method} ${req.path} - Origin: ${origin}`);
    
    // Các pattern cho phép (giống như trong corsOptions)
    const allowedPatterns = [
        /^http:\/\/localhost(:\d+)?$/,        // localhost với hoặc không có port
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
            console.log('Non-standard origin, allowing anyway:', origin);
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
        console.log('Handling OPTIONS request for:', req.path);
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

// Routes
app.use("/api", apiRoutes);

// Route gốc để health check
app.get("/", (req, res) => {
    res.json({
        success: true,
        message: "Welcome to Debt Collection API with Express.js!",
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development'
    });
});

// Error handling middleware (must be after all routes)
app.use(notFoundHandler);
app.use(errorHandler);

// Kết nối CSDL và khởi động server
AppDataSource.initialize()
    .then(async () => {
        console.log("✅ Đã kết nối cơ sở dữ liệu thành công!");

        const officerRepository = AppDataSource.getRepository("User");
        // const caseRepository = AppDataSource.getRepository("DebtCase");

        let admin = await officerRepository.findOneBy({
            username: "admin",
        });
        if (!admin) {
            console.log("Tạo Administrator...");
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
            console.log("✅ Tạo Administrator thành công!");
        }

        app.listen(PORT, '0.0.0.0', () => {
            console.log(`🚀 Server đang chạy tại:`);
            console.log(`   - Localhost: http://localhost:${PORT}`);
            console.log(`   - Network: http://[your-ip]:${PORT}`);
            console.log(`   - API Health: http://localhost:${PORT}/api`);
        });
    })
    .catch((error) => {
        console.log("❌ Lỗi kết nối cơ sở dữ liệu: ", error);
        process.exit(1);
    });
