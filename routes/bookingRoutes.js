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

// 🔹 Ստեղծել ամրագրում (B2C & B2B)
router.post("/", verifyToken, createBooking);

// 🔹 Ստանալ օգտագործողի բոլոր ամրագրումները
router.get("/", verifyToken, getUserBookings);

// 🔹 Ստանալ կոնկրետ ամրագրում ըստ ID-ի
router.get("/:id", verifyToken, getBookingById);

// 🔹 Չեղարկել ամրագրումը
router.put("/:id/cancel", verifyToken, cancelBooking);

router.patch("/:id/pay", verifyToken, markBookingAsPaid);

export default router;