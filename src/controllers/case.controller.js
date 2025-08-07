const caseService = require("../services/case.service");
const fileManagerService = require("../services/fileManager.service");
const { validationResult } = require("express-validator");
const multer = require("multer");
const logger = require("../config/logger");
const { AuthenticationError } = require("../middleware/auth.middleware");
const { moveFileToFinalDestination, getDocumentTypeFolder } = require("../config/multer.config");
const { validateExcelFile } = require("../utils/errorUtils");
const {
    asyncHandler,
    ValidationError,
    NotFoundError,
    FileOperationError,
    DatabaseError
} = require("../middleware/errorHandler");

/**
 * MỚI: Xử lý request upload file Excel
 */
exports.importCases = asyncHandler(async (req, res) => {
    if (!req.file) {
        throw new ValidationError("Vui lòng tải lên một file Excel.");
    }

    // Validate Excel file using utility function
    validateExcelFile(req.file);

    logger.info(`Excel import started - Internal cases. File: ${req.file.originalname}, Size: ${req.file.size} bytes, User: ${req.user?.employee_code}`);

    const result = await caseService.importCasesFromExcel(req.file.buffer);

    res.status(200).json({
        success: true,
        message: "Import hoàn tất!",
        data: result,
    });
});

exports.importExternalCases = asyncHandler(async (req, res) => {
    if (!req.file) {
        throw new ValidationError("Vui lòng tải lên một file Excel.");
    }

    // Validate Excel file using utility function
    validateExcelFile(req.file);

    logger.info(`Excel import started - External cases. File: ${req.file.originalname}, Size: ${req.file.size} bytes, User: ${req.user?.employee_code}`);

    const result = await caseService.importExternalCasesFromExcel(req.file.buffer);

    res.status(200).json({
        success: true,
        message: "Import hoàn tất!",
        data: result,
    });
});

/**
 * MỚI: Lấy danh sách hồ sơ của người dùng đang đăng nhập
 */
exports.getMyCases = asyncHandler(async (req, res) => {
    // req.user được Passport.js thêm vào sau khi xác thực JWT thành công
    const employeeCode = req.user.employee_code;

    if (!employeeCode) {
        return res
            .status(400)
            .json({ message: "Không tìm thấy thông tin nhân viên." });
    }

    // Kiểm tra xem có tham số phân trang không
    const {
        page,
        limit,
        search,
        type,
        status,
        sortBy,
        sortOrder
    } = req.query;

    // Nếu có tham số phân trang, sử dụng phương thức mới
    if (page || limit || search || type || status || sortBy || sortOrder) {
        const pageNum = parseInt(page) || 1;
        const limitNum = parseInt(limit) || 20;
        const filters = { search: search || '', type: type || '', status: status || '' };
        const sorting = { sortBy: sortBy || '', sortOrder: sortOrder || 'asc' };

        const result = await caseService.findMyCases(employeeCode, pageNum, filters, limitNum, sorting);
        return res.status(200).json(result);
    }

    // Fallback cho client cũ: trả về tất cả cases (tương thích ngược)
    const cases = await caseService.findCasesByEmployeeCode(employeeCode);
    res.status(200).json(cases);
});

/**
 * MỚI: Lấy tất cả danh sách hồ sơ (dành cho Ban Giám Đốc)
 */
exports.getAllCases = asyncHandler(async (req, res) => {
    try {
        const {
            page = 1,
            limit = 20,
            search = '',
            type = '',
            status = '',
            sortBy = '',
            sortOrder = 'asc',
            branch_code = '',
            employee_code = '',
            department_code = ''
        } = req.query;

        // Input validation
        const pageNum = parseInt(page, 10);
        const limitNum = parseInt(limit, 10);

        if (isNaN(pageNum) || pageNum < 1) {
            throw new ValidationError('Page must be a positive integer');
        }

        if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
            throw new ValidationError('Limit must be between 1 and 100');
        }

        // Extract director's branch code from authenticated user
        const directorBranchCode = req.user?.branch_code;

        if (!directorBranchCode) {
            logger.warn('Director branch code not found in user context:', {
                user: req.user?.employee_code,
                url: req.originalUrl
            });
            throw new AuthenticationError('User branch information not available');
        }

        // Prepare filters with sanitization
        const filters = {
            search: search ? search.trim().substring(0, 100) : '',
            type: type || '',
            status: status || '',
            branch_code: branch_code || '',
            employee_code: employee_code || '',
            department_code: department_code || ''
        };

        const sorting = {
            sortBy: sortBy || '',
            sortOrder: ['asc', 'desc'].includes(sortOrder.toLowerCase()) ? sortOrder.toLowerCase() : 'asc'
        };

        // Call service with director's branch code for access control
        const result = await caseService.findAllCases(
            pageNum,
            filters,
            limitNum,
            sorting,
            directorBranchCode
        );

        if (!result || !result.success) {
            throw new Error('Failed to retrieve cases');
        }

        // Log successful operation for audit trail
        logger.info('Director cases retrieved successfully', {
            director: req.user.employee_code,
            directorBranch: directorBranchCode,
            totalCases: result.data.totalCases,
            page: pageNum,
            filters: Object.keys(filters).filter(key => filters[key]).length > 0 ? filters : 'none'
        });

        res.status(200).json(result);

    } catch (error) {
        logger.error('Error in getAllCases controller:', {
            error: error.message,
            user: req.user?.employee_code,
            query: req.query,
            stack: error.stack
        });
        throw error;
    }
});

