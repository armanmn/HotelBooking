import express from "express";
import { verifyToken } from "../middlewares/authMiddleware.js";
import {
  createBooking,
  getUserBookings,
  getBookingById,
  cancelBooking,
  markBookingAsPaid,
} from "../controllers/bookingController.js";

const router = express.Router();

// ✅ Ստեղծել նոր ամրագրում
router.post("/", verifyToken, createBooking);

// ✅ Ստանալ բոլոր ամրագրումները տվյալ օգտատիրոջ համար
router.get("/", verifyToken, getUserBookings);

// ✅ Ստանալ կոնկրետ ամրագրում ըստ ID-ի
router.get("/:id", verifyToken, getBookingById);

// ✅ Չեղարկել ամրագրում
router.put("/:id/cancel", verifyToken, cancelBooking);

// ✅ Նշել որպես վճարված
router.patch("/:id/pay", verifyToken, markBookingAsPaid);

export default router;