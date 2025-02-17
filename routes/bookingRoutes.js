// routes/bookingRoutes.js

const express = require('express');
const router = express.Router();
const bookingController = require('../controllers/bookingController');
const authMiddleware = require('../middleware/authMiddleware');

// Ստեղծել նոր ամրագրում (պաշտպանված ռոուտ)
router.post('/', authMiddleware, bookingController.createBooking);

// Ստանալ մուտք գործած օգտատիրոջ ամրագրումները (պաշտպանված ռոուտ)
router.get('/my-bookings', authMiddleware, bookingController.getUserBookings);

// Չեղարկել ամրագրում ըստ ID-ի (պաշտպանված ռոուտ)
router.delete('/:id', authMiddleware, bookingController.cancelBooking);

module.exports = router;