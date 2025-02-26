import express from "express";
import { verifyToken, verifyAdmin, verifyHotelPartner } from "../middlewares/authMiddleware.js";
import { getRoomsByHotel, createRoom, updateRoom, deleteRoom } from "../controllers/roomController.js";

const router = express.Router();

// ✅ Ստանալ հյուրանոցի բոլոր սենյակները (guest-ները նույնպես կարող են տեսնել)
router.get("/:hotelId/rooms", getRoomsByHotel);

// ✅ Ստեղծել սենյակ (Միայն Hotel Partners)
router.post("/:hotelId/rooms", verifyToken, verifyHotelPartner, createRoom);

// ✅ Թարմացնել սենյակ (Միայն Hotel Partners)
router.put("/:hotelId/rooms/:roomId", verifyToken, verifyHotelPartner, updateRoom);

// ✅ Ջնջել սենյակ (Միայն Hotel Partners)
router.delete("/:hotelId/rooms/:roomId", verifyToken, verifyHotelPartner, deleteRoom);

// ✅ Ստանալ կոնկրետ սենյակի տվյալները
router.get("/:hotelId/rooms/:roomId", getRoomById);

export default router;