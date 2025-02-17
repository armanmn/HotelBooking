// routes/authRoutes.js

const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

// Գրանցում
router.post('/register', authController.register);

// Մուտք
router.post('/login', authController.login);

module.exports = router;