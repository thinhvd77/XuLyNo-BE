const express = require('express');
const router = express.Router();
const passport = require('passport');
const caseController = require('../controllers/case.controller');
// const upload = require('../config/multer.config');

// MỚI: Route để lấy danh sách hồ sơ của CBTD
// GET /api/cases/my-cases
router.get(
    '/my-cases',
    passport.authenticate('jwt', { session: false }), // Bảo vệ route, yêu cầu token hợp lệ
    caseController.getMyCases
);

// Route để upload tài liệu cho một hồ sơ cụ thể
// POST /api/cases/:caseId/documents
// router.post(
//   '/:caseId/documents',
//   passport.authenticate('jwt', { session: false }), 
//   upload.single('document'),
//   caseController.uploadDocument
// );

module.exports = router;