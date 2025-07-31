const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

// Base directory cho file uploads disk D

const baseUploadDir = 'D:/FilesXuLyNo/';

// Đảm bảo base directory tồn tại
if (!fs.existsSync(baseUploadDir)) {
    fs.mkdirSync(baseUploadDir, { recursive: true });
}

// Helper function để tạo thư mục nếu chưa tồn tại
const ensureDirectoryExists = (dirPath) => {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }
};

// Helper function để sanitize tên thư mục/file
const sanitizeFileName = (name) => {
    // Loại bỏ các ký tự không hợp lệ cho tên file/thư mục
    return name.replace(/[<>:"/\\|?*]/g, '_').trim();
};

// Helper function để xác định loại case (nội bảng/ngoại bảng)
const getCaseType = (caseData) => {
    // Dựa vào field case_type trong database
    if (caseData.case_type === 'external') {
        return 'ngoại bảng';
    } else if (caseData.case_type === 'internal') {
        return 'nội bảng';
    } else {
        // Mặc định là nội bảng nếu không xác định được
        return 'nội bảng';
    }
};

// Helper function để lấy tên document type folder
const getDocumentTypeFolder = (documentType) => {
    const typeMapping = {
        'court': 'Tài liệu Tòa án',
        'enforcement': 'Tài liệu Thi hành án', 
        'notification': 'Tài liệu Bán nợ',
        'proactive': 'Tài liệu Chủ động xử lý tài sản',
        'collateral': 'Tài sản đảm bảo',
        'processed_collateral': 'Tài liệu tài sản đã xử lý',
        'other': 'Tài liệu khác'
    };
    return typeMapping[documentType] || 'Tài liệu khác';
};

// Danh sách MIME types được phép
const allowedMimeTypes = [
    // Images
    'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/bmp',
    // Documents
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    // Text
    'text/plain', 'text/csv',
    // Videos
    'video/mp4', 'video/avi', 'video/mov', 'video/wmv', 'video/webm',
    // Audio
    'audio/mp3', 'audio/wav', 'audio/ogg', 'audio/mpeg',
    // Archives
    'application/zip', 'application/x-rar-compressed', 'application/x-7z-compressed'
];

// File filter function
const fileFilter = (req, file, cb) => {
    // Decode tên file để xử lý tiếng Việt
    try {
        file.originalname = Buffer.from(file.originalname, 'latin1').toString('utf8');
    } catch (e) {
        // Nếu không decode được, giữ nguyên tên file
        console.log('Không thể decode tên file:', file.originalname);
    }
    
    if (allowedMimeTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error(`Loại file không được hỗ trợ: ${file.mimetype}. Chỉ chấp nhận: ${allowedMimeTypes.join(', ')}`), false);
    }
};

// Cấu hình nơi lưu trữ và cách đặt tên file
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    // Lưu tạm thời vào thư mục temp, sau đó sẽ move trong controller
    const tempDir = path.join(baseUploadDir, 'temp');
    ensureDirectoryExists(tempDir);
    console.log('File sẽ được lưu tạm tại:', tempDir);
    cb(null, tempDir);
  },
  filename: function (req, file, cb) {
    // Tạo tên file với timestamp và random string để tránh trùng lặp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const randomId = crypto.randomBytes(4).toString('hex');
    const extension = path.extname(file.originalname);
    const baseName = path.basename(file.originalname, extension);
    const sanitizedBaseName = sanitizeFileName(baseName);
    
    // Format: originalName_timestamp_randomId.extension
    const finalFileName = `${sanitizedBaseName}_${timestamp}_${randomId}${extension}`;
    
    console.log('Tên file sẽ được lưu:', finalFileName);
    cb(null, finalFileName);
  }
});

const upload = multer({ 
    storage: storage,
    limits: {
        fileSize: 50 * 1024 * 1024, // 50MB limit
        files: 10 // Tối đa 10 files cùng lúc
    },
    fileFilter: fileFilter
});

// Helper function để move file từ temp đến đúng vị trí
const moveFileToFinalDestination = async (tempFilePath, caseData, uploader, documentType) => {
    try {
        const cbtdName = sanitizeFileName(uploader.fullname || uploader.employee_code);
        const customerCode = sanitizeFileName(caseData.customer_code);
        const caseType = getCaseType(caseData);
        const docTypeFolder = sanitizeFileName(getDocumentTypeFolder(documentType));
        
        const finalDir = path.join(
            baseUploadDir,
            cbtdName,
            customerCode,
            caseType,
            docTypeFolder
        );

        // Tạo thư mục đích nếu chưa tồn tại
        ensureDirectoryExists(finalDir);
        
        // Tạo đường dẫn file đích
        const fileName = path.basename(tempFilePath);
        const finalFilePath = path.join(finalDir, fileName);
        
        // Move file từ temp đến vị trí cuối cùng
        fs.renameSync(tempFilePath, finalFilePath);
        
        console.log('File đã được move từ:', tempFilePath);
        console.log('Đến:', finalFilePath);
        
        return finalFilePath;
    } catch (error) {
        console.error('Lỗi khi move file:', error);
        throw error;
    }
};

module.exports = { upload, moveFileToFinalDestination, getDocumentTypeFolder };