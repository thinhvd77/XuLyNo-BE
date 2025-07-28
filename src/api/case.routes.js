const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const passport = require('passport');
const multer = require('multer'); // MỚI: Import multer
const caseController = require('../controllers/case.controller');
const { protect, authorize } = require('../middleware/auth.middleware');
const uploadFileToDisk = require('../config/multer.config');

// MỚI: Cấu hình multer để lưu file vào bộ nhớ
const memoryStorage = multer.memoryStorage();
const uploadExcelInMemory  = multer({ storage: memoryStorage });

// MỚI: Route để lấy danh sách hồ sơ của CBTD
// GET /api/cases/my-cases
router.get(
    '/my-cases',
    passport.authenticate('jwt', { session: false }), // Bảo vệ route, yêu cầu token hợp lệ
    caseController.getMyCases
);

router.post(
    '/import-internal',
    protect,
    authorize('administrator', 'manager'), // Chỉ Admin được import
    uploadExcelInMemory.single('casesFile'), // Middleware của multer, 'casesFile' là tên field trong form-data
    caseController.importCases
);

router.post(
    '/import-external',
    protect,
    authorize('administrator', 'manager'), // Chỉ Admin được import
    uploadExcelInMemory.single('casesFile'), // Middleware của multer, 'externalCasesFile' là tên field trong form-data
    caseController.importExternalCases
);

router.get(
    '/contents/:caseId',
    protect,
    caseController.getCaseUpdateContent
)

router.post(
    '/:caseId/updates',
    protect, // Yêu cầu đăng nhập
    body('content').notEmpty().withMessage('Nội dung cập nhật không được để trống.'), // Validation
    caseController.createCaseUpdate
);

// Route để cập nhật trạng thái case
router.patch(
    '/:caseId/status',
    protect, // Yêu cầu đăng nhập
    authorize('employee', 'manager', 'administrator'), // Các vai trò được phép truy cập
    body('status').isIn(['Mới', 'Đang thu hồi nợ', 'Đang khởi kiện', 'Đang chờ xét xử', 'Đang chờ thi hành án', 'Đang thi hành án', 'Hoàn tất']).withMessage('Trạng thái không hợp lệ.'),
    caseController.updateCaseStatus
);

router.post(
  '/:caseId/documents',
  protect, // Yêu cầu đăng nhập
  uploadFileToDisk.single('documentFile'), // Middleware của multer, 'documentFile' là tên field trong form-data
  caseController.uploadDocument
);

// Route để lấy danh sách tài liệu của một case
router.get(
  '/:caseId/documents',
  protect, // Yêu cầu đăng nhập
  authorize('employee', 'manager', 'administrator'), // Các vai trò được phép truy cập
  caseController.getCaseDocuments
);

// Route để download tài liệu
router.get(
  '/documents/:documentId/download',
  protect, // Yêu cầu đăng nhập
  authorize('employee', 'manager', 'administrator'), // Các vai trò được phép truy cập
  caseController.downloadDocument
);

// Route để xem trước tài liệu
router.get(
  '/documents/:documentId/preview',
  protect, // Yêu cầu đăng nhập
  authorize('employee', 'manager', 'administrator'), // Các vai trò được phép truy cập
  caseController.previewDocument
);

// Route để xóa tài liệu
router.delete(
  '/documents/:documentId',
  protect, // Yêu cầu đăng nhập
  authorize('employee', 'manager', 'administrator'), // Các vai trò được phép truy cập
  caseController.deleteDocument
);

// MỚI: Route để lấy danh sách hồ sơ của CBTD
// GET /api/cases/:caseId
router.get(
    '/:caseId',
    protect,
    authorize('employee', 'manager', 'administrator'), // Các vai trò được phép truy cập
    caseController.getCaseDetails
);


module.exports = router;