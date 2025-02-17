// routes/hotelRoutes.js

const express = require('express');
const router = express.Router();
const hotelController = require('../controllers/hotelController');
const authMiddleware = require('../middleware/authMiddleware');

// Ստանալ բոլոր հյուրանոցները
router.get('/', hotelController.getAllHotels);

// Ստանալ կոնկրետ հյուրանոց ըստ ID-ի
router.get('/:id', hotelController.getHotelById);

// Ավելացնել նոր հյուրանոց (միայն ադմինիստրատորների համար)
router.post('/', authMiddleware, hotelController.createHotel);

// Թարմացնել հյուրանոց (միայն ադմինիստրատորների համար)
router.put('/:id', authMiddleware, hotelController.updateHotel);

// Ջնջել հյուրանոց (միայն ադմինիստրատորների համար)
router.delete('/:id', authMiddleware, hotelController.deleteHotel);

module.exports = router;