const express = require('express');
const { healthCheck, detailedHealthCheck } = require('../controllers/health.controller');

const router = express.Router();

// Simple health check endpoint
router.get('/', healthCheck);

// Detailed health check for monitoring
router.get('/detailed', detailedHealthCheck);

module.exports = router;
