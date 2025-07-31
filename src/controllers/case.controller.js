const caseService = require("../services/case.service");
const fileManagerService = require("../services/fileManager.service");
const { validationResult } = require("express-validator");
const multer = require("multer");
const { moveFileToFinalDestination, getDocumentTypeFolder } = require("../config/multer.config");

/**
 * MỚI: Xử lý request upload file Excel
 */
exports.importCases = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: "Vui lòng tải lên một file Excel.",
            });
        }

        const result = await caseService.importCasesFromExcel(req.file.buffer);

        res.status(200).json({
            success: true,
            message: "Import hoàn tất!",
            data: result,
        });
    } catch (error) {
        console.error("Lỗi khi import file Excel:", error);
        res.status(500).json({
            success: false,
            message: "Đã có lỗi xảy ra trên server.",
        });
    }
};

exports.importExternalCases = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: "Vui lòng tải lên một file Excel.",
            });
        }

        const result = await caseService.importExternalCasesFromExcel(
            req.file.buffer
        );

        res.status(200).json({
            success: true,
            message: "Import hoàn tất!",
            data: result,
        });
    } catch (error) {
        console.error("Lỗi khi import file Excel:", error);
        res.status(500).json({
            success: false,
            message: "Đã có lỗi xảy ra trên server.",
        });
    }
};

/**
 * MỚI: Lấy danh sách hồ sơ của người dùng đang đăng nhập
 */
exports.getMyCases = async (req, res) => {
    try {
        // req.user được Passport.js thêm vào sau khi xác thực JWT thành công
        const employeeCode = req.user.employee_code;

        if (!employeeCode) {
            return res
                .status(400)
                .json({ message: "Không tìm thấy thông tin nhân viên." });
        }

        const cases = await caseService.findCasesByEmployeeCode(employeeCode);
        res.status(200).json(cases);
    } catch (error) {
        console.error("Lỗi khi lấy danh sách hồ sơ:", error);
        res.status(500).json({ message: "Đã có lỗi xảy ra trên server." });
    }
};

/**
 * MỚI: Lấy tất cả danh sách hồ sơ (dành cho Ban Giám Đốc)
 */
exports.getAllCases = async (req, res) => {
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
            employee_code = ''
        } = req.query;
        
        const filters = { search, type, status, branch_code, employee_code };
        const sorting = { sortBy, sortOrder };
        
        const cases = await caseService.findAllCases(page, filters, parseInt(limit), sorting);
        res.status(200).json(cases);
    } catch (error) {
        console.error("Lỗi khi lấy danh sách tất cả hồ sơ:", error);
        res.status(500).json({ message: "Đã có lỗi xảy ra trên server." });
    }
};

/**
 * MỚI: Lấy danh sách hồ sơ theo phòng ban (dành cho Manager/Deputy Manager)
 * Hiển thị cases được quản lý bởi CBTD có cùng phòng ban và cùng branch_code
 */
exports.getDepartmentCases = async (req, res) => {
    try {
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
    } catch (error) {
        console.error("Lỗi khi lấy danh sách hồ sơ theo phòng ban:", error);
        res.status(500).json({ message: "Đã có lỗi xảy ra trên server." });
    }
};

/**
 * MỚI: Lấy thông tin chi tiết của một hồ sơ theo ID
 * @param {string} req.params.caseId - ID của hồ sơ cần lấy thông tin
 */
exports.getCaseDetails = async (req, res) => {
    try {
        const caseId = req.params.caseId;
        if (!caseId) {
            return res.status(400).json({ message: "ID hồ sơ không hợp lệ." });
        }

        const debtCase = await caseService.getCaseById(caseId);
        if (!debtCase) {
            return res.status(404).json({ message: "Hồ sơ không tìm thấy." });
        }

        res.status(200).json({
            success: true,
            data: debtCase
        });
    } catch (error) {
        console.error("Lỗi khi lấy thông tin hồ sơ:", error);
        res.status(500).json({ message: "Đã có lỗi xảy ra trên server." });
    }
};

/**
 * MỚI: Lấy danh sách cập nhật của hồ sơ
 */
exports.getCaseUpdates = async (req, res) => {
    try {
        const caseId = req.params.caseId;
        if (!caseId) {
            return res.status(400).json({ message: "ID hồ sơ không hợp lệ." });
        }

        const updates = await caseService.getCaseUpdates(caseId);
        res.status(200).json({
            success: true,
            data: updates,
        });
    } catch (error) {
        console.error("Lỗi khi lấy danh sách cập nhật:", error);
        res.status(500).json({ message: "Đã có lỗi xảy ra trên server." });
    }
};

/**
 * MỚI: Tạo một cập nhật mới cho hồ sơ
 */
exports.createCaseUpdate = async (req, res) => {
    // Kiểm tra validation
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    try {
        const caseId = req.params.caseId;
        const { content } = req.body;
        const uploader = req.user; // Lấy thông tin từ token
        console.log(uploader);

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
    } catch (error) {
        // Trả về lỗi cụ thể hơn nếu có
        res.status(400).json({ success: false, message: error.message });
    }
};

