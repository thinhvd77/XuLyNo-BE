const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { createSafeDirectoryPath, validateAndSanitizePath, SAFE_BASE_DIR } = require('../utils/filePathHelper');

// Base directory cho file uploads - use secure base directory
const baseUploadDir = SAFE_BASE_DIR;

// Đảm bảo base directory tồn tại
if (!fs.existsSync(baseUploadDir)) {
    fs.mkdirSync(baseUploadDir, { recursive: true });
}

// Helper function để tạo thư mục nếu chưa tồn tại (SECURE VERSION)
const ensureDirectoryExists = (dirPath) => {
    // Validate that the directory path is safe
    if (!dirPath || typeof dirPath !== 'string') {
        throw new Error('[SECURITY] Invalid directory path provided');
    }

    // Ensure the path is within our safe base directory
    const normalizedPath = path.normalize(dirPath);
    if (!normalizedPath.startsWith(baseUploadDir)) {
        console.error(`[SECURITY] Attempted to create directory outside safe base: ${dirPath}`);
        throw new Error('[SECURITY] Directory creation blocked - path traversal attempt');
    }

    if (!fs.existsSync(normalizedPath)) {
        fs.mkdirSync(normalizedPath, { recursive: true });
        console.log(`[SECURITY] Created safe directory: ${normalizedPath}`);
    }
};

