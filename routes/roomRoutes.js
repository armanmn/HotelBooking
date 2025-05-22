import express from "express";
import { verifyToken, verifyAdmin, verifyHotelPartner } from "../middlewares/authMiddleware.js";
import {
  createRoom,
  updateRoom,
  deleteRoom,
  getRoomsByHotel,
  getRoomById,
  getPublicRoomById
} from "../controllers/roomController.js";

const router = express.Router();

// ✅ Ստեղծել նոր սենյակ (Միայն հյուրանոցի սեփականատերը/Admin)
router.post("/:hotelId", verifyToken, verifyHotelPartner, createRoom);

// ✅ Թարմացնել սենյակի տվյալները (Միայն հյուրանոցի սեփականատերը/Admin)
router.put("/:roomId", verifyToken, verifyHotelPartner, updateRoom);

// ✅ Ջնջել սենյակ (Միայն հյուրանոցի սեփականատերը/Admin)
router.delete("/:roomId", verifyToken, verifyHotelPartner, deleteRoom);

// ✅ Ստանալ հյուրանոցի բոլոր սենյակները
router.get("/hotel/:hotelId", getRoomsByHotel);

// ✅ Ստանալ կոնկրետ սենյակ ըստ ID-ի
router.get("/:roomId", verifyToken, getRoomById);       // 🔒 Protected B2B
router.get("/public/:roomId", getPublicRoomById);       // 🌐 Public B2C

export default router;