/**
 * MỚI: Lấy danh sách hồ sơ theo phòng ban (dành cho Manager/Deputy Manager)
 * Hiển thị cases được quản lý bởi CBTD có cùng phòng ban và cùng branch_code
 */
exports.getDepartmentCases = asyncHandler(async (req, res) => {
    const {
        page = 1,
        limit = 20,
        search = '',
        type = '',
        status = '',
        sortBy = '',
        sortOrder = 'asc'
    } = req.query;

    // Lấy thông tin user hiện tại từ token (đã được decode trong middleware)
    const currentUser = req.user;
    const filters = {
        search,
        type,
        status,
        department: currentUser.dept,
        branch_code: currentUser.branch_code
    };
    const sorting = { sortBy, sortOrder };

    const cases = await caseService.findDepartmentCases(page, filters, parseInt(limit), sorting);
    res.status(200).json(cases);
});

/**
 * MỚI: Lấy thông tin chi tiết của một hồ sơ theo ID
 * @param {string} req.params.caseId - ID của hồ sơ cần lấy thông tin
 */
exports.getCaseDetails = asyncHandler(async (req, res) => {
    const caseId = req.params.caseId;
    if (!caseId) {
        throw new ValidationError("ID hồ sơ không hợp lệ.");
    }

    const debtCase = await caseService.getCaseById(caseId);
    if (!debtCase) {
        throw new NotFoundError("Hồ sơ không tìm thấy.");
    }

    res.status(200).json({
        success: true,
        data: debtCase
    });
});

/**
 * NEW: Lấy thông tin tổng hợp của case (details + updates + documents)
 */
exports.getCaseOverview = asyncHandler(async (req, res) => {
    const caseId = req.params.caseId;
    const { limit = 10 } = req.query;

    if (!caseId) {
        throw new ValidationError("ID hồ sơ không hợp lệ.");
    }

    // SECURITY: Access control based on user role
    const currentUser = req.user;
    const userRole = currentUser.role;
    const userDept = currentUser.dept;
    const userEmployeeCode = currentUser.employee_code;

    // Get case details first to check ownership/access
    const caseDetail = await caseService.getCaseById(caseId);
    if (!caseDetail) {
        throw new NotFoundError("Hồ sơ không tìm thấy.");
    }

    // Access control logic
    let hasAccess = false;

    if (userRole === 'administrator') {
        hasAccess = true; // Admin has full access
    } else if (userRole === 'deputy_director' || userRole === 'director' || 
               (userRole === 'manager' && userDept === 'KHDN') || userDept === 'KTGSNB') {
        // Directors can access cases based on branch filtering (handled by service layer)
        hasAccess = true;
    } else if (userRole === 'employee' && 
               ['KHCN', 'KHDN', 'KH', 'PGD'].includes(userDept)) {
        // Employee can only access their own assigned cases
        hasAccess = (caseDetail.assigned_employee_code === userEmployeeCode);
    } else if ((userRole === 'deputy_manager' && userDept === 'KHDN') || 
               ((userRole === 'manager' || userRole === 'deputy_manager') && 
                ['KHCN', 'KH', 'PGD'].includes(userDept))) {
        // Manager/Deputy Manager can access cases in their department and branch
        hasAccess = (caseDetail.officer && 
                    caseDetail.officer.dept === userDept && 
                    caseDetail.officer.branch_code === currentUser.branch_code);
    }

    if (!hasAccess) {
        logger.warn('🚫 SECURITY: Unauthorized case overview access attempt', {
            user: userEmployeeCode,
            role: userRole,
            dept: userDept,
            caseId: caseId,
            caseOwner: caseDetail.assigned_employee_code
        });
        
        return res.status(403).json({
            success: false,
            message: "Bạn không có quyền truy cập hồ sơ này."
        });
    }

    const overview = await caseService.getCaseOverview(caseId, parseInt(limit));

    res.status(200).json({
        success: true,
        data: overview
    });
});