// Helper function để sanitize tên thư mục/file với hỗ trợ tiếng Việt (ENHANCED SECURITY)
const sanitizeFileName = (name) => {
    if (!name || typeof name !== 'string') {
        return 'default';
    }

    // Normalize Unicode để xử lý tiếng Việt đúng cách
    let sanitized = name.normalize('NFC');

    // Chỉ loại bỏ các ký tự thực sự nguy hiểm, BẢO TỒN hoàn toàn tiếng Việt
    // Chỉ xóa: path separators, null bytes, và các ký tự điều khiển thực sự nguy hiểm
    sanitized = sanitized
        .replace(/[<>:"/\\|?*\0]/g, '_')  // Windows forbidden characters
        .replace(/\.\./g, '_')           // Path traversal attempts
        .replace(/^\.+/g, '_')           // Leading dots
        .replace(/\s+/g, ' ')            // Normalize whitespace nhưng KHÔNG thay bằng underscore
        .trim();

    // Ensure filename is not empty and not reserved
    const reservedNames = ['CON', 'PRN', 'AUX', 'NUL', 'COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9', 'LPT1', 'LPT2', 'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9'];
    if (!sanitized || sanitized === '' || reservedNames.includes(sanitized.toUpperCase())) {
        sanitized = `safe_${crypto.randomBytes(4).toString('hex')}`;
    }

    // Limit length để tránh vấn đề filesystem, tính theo bytes để hỗ trợ UTF-8
    const maxBytes = 200; // Tăng limit để hỗ trợ Vietnamese characters
    while (Buffer.byteLength(sanitized, 'utf8') > maxBytes && sanitized.length > 0) {
        sanitized = sanitized.slice(0, -1);
    }

    // Final safety check
    if (!sanitized || sanitized.trim() === '') {
        sanitized = `safe_${crypto.randomBytes(4).toString('hex')}`;
    }

    return sanitized;
};

// Helper function để xác định loại case (nội bảng/ngoại bảng)
const getCaseType = (caseData) => {
    if (!caseData || typeof caseData !== 'object') {
        console.warn('[SECURITY] Invalid case data provided to getCaseType');
        return 'nội bảng'; // Default safe value
    }

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

// Helper function để lấy tên document type folder (SECURE VERSION)
const getDocumentTypeFolder = (documentType) => {
    if (!documentType || typeof documentType !== 'string') {
        return 'Tài liệu khác';
    }

    const typeMapping = {
        'court': 'Tài liệu Tòa án',
        'enforcement': 'Tài liệu Thi hành án', 
        'notification': 'Tài liệu Bán nợ',
        'proactive': 'Tài liệu Chủ động xử lý tài sản',
        'collateral': 'Tài sản đảm bảo',
        'processed_collateral': 'Tài liệu tài sản đã xử lý',
        'other': 'Tài liệu khác'
    };

    // Sanitize the document type input
    const sanitizedType = documentType.toLowerCase().trim();
    const mappedType = typeMapping[sanitizedType];

    if (!mappedType) {
        console.warn(`[SECURITY] Unknown document type provided: ${documentType}`);
        return 'Tài liệu khác';
    }

    return mappedType;
};

// Danh sách MIME types được phép (ENHANCED SECURITY)
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

// Dangerous file extensions that should never be allowed
const dangerousExtensions = ['.exe', '.bat', '.cmd', '.com', '.scr', '.pif', '.vbs', '.js', '.jar', '.app', '.deb', '.rpm', '.dmg'];

// Helper function để decode Vietnamese filename đúng cách
const decodeVietnameseFilename = (filename) => {
    if (!filename) return filename;
    
    try {
        // KHÔNG decode anything - chỉ normalize Unicode
        // Multer đã nhận được filename đúng từ client, chúng ta chỉ cần normalize
        let normalized = filename.normalize('NFC');
        
        console.log(`[INFO] Processing Vietnamese filename: "${filename}" -> "${normalized}"`);
        console.log(`[INFO] Filename bytes: ${Buffer.from(normalized, 'utf8').length}, chars: ${normalized.length}`);
        
        // Chỉ thử decode nếu filename có dấu hiệu của double encoding (chứa Ã, v.v.)
        if (normalized.includes('Ã') || normalized.includes('â€')) {
            console.log(`[WARNING] Detected possible double-encoding in filename: ${normalized}`);
            // Cố gắng sửa double encoding bằng cách decode từ Latin-1 về UTF-8
            try {
                const buffer = Buffer.from(normalized, 'latin1');
                const corrected = buffer.toString('utf8').normalize('NFC');
                console.log(`[INFO] Corrected double-encoding: "${normalized}" -> "${corrected}"`);
                return corrected;
            } catch (e) {
                console.log(`[WARNING] Could not correct encoding, using original: ${normalized}`);
            }
        }
        
        return normalized;
        
    } catch (error) {
        console.warn(`[WARNING] Filename processing error: ${error.message}, using original: ${filename}`);
        return filename.normalize('NFC');
    }
};

// File filter function (ENHANCED SECURITY với hỗ trợ tiếng Việt)
const fileFilter = (req, file, cb) => {
    try {
        // QUAN TRỌNG: Đảm bảo encoding của filename được xử lý đúng
        console.log(`[INFO] Raw filename from client: "${file.originalname}"`);
        console.log(`[INFO] Filename buffer:`, Buffer.from(file.originalname, 'utf8'));
        
        // Xử lý filename để hỗ trợ tiếng Việt
        file.originalname = decodeVietnameseFilename(file.originalname);
        console.log(`[INFO] Processed filename: "${file.originalname}"`);

        // Check file extension for dangerous types
        const fileExtension = path.extname(file.originalname).toLowerCase();
        if (dangerousExtensions.includes(fileExtension)) {
            console.error(`[SECURITY] Dangerous file extension blocked: ${fileExtension}`);
            return cb(new Error(`Loại file nguy hiểm không được phép: ${fileExtension}`), false);
        }

        // Check MIME type
        if (!allowedMimeTypes.includes(file.mimetype)) {
            console.error(`[SECURITY] Unauthorized MIME type blocked: ${file.mimetype}`);
            return cb(new Error(`Loại file không được hỗ trợ: ${file.mimetype}. Chỉ chấp nhận: ${allowedMimeTypes.join(', ')}`), false);
        }

        // Additional filename validation
        if (!validateAndSanitizePath(file.originalname)) {
            console.error(`[SECURITY] Malicious filename blocked: ${file.originalname}`);
            return cb(new Error('Tên file chứa ký tự không hợp lệ'), false);
        }

        console.log(`[SECURITY] File upload approved: "${file.originalname}", MIME: ${file.mimetype}`);
        cb(null, true);

    } catch (error) {
        console.error(`[SECURITY] File filter error: ${error.message}`);
        cb(new Error('Lỗi kiểm tra file'), false);
    }
};

// Cấu hình nơi lưu trữ và cách đặt tên file (SECURE VERSION)
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    try {
        // Lưu tạm thời vào thư mục temp an toàn
        const tempDir = createSafeDirectoryPath(['temp']);

        if (!tempDir) {
            console.error('[SECURITY] Failed to create safe temp directory');
            return cb(new Error('Không thể tạo thư mục tạm thời an toàn'), null);
        }

        ensureDirectoryExists(tempDir);
        console.log(`[SECURITY] File will be temporarily stored at: ${tempDir}`);
        cb(null, tempDir);

    } catch (error) {
        console.error(`[SECURITY] Destination error: ${error.message}`);
        cb(new Error('Lỗi tạo thư mục lưu trữ'), null);
    }
  },
  filename: function (req, file, cb) {
    try {
        // Tạo tên file an toàn với timestamp và random string, BẢO TỒN tiếng Việt
        const timestamp = Date.now();
        const randomId = crypto.randomBytes(8).toString('hex');
        const extension = path.extname(file.originalname);
        const baseName = path.basename(file.originalname, extension);
        
        // BẢO TỒN original filename cho database storage - KHÔNG sanitize
        if (!file.originalVietnameseName) {
            file.originalVietnameseName = file.originalname;
        }
        
        // Chỉ sanitize basename cho việc tạo filename vật lý, KHÔNG ảnh hưởng đến database
        const sanitizedBaseName = sanitizeFileName(baseName);

        // Format: sanitizedName_timestamp_randomId.extension
        const finalFileName = `${sanitizedBaseName}_${timestamp}_${randomId}${extension}`;

        console.log(`[INFO] Original Vietnamese filename preserved for database: ${file.originalVietnameseName}`);
        console.log(`[INFO] Physical filename generated (safe for filesystem): ${finalFileName}`);
        cb(null, finalFileName);

    } catch (error) {
        console.error(`[SECURITY] Filename generation error: ${error.message}`);
        cb(new Error('Lỗi tạo tên file'), null);
    }
  }
});

