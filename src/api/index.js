const express = require('express');
const router = express.Router();
const authRoutes = require('./auth.routes');
const caseRoutes = require('./case.routes');

router.use('/auth', authRoutes);
router.use('/cases', caseRoutes);
// router.use('/users', userRoutes); // Thêm các route khác ở đây

module.exports = router;