/**
 * MỚI: Lấy danh sách cập nhật của hồ sơ
 */
exports.getCaseUpdates = asyncHandler(async (req, res) => {
    const caseId = req.params.caseId;
    if (!caseId) {
        throw new ValidationError("ID hồ sơ không hợp lệ.");
    }

    // Lấy thông số phân trang từ query parameters
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 5;

    const result = await caseService.getCaseUpdates(caseId, page, limit);

    res.status(200).json({
        success: true,
        data: result.updates,
        pagination: result.pagination
    });
});

/**
 * MỚI: Tạo một cập nhật mới cho hồ sơ
 */
exports.createCaseUpdate = asyncHandler(async (req, res) => {
    // Kiểm tra validation
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        throw new ValidationError("Dữ liệu cập nhật không hợp lệ", errors.array());
    }

    const caseId = req.params.caseId;
    const { content } = req.body;
    const uploader = req.user; // Lấy thông tin từ token

    const newUpdate = await caseService.addCaseUpdate(
        caseId,
        content,
        uploader
    );

    res.status(201).json({
        success: true,
        message: "Cập nhật hồ sơ thành công!",
        data: newUpdate,
    });
});

/**
 * MỚI: Cập nhật trạng thái hồ sơ
 */
exports.updateCaseStatus = asyncHandler(async (req, res) => {
    // Kiểm tra validation
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        throw new ValidationError("Dữ liệu trạng thái không hợp lệ", errors.array());
    }

    const caseId = req.params.caseId;
    const { status } = req.body;
    const updater = req.user; // Lấy thông tin từ token

    const updatedCase = await caseService.updateCaseStatus(
        caseId,
        status,
        updater
    );

    res.status(200).json({
        success: true,
        message: "Cập nhật trạng thái hồ sơ thành công!",
        data: updatedCase,
    });
});

exports.getCaseUpdateContent = asyncHandler(async (req, res) => {
    const caseId = req.params.caseId;
    const contents = await caseService.getUpdateContentByCase(caseId);

    res.status(201).json({
        success: true,
        message: "Lấy nhật ký xử lý nợ thành công",
        data: contents,
    });
});

exports.uploadDocument = asyncHandler(async (req, res) => {
    const caseId = req.params.caseId;
    const uploader = req.user;
    const file = req.file;
    const documentType = req.body.document_type || 'other'; // Lấy document_type từ request body

    if (!file) {
        throw new ValidationError("Vui lòng chọn một file để tải lên.");
    }

    // Lấy thông tin case để move file đến đúng vị trí
    const AppDataSource = require('../config/dataSource');
    const caseRepository = AppDataSource.getRepository("DebtCase");
    const caseData = await caseRepository.findOneBy({ case_id: caseId });

    if (!caseData) {
        throw new NotFoundError("Không tìm thấy case.");
    }

    // Move file từ temp đến vị trí cuối cùng
    const finalFilePath = await moveFileToFinalDestination(
        file.path, // Đường dẫn file temp
        caseData,
        uploader,
        documentType
    );

    // Cập nhật file object với đường dẫn mới
    file.path = finalFilePath;
    file.destination = require('path').dirname(finalFilePath);

    const documentRecord = await caseService.addDocumentToCase(
        caseId,
        file,
        uploader,
        documentType
    );

    res.status(201).json({
        success: true,
        message: "Tải file lên thành công!",
        document: documentRecord,
    });
});

/**
 * Lấy danh sách tài liệu đã tải lên cho một case
 */
exports.getCaseDocuments = asyncHandler(async (req, res) => {
    const caseId = req.params.caseId;
    console.log('getCaseDocuments called with caseId:', caseId);

    if (!caseId) {
        throw new ValidationError("ID case không hợp lệ.");
    }

    const documents = await caseService.getDocumentsByCase(caseId);

    res.status(200).json({
        success: true,
        message: "Lấy danh sách tài liệu thành công!",
        data: documents,
    });
});

