import express from "express";
import {
  createOffer,
  updateOffer,
  getOffersByHotelId,
  getOfferById,
  deleteOffer,
} from "../controllers/offerController.js";

const router = express.Router();

router.post("/", createOffer);                     // ➕ Create
router.put("/:id", updateOffer);                   // 🔄 Update
router.get("/hotel/:hotelId", getOffersByHotelId); // 🏨 Offers for hotel
router.get("/:id", getOfferById);                  // 🔍 One offer
router.delete("/:id", deleteOffer);                // ❌ Delete

export default router;