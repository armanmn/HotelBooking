import express from "express";
import { 
  verifyToken, 
  verifyAdmin, 
  verifyHotelPartner, 
  verifySalesPartner 
} from "../middlewares/authMiddleware.js";

import { 
  getAllUsers, 
  getHotelPartnerBookings, 
  getB2BReservations, 
  updateSalesPartnerMarkup, 
  updateB2CMarkup, 
  createB2BUser, 
  deleteUser,
  createOfficeOrFinanceUser
} from "../controllers/userController.js";

import { verifyRole } from "../middlewares/roleMiddleware.js";

const router = express.Router();

// ✅ Ստանալ բոլոր user-ներին (Admin & Office User)
router.get("/", verifyToken, verifyRole(["admin", "office_user"]), getAllUsers);

// 🔹 Վերադարձնում է B2B Sales Partner-ի ամրագրումները
router.get("/b2b/reservations", verifyToken, verifySalesPartner, getB2BReservations);

// 🔹 Վերադարձնում է B2B Hotel Partner-ի ամրագրումները
router.get("/b2b/hotel-bookings", verifyToken, verifyHotelPartner, getHotelPartnerBookings);

// ✅ Թարմացնել B2B Sales Partner-ի անհատական markup (Միայն Admin)
router.patch("/b2b/sales-partner/:id/markup", verifyToken, verifyAdmin, updateSalesPartnerMarkup);

// ✅ Թարմացնել B2C-ի ընդհանուր markup (Միայն Admin)
router.patch("/b2c/markup", verifyToken, verifyAdmin, updateB2CMarkup);

// ✅ Ստեղծել B2B User (Միայն Admin)
router.post("/b2b/create", verifyToken, verifyAdmin, createB2BUser);

// ✅ Ստեղծել Office User կամ Finance User (Միայն Admin)
router.post("/admin/create-user", verifyToken, verifyAdmin, createOfficeOrFinanceUser);

// ✅ Ջնջել user (Միայն Admin)
router.delete("/:id", verifyToken, verifyAdmin, deleteUser);

export default router;