/**
 * Download file tài liệu (SECURE VERSION)
 */
exports.downloadDocument = asyncHandler(async (req, res) => {
    const documentId = req.params.documentId;

    // Validate document ID format
    if (!documentId || typeof documentId !== 'string' || !/^[a-zA-Z0-9\-]+$/.test(documentId)) {
        logger.warn('Invalid document ID format attempted', {
            documentId,
            user: req.user?.employee_code,
            ip: req.ip
        });
        throw new ValidationError("ID tài liệu không hợp lệ.");
    }

    const document = await caseService.getDocumentById(documentId);

    if (!document) {
        logger.warn('Document not found', {
            documentId,
            user: req.user?.employee_code
        });
        throw new NotFoundError("Không tìm thấy tài liệu.");
    }

    const fs = require('fs');
    const { getAbsoluteFilePath, validateAndSanitizePath } = require('../utils/filePathHelper');

    // Validate and sanitize the file path from database
    if (!document.file_path || !validateAndSanitizePath(document.file_path)) {
        logger.error('Invalid file path detected', {
            documentId,
            filePath: document.file_path,
            user: req.user?.employee_code
        });
        throw new ValidationError("Đường dẫn file không hợp lệ.");
    }

    // Securely resolve the absolute path
    const absolutePath = getAbsoluteFilePath(document.file_path);

    if (!absolutePath) {
        logger.error('Path traversal attempt blocked', {
            documentId,
            filePath: document.file_path,
            user: req.user?.employee_code,
            ip: req.ip
        });
        throw new ValidationError("Truy cập file bị từ chối.");
    }

    // Check if file exists
    if (!fs.existsSync(absolutePath)) {
        logger.warn('File not found on server', {
            documentId,
            absolutePath,
            user: req.user?.employee_code
        });
        throw new NotFoundError("File không tồn tại trên server.");
    }

    // Additional security check: verify file is actually a file (not directory)
    const stats = fs.statSync(absolutePath);
    if (!stats.isFile()) {
        logger.error('Attempted to download non-file', {
            documentId,
            absolutePath,
            user: req.user?.employee_code,
            ip: req.ip
        });
        throw new ValidationError("Truy cập file bị từ chối.");
    }

    // Set proper headers for Vietnamese filename download
    const originalFilename = document.original_filename || 'download';
    
    // Create ASCII-safe filename for the basic filename parameter
    const asciiSafeFilename = originalFilename.replace(/[^\x20-\x7E]/g, '_');
    
    // Use RFC 5987 encoding for Unicode filenames
    const encodedFilename = encodeURIComponent(originalFilename);

    // Set secure headers for download with proper Vietnamese character support
    res.setHeader('Content-Disposition', `attachment; filename="${asciiSafeFilename}"; filename*=UTF-8''${encodedFilename}`);
    res.setHeader('Content-Type', document.mime_type || 'application/octet-stream');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');

    if (document.file_size && document.file_size > 0) {
        res.setHeader('Content-Length', document.file_size);
    }

    // Log successful download attempt
    logger.info('File download initiated', {
        documentId,
        user: req.user?.employee_code,
        filename: originalFilename,
        size: document.file_size
    });

    // Stream file to client with error handling
    const fileStream = fs.createReadStream(absolutePath);

    fileStream.on('error', (error) => {
        logger.error('File stream error during download', {
            documentId,
            error: error.message,
            user: req.user?.employee_code
        });
        if (!res.headersSent) {
            res.status(500).json({
                success: false,
                message: "Lỗi khi đọc file."
            });
        }
    });

    fileStream.on('end', () => {
        logger.info('File download completed', {
            documentId,
            user: req.user?.employee_code
        });
    });

    fileStream.pipe(res);

});

/**
 * Xem trước file tài liệu (preview) - SECURE VERSION
 */
