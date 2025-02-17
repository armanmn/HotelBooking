// routes/roomRoutes.js

const express = require('express');
const router = express.Router();
const roomController = require('../controllers/roomController');
const authMiddleware = require('../middleware/authMiddleware');

// Ստանալ բոլոր սենյակները
router.get('/', roomController.getAllRooms);

// Ստանալ կոնկրետ սենյակ ըստ ID-ի
router.get('/:id', roomController.getRoomById);

// Ավելացնել նոր սենյակ (միայն ադմինիստրատորների համար)
router.post('/', authMiddleware, roomController.createRoom);

// Թարմացնել սենյակ (միայն ադմինիստրատորների համար)
router.put('/:id', authMiddleware, roomController.updateRoom);

// Ջնջել սենյակ (միայն ադմինիստրատորների համար)
router.delete('/:id', authMiddleware, roomController.deleteRoom);

module.exports = router;