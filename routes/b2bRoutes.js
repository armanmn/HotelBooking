import express from "express";
import { verifyToken, verifyHotelPartner, verifySalesPartner } from "../middlewares/authMiddleware.js";
import {
  createHotel,
  updateHotel,
  deleteHotel,
  getMyHotels,
  createRoom,
  updateRoom,
  deleteRoom,
  getAvailableHotels, // Վաճառքի համար հյուրանոցների ցուցակ
  createB2BBooking, // Վաճառքի գործարքի ստեղծում
} from "../controllers/b2bController.js";

const router = express.Router();

// 🏨 Հյուրանոցների կառավարում (B2B Partner - Hotel Owner)
router.post("/hotels", verifyToken, verifyHotelPartner, createHotel);
router.put("/hotels/:id", verifyToken, verifyHotelPartner, updateHotel);
router.delete("/hotels/:id", verifyToken, verifyHotelPartner, deleteHotel);
router.get("/hotels", verifyToken, verifyHotelPartner, getMyHotels);

// 🛏️ Սենյակների կառավարում (B2B Partner - Hotel Owner)
router.post("/hotels/:hotelId/rooms", verifyToken, verifyHotelPartner, createRoom);
router.put("/hotels/:hotelId/rooms/:roomId", verifyToken, verifyHotelPartner, updateRoom);
router.delete("/hotels/:hotelId/rooms/:roomId", verifyToken, verifyHotelPartner, deleteRoom);

// 📌 **B2B Sales Partner (Resellers) API-ներ**
// ✅ Վերավաճառող գործընկերները կարող են տեսնել հյուրանոցների տվյալները
router.get("/sales/hotels", verifyToken, verifySalesPartner, getAvailableHotels);

// ✅ Վերավաճառող գործընկերները կարող են ստեղծել ամրագրում (booking) իրենց հաճախորդների համար
router.post("/sales/bookings", verifyToken, verifySalesPartner, createB2BBooking);

export default router;