exports.previewDocument = asyncHandler(async (req, res) => {
    const documentId = req.params.documentId;

    // Validate document ID format
    if (!documentId || typeof documentId !== 'string' || !/^[a-zA-Z0-9\-]+$/.test(documentId)) {
        logger.warn('Invalid document ID format for preview', {
            documentId,
            user: req.user?.employee_code,
            ip: req.ip
        });
        throw new ValidationError("ID tài liệu không hợp lệ.");
    }

    const document = await caseService.getDocumentById(documentId);

    if (!document) {
        logger.warn('Document not found for preview', {
            documentId,
            user: req.user?.employee_code
        });
        throw new NotFoundError("Không tìm thấy tài liệu.");
    }

    const fs = require('fs');
    const { getAbsoluteFilePath, validateAndSanitizePath, getFilePathBreadcrumb } = require('../utils/filePathHelper');

    // Validate and sanitize the file path from database
    if (!document.file_path || !validateAndSanitizePath(document.file_path)) {
        console.error(`[SECURITY] Invalid or malicious file path detected for preview: ${document.file_path}`);
        throw new ValidationError("Đường dẫn file không hợp lệ.");
    }

    // Securely resolve the absolute path
    const absolutePath = getAbsoluteFilePath(document.file_path);

    if (!absolutePath) {
        logger.error('Path traversal attempt blocked for preview', {
            documentId,
            filePath: document.file_path,
            user: req.user?.employee_code,
            ip: req.ip
        });
        throw new ValidationError("Truy cập file bị từ chối.");
    }

    // Check if file exists
    if (!fs.existsSync(absolutePath)) {
        logger.warn('File not found for preview', {
            documentId,
            absolutePath,
            user: req.user?.employee_code
        });
        throw new NotFoundError("File không tồn tại trên server.");
    }

    // Additional security check: verify file is actually a file (not directory)
    const stats = fs.statSync(absolutePath);
    if (!stats.isFile()) {
        console.error(`[SECURITY] Attempted to preview non-file: ${absolutePath}`);
        throw new ValidationError("Truy cập file bị từ chối.");
    }

    // Set proper headers for Vietnamese filename preview
    const originalFilename = document.original_filename || 'preview';
    
    // Create ASCII-safe filename for the basic filename parameter
    const asciiSafeFilename = originalFilename.replace(/[^\x20-\x7E]/g, '_');
    
    // Use RFC 5987 encoding for Unicode filenames
    const encodedFilename = encodeURIComponent(originalFilename);

    // Set secure headers for preview (inline display) with proper Vietnamese character support
    res.setHeader('Content-Type', document.mime_type || 'application/octet-stream');
    res.setHeader('Content-Disposition', `inline; filename="${asciiSafeFilename}"; filename*=UTF-8''${encodedFilename}`);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('Cache-Control', 'public, max-age=3600');

    if (document.file_size && document.file_size > 0) {
        res.setHeader('Content-Length', document.file_size);
    }

    // Log successful preview attempt
    console.log(`[SECURITY] File preview initiated - Document: ${documentId}, User: ${req.user?.id || 'unknown'}, File: ${absolutePath}`);

    // Stream file to client with error handling
    const fileStream = fs.createReadStream(absolutePath);

    fileStream.on('error', (error) => {
        console.error(`[SECURITY] File stream error for preview ${documentId}:`, error);
        if (!res.headersSent) {
            res.status(500).json({
                success: false,
                message: "Lỗi khi đọc file."
            });
        }
    });

    fileStream.on('end', () => {
        console.log(`[SECURITY] File preview completed - Document: ${documentId}`);
    });

    fileStream.pipe(res);

});

/**
 * Xóa tài liệu
 */
exports.deleteDocument = asyncHandler(async (req, res) => {
    const documentId = req.params.documentId;
    const deleter = req.user; // Lấy thông tin từ token

    if (!documentId) {
        throw new ValidationError("ID tài liệu không hợp lệ.");
    }

    const result = await caseService.deleteDocumentById(documentId, deleter);

    res.status(200).json({
        success: true,
        message: "Xóa tài liệu thành công!",
    });
});

/**
 * Lấy cấu trúc thư mục của CBTD hiện tại
 */
exports.getMyFileStructure = asyncHandler(async (req, res) => {
    const currentUser = req.user;
    const cbtdName = currentUser.fullname || currentUser.employee_code;

    const structure = fileManagerService.getDirectoryStructure(cbtdName);

    res.status(200).json({
        success: true,
        message: "Lấy cấu trúc thư mục thành công!",
        data: structure
    });
});

/**
 * Lấy thống kê storage (dành cho admin/manager)
 */
exports.getStorageStats = asyncHandler(async (req, res) => {
    const stats = fileManagerService.getStorageStats();

    res.status(200).json({
        success: true,
        message: "Lấy thống kê storage thành công!",
        data: stats
    });
});
