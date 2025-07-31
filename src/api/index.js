const express = require('express');
const router = express.Router();
const authRoutes = require('./auth.routes');
const caseRoutes = require('./case.routes');
const userRoutes = require('./user.routes');
const dashboardRoutes = require('./dashboard.routes');

router.use('/auth', authRoutes);
router.use('/cases', caseRoutes);
router.use('/users', userRoutes);
router.use('/dashboard', dashboardRoutes);

module.exports = router;