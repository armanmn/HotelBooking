import express from "express";
import { verifyToken, verifyAdmin, verifyHotelPartner } from "../middlewares/authMiddleware.js";
import {
  createHotel,
  updateHotel,
  deleteHotel,
  getHotelById,
  getAllHotels,
  searchHotels,
  approveHotel,
  getAvailableCities
} from "../controllers/hotelController.js";

const router = express.Router();

// ✅ Ավելացնում ենք որոնման API-ն
router.get("/search", searchHotels);

router.get("/locations", getAvailableCities);

// ✅ Ստեղծել նոր հյուրանոց (Միայն B2B Hotel Partner կամ Admin)
router.post("/", verifyToken, verifyHotelPartner, createHotel);

// ✅ Թարմացնել հյուրանոց (Միայն սեփականատերը կամ Admin-ը)
router.put("/:id", verifyToken, verifyHotelPartner, updateHotel);

// ✅ Ջնջել հյուրանոց (Միայն Admin կամ սեփականատերը)
router.delete("/:id", verifyToken, verifyHotelPartner, deleteHotel);

// ✅ Ստանալ բոլոր հյուրանոցները (B2C, B2B, Office User)
router.get("/", verifyToken, getAllHotels);

// ✅ Ստանալ կոնկրետ հյուրանոց ըստ ID-ի
router.get("/:id", getHotelById);

// ✅ Ադմին կարող է հաստատել հյուրանոցը
router.patch("/:id/approve", verifyToken, verifyAdmin, approveHotel);

export default router;