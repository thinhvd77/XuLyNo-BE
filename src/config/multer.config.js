const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

// Đảm bảo thư mục uploads tồn tại
const uploadDir = 'uploads/';
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
}

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
    cb(null, uploadDir); // Lưu file vào thư mục 'uploads/'
  },
  filename: function (req, file, cb) {
    // Tạo tên file duy nhất nhưng vẫn giữ extension gốc để hỗ trợ preview tốt hơn
    const uniqueSuffix = req.params.caseId + '-' + Date.now();
    const randomId = crypto.randomBytes(8).toString('hex');
    const extension = path.extname(file.originalname);
    
    // Format: caseId-timestamp-randomId.extension
    cb(null, `${uniqueSuffix}-${randomId}${extension}`);
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

module.exports = upload;