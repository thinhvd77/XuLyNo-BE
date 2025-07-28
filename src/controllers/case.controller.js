const caseService = require("../services/case.service");
const { validationResult } = require("express-validator");
const multer = require("multer");

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

        res.status(200).json(debtCase);
    } catch (error) {
        console.error("Lỗi khi lấy thông tin hồ sơ:", error);
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
        console.log('File:', file);
        console.log('Document type:', documentType);
        

        if (!file) {
            return res
                .status(400)
                .json({
                    success: false,
                    message: "Vui lòng chọn một file để tải lên.",
                });
        }

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
        
        if (!caseId) {
            return res.status(400).json({
                success: false,
                message: "ID case không hợp lệ."
            });
        }

        const documents = await caseService.getDocumentsByCase(caseId);

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
        
        // Kiểm tra file có tồn tại không
        if (!fs.existsSync(document.file_path)) {
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
        const fileStream = fs.createReadStream(document.file_path);
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
        
        console.log('Document file path:', document.file_path);
        
        // Kiểm tra file có tồn tại không
        if (!fs.existsSync(document.file_path)) {
            console.log('File does not exist:', document.file_path);
            return res.status(404).json({
                success: false,
                message: "File không tồn tại trên server."
            });
        }

        // Log file info
        console.log('Serving file:', {
            filename: document.original_filename,
            mime_type: document.mime_type,
            size: document.file_size
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
        const fileStream = fs.createReadStream(document.file_path);
        
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
