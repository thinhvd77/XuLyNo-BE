const express = require("express");
const router = express.Router();
const passport = require("passport");
const authController = require("../controllers/auth.controller");

// URL: POST /api/auth/login
router.post(
    "/login",
    // Middleware của passport để kích hoạt LocalStrategy
    passport.authenticate("local", { session: false }),
    authController.login
);

module.exports = router;
