// routes/paymentRoutes.js

const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const authMiddleware = require('../middleware/authMiddleware');

// Ստեղծել նոր վճարում (պաշտպանված ռոուտ)
router.post('/', authMiddleware, paymentController.createPayment);

// Ստանալ մուտք գործած օգտատիրոջ վճարումները (պաշտպանված ռոուտ)
router.get('/my-payments', authMiddleware, paymentController.getUserPayments);

// Ստանալ բոլոր վճարումները (միայն ադմինիստրատորների համար)
router.get('/', authMiddleware, paymentController.getAllPayments);

module.exports = router;