/**
 * MỚI: Cập nhật trạng thái hồ sơ
 */
exports.updateCaseStatus = async (req, res) => {
    // Kiểm tra validation
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ 
            success: false,
            errors: errors.array() 
        });
    }

    try {
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
    } catch (error) {
        // Trả về lỗi cụ thể hơn nếu có
        res.status(400).json({ success: false, message: error.message });
    }
};

exports.getCaseUpdateContent = async (req, res) => {
    try {
        const caseId = req.params.caseId;
        const contents = await caseService.getUpdateContentByCase(caseId);

        res.status(201).json({
            success: true,
            message: "Lấy nhật ký xử lý nợ thành công",
            data: contents,
        });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

exports.uploadDocument = async (req, res) => {
    try {
        const caseId = req.params.caseId;
        const uploader = req.user;
        const file = req.file;
        const documentType = req.body.document_type || 'other'; // Lấy document_type từ request body
        console.log('=== DEBUG UPLOAD ===');
        console.log('File:', file ? file.filename : 'No file');
        console.log('req.body:', req.body);
        console.log('Document type from body:', req.body.document_type);
        console.log('Final document type:', documentType);
        console.log('Uploader:', uploader);
        console.log('===================');
        

        if (!file) {
            return res
                .status(400)
                .json({
                    success: false,
                    message: "Vui lòng chọn một file để tải lên.",
                });
        }

        // Lấy thông tin case để move file đến đúng vị trí
        const AppDataSource = require('../config/dataSource');
        const caseRepository = AppDataSource.getRepository("DebtCase");
        const caseData = await caseRepository.findOneBy({ case_id: caseId });
        
        if (!caseData) {
            return res.status(404).json({
                success: false,
                message: "Không tìm thấy case.",
            });
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
    } catch (error) {
        console.error("Lỗi khi tải file:", error);
        
        // Xử lý lỗi từ multer
        if (error instanceof multer.MulterError) {
            if (error.code === 'LIMIT_FILE_SIZE') {
                return res.status(400).json({
                    success: false,
                    message: "File quá lớn. Kích thước tối đa là 50MB.",
                });
            } else if (error.code === 'LIMIT_FILE_COUNT') {
                return res.status(400).json({
                    success: false,
                    message: "Quá nhiều file. Tối đa 10 file cùng lúc.",
                });
            }
        }
        
        res.status(500).json({
            success: false,
            message: error.message || "Đã có lỗi xảy ra trên server.",
        });
    }
};

/**
 * Lấy danh sách tài liệu đã tải lên cho một case
 */
exports.getCaseDocuments = async (req, res) => {
    try {
        const caseId = req.params.caseId;
        console.log('getCaseDocuments called with caseId:', caseId);
        
        if (!caseId) {
            return res.status(400).json({
                success: false,
                message: "ID case không hợp lệ."
            });
        }

        const documents = await caseService.getDocumentsByCase(caseId);
        console.log('Documents found:', documents.length);
        console.log('Sample document:', documents[0]);

        res.status(200).json({
            success: true,
            message: "Lấy danh sách tài liệu thành công!",
            data: documents,
        });
    } catch (error) {
        console.error("Lỗi khi lấy danh sách tài liệu:", error);
        res.status(500).json({
            success: false,
            message: "Đã có lỗi xảy ra trên server.",
        });
    }
};

/**
 * Download file tài liệu
 */
exports.downloadDocument = async (req, res) => {
    try {
        const documentId = req.params.documentId;
        
        if (!documentId) {
            return res.status(400).json({
                success: false,
                message: "ID tài liệu không hợp lệ."
            });
        }

        const document = await caseService.getDocumentById(documentId);
        
        if (!document) {
            return res.status(404).json({
                success: false,
                message: "Không tìm thấy tài liệu."
            });
        }

        const path = require('path');
        const fs = require('fs');
        const { getAbsoluteFilePath } = require('../utils/filePathHelper');
        
        // Chuyển từ relative path sang absolute path
        const absolutePath = getAbsoluteFilePath(document.file_path);
        
        // Kiểm tra file có tồn tại không
        if (!fs.existsSync(absolutePath)) {
            console.log('File not found at:', absolutePath);
            return res.status(404).json({
                success: false,
                message: "File không tồn tại trên server."
            });
        }

        // Set headers cho download với UTF-8 encoding
        const encodedFilename = encodeURIComponent(document.original_filename);
        res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodedFilename}`);
        res.setHeader('Content-Type', document.mime_type);
        res.setHeader('Content-Length', document.file_size);
        
        // Stream file về client
        const fileStream = fs.createReadStream(absolutePath);
        fileStream.on('error', (error) => {
            console.error('File stream error:', error);
            if (!res.headersSent) {
                res.status(500).json({
                    success: false,
                    message: "Lỗi khi đọc file."
                });
            }
        });
        
        fileStream.pipe(res);

    } catch (error) {
        console.error("Lỗi khi download tài liệu:", error);
        if (!res.headersSent) {
            res.status(500).json({
                success: false,
                message: "Đã có lỗi xảy ra trên server.",
            });
        }
    }
};

/**
 * Xem trước file tài liệu (preview)
 */
exports.previewDocument = async (req, res) => {
    try {
        const documentId = req.params.documentId;
        console.log('Preview request for document:', documentId);
        
        if (!documentId) {
            console.log('Invalid document ID');
            return res.status(400).json({
                success: false,
                message: "ID tài liệu không hợp lệ."
            });
        }

        const document = await caseService.getDocumentById(documentId);
        
        if (!document) {
            console.log('Document not found:', documentId);
            return res.status(404).json({
                success: false,
                message: "Không tìm thấy tài liệu."
            });
        }

        const path = require('path');
        const fs = require('fs');
        const { getAbsoluteFilePath, getFilePathBreadcrumb } = require('../utils/filePathHelper');
        
        // Chuyển từ relative path sang absolute path
        const absolutePath = getAbsoluteFilePath(document.file_path);
        
        console.log('Document file paths:', {
            relativePath: document.file_path,
            absolutePath: absolutePath,
            breadcrumb: getFilePathBreadcrumb(document.file_path)
        });
        
        // Kiểm tra file có tồn tại không
        if (!fs.existsSync(absolutePath)) {
            console.log('File does not exist:', absolutePath);
            return res.status(404).json({
                success: false,
                message: "File không tồn tại trên server."
            });
        }

        // Log file info
        console.log('Serving file:', {
            filename: document.original_filename,
            mime_type: document.mime_type,
            size: document.file_size,
            path: getFilePathBreadcrumb(document.file_path)
        });

        // Set headers cho preview (inline thay vì attachment) với UTF-8 encoding
        const encodedFilename = encodeURIComponent(document.original_filename);
        res.setHeader('Content-Type', document.mime_type || 'application/octet-stream');
        res.setHeader('Content-Disposition', `inline; filename*=UTF-8''${encodedFilename}`);
        res.setHeader('Cache-Control', 'public, max-age=3600');
        
        if (document.file_size) {
            res.setHeader('Content-Length', document.file_size);
        }
        
        // Thêm header để bypass một số security software
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('X-Frame-Options', 'SAMEORIGIN');
        
        // Stream file về client
        const fileStream = fs.createReadStream(absolutePath);
        
        fileStream.on('error', (error) => {
            console.error('File stream error:', error);
            if (!res.headersSent) {
                res.status(500).json({
                    success: false,
                    message: "Lỗi khi đọc file."
                });
            }
        });
        
        fileStream.on('open', () => {
            console.log('File stream opened successfully');
        });
        
        fileStream.on('end', () => {
            console.log('File stream ended');
        });
        
        fileStream.pipe(res);

    } catch (error) {
        console.error("Lỗi khi xem trước tài liệu:", error);
        if (!res.headersSent) {
            res.status(500).json({
                success: false,
                message: "Đã có lỗi xảy ra trên server.",
            });
        }
    }
};

/**
 * Xóa tài liệu
 */
exports.deleteDocument = async (req, res) => {
    try {
        const documentId = req.params.documentId;
        const deleter = req.user; // Lấy thông tin từ token
        
        if (!documentId) {
            return res.status(400).json({
                success: false,
                message: "ID tài liệu không hợp lệ."
            });
        }

        const result = await caseService.deleteDocumentById(documentId, deleter);

        res.status(200).json({
            success: true,
            message: "Xóa tài liệu thành công!",
        });
    } catch (error) {
        console.error("Lỗi khi xóa tài liệu:", error);
        res.status(500).json({
            success: false,
            message: error.message || "Đã có lỗi xảy ra trên server.",
        });
    }
};

/**
 * Lấy cấu trúc thư mục của CBTD hiện tại
 */
exports.getMyFileStructure = async (req, res) => {
    try {
        const currentUser = req.user;
        const cbtdName = currentUser.fullname || currentUser.employee_code;
        
        const structure = fileManagerService.getDirectoryStructure(cbtdName);
        
        res.status(200).json({
            success: true,
            message: "Lấy cấu trúc thư mục thành công!",
            data: structure
        });
    } catch (error) {
        console.error("Lỗi khi lấy cấu trúc thư mục:", error);
        res.status(500).json({
            success: false,
            message: "Đã có lỗi xảy ra trên server.",
        });
    }
};

/**
 * Lấy thống kê storage (dành cho admin/manager)
 */
exports.getStorageStats = async (req, res) => {
    try {
        const stats = fileManagerService.getStorageStats();
        
        res.status(200).json({
            success: true,
            message: "Lấy thống kê storage thành công!",
            data: stats
        });
    } catch (error) {
        console.error("Lỗi khi lấy thống kê storage:", error);
        res.status(500).json({
            success: false,
            message: "Đã có lỗi xảy ra trên server.",
        });
    }
};
