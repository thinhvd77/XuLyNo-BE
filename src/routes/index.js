const express = require('express');
const router = express.Router();

// GET / route
router.get('/', (req, res) => {
  res.send('Welcome to your Express.js app!');
});

module.exports = router;