const upload = multer({ 
    storage: storage,
    limits: {
        fileSize: 50 * 1024 * 1024, // 50MB limit
        files: 10, // Tối đa 10 files cùng lúc
        fieldSize: 1024 * 1024, // 1MB field size limit
        fields: 20 // Maximum number of fields
    },
    fileFilter: fileFilter
});

// Helper function để move file từ temp đến đúng vị trí (SECURE VERSION)
const moveFileToFinalDestination = async (tempFilePath, caseData, uploader, documentType) => {
    try {
        // Validate all inputs
        if (!tempFilePath || !caseData || !uploader || !documentType) {
            throw new Error('[SECURITY] Missing required parameters for file move');
        }

        // Validate temp file path is safe - allow absolute paths for temp files
        if (!validateAndSanitizePath(tempFilePath, true)) {
            throw new Error('[SECURITY] Invalid temp file path');
        }

        // Ensure temp file exists and is within safe directory
        const normalizedTempPath = path.normalize(tempFilePath);
        if (!normalizedTempPath.startsWith(baseUploadDir) || !fs.existsSync(normalizedTempPath)) {
            throw new Error('[SECURITY] Invalid temp file path or file does not exist');
        }

        // Create safe directory path segments with debugging
        const cbtdName = sanitizeFileName(uploader.fullname || uploader.employee_code || 'unknown_user');
        const customerCode = sanitizeFileName(caseData.customer_code || 'unknown_customer');
        const caseType = sanitizeFileName(getCaseType(caseData));
        const docTypeFolder = sanitizeFileName(getDocumentTypeFolder(documentType));
        
        console.log(`[INFO] Creating directory path for:`, {
            cbtd: cbtdName,
            customer: customerCode,
            type: caseType,
            docType: docTypeFolder
        });
        
        // Validate each segment before creating path
        const pathSegments = [cbtdName, customerCode, caseType, docTypeFolder];
        const invalidSegments = pathSegments.filter(segment => !segment || segment.trim() === '');
        
        if (invalidSegments.length > 0) {
            console.error(`[SECURITY] Invalid path segments detected:`, {
                segments: pathSegments,
                invalidCount: invalidSegments.length
            });
            throw new Error(`[SECURITY] Invalid path segments: ${invalidSegments.length} empty segments found`);
        }
        
        // Create safe final directory path
        const finalDir = createSafeDirectoryPath(pathSegments);

        if (!finalDir) {
            throw new Error('[SECURITY] Failed to create safe destination directory path after validation');
        }

        // Tạo thư mục đích nếu chưa tồn tại
        ensureDirectoryExists(finalDir);
        
        // Create safe final file path
        const fileName = path.basename(normalizedTempPath);
        const finalFilePath = path.join(finalDir, fileName);
        
        // Additional security check: ensure final path is still safe
        if (!finalFilePath.startsWith(baseUploadDir)) {
            throw new Error('[SECURITY] Final file path would be outside safe directory');
        }

        // Move file từ temp đến vị trí cuối cùng
        fs.renameSync(normalizedTempPath, finalFilePath);

        console.log(`[SECURITY] File safely moved from: ${normalizedTempPath}`);
        console.log(`[SECURITY] To: ${finalFilePath}`);
        console.log(`[SECURITY] User: ${uploader.employee_code}, Case: ${caseData.customer_code}, DocType: ${documentType}`);

        return finalFilePath;

    } catch (error) {
        console.error(`[SECURITY] File move error: ${error.message}`);

        // Clean up temp file if it exists
        try {
            if (tempFilePath && fs.existsSync(tempFilePath)) {
                fs.unlinkSync(tempFilePath);
                console.log(`[SECURITY] Cleaned up temp file: ${tempFilePath}`);
            }
        } catch (cleanupError) {
            console.error(`[SECURITY] Failed to cleanup temp file: ${cleanupError.message}`);
        }

        throw error;
    }
};

module.exports = { 
    upload, 
    moveFileToFinalDestination, 
    getDocumentTypeFolder,
    sanitizeFileName,
    decodeVietnameseFilename 
};