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
  deleteUser,
  updateBalance,
  updateAvatar,
  removeAvatar,
  createOfficeOrFinanceUser,
  getUserById,
  updateUserProfile
} from "../controllers/userController.js";

import { verifyRole } from "../middlewares/roleMiddleware.js";
import multer from "multer";

const upload = multer({ dest: "uploads/avatars/" });

const router = express.Router();

// ✅ Ստանալ բոլոր user-ներին (Admin & Office User)
router.get("/", verifyToken, verifyRole(["admin", "office_user", "finance_user"]), getAllUsers);

router.get("/:id", verifyToken, verifyAdmin, getUserById);

// ✅ Ստեղծել Office User կամ Finance User (Միայն Admin)
router.post("/admin/create-user", verifyToken, verifyAdmin, createOfficeOrFinanceUser);

// ✅ Վերադարձնել B2B Sales Partner-ի ամրագրումները
router.get("/b2b/reservations", verifyToken, verifySalesPartner, getB2BReservations);

// ✅ Վերադարձնել B2B Hotel Partner-ի ամրագրումները
router.get("/b2b/hotel-bookings", verifyToken, verifyHotelPartner, getHotelPartnerBookings);

// ✅ Թարմացնել B2B Sales Partner-ի անհատական markup (Միայն Admin)
router.patch("/b2b/sales-partner/:id/markup", verifyToken, verifyAdmin, updateSalesPartnerMarkup);

// ✅ Թարմացնել B2B Sales Partner-ի Balance-ը (Միայն Admin կամ Finance User)
router.patch("/b2b/sales-partner/:id/balance", verifyToken, verifyAdmin, updateBalance);

// ✅ Թարմացնել B2C-ի ընդհանուր markup (Միայն Admin)
router.patch("/b2c/markup", verifyToken, verifyAdmin, updateB2CMarkup);

// // ✅ Թարմացնել avatar (Միայն B2B, Office, Finance, Admin)
// router.patch("/update-avatar", verifyToken, updateAvatar);

// ✅ User-ը (նաև admin-ը) փոխում է իր avatar-ը (ֆայլ upload է արվում)
router.patch("/update-avatar", verifyToken, upload.single("avatar"), updateAvatar);

// ✅ Admin-ը update է անում այլ user-ի avatar (ֆայլ upload է արվում)
router.patch("/:id/update-avatar", verifyToken, verifyAdmin, upload.single("avatar"), updateAvatar);

// ✅ ՆՈՐ route – Ջնջում է avatar-ը (ՈՉ մի ֆայլ չի պահանջում)
router.patch("/remove-avatar", verifyToken, removeAvatar);

// ✅ Admin-ը թարմացնում է user-ի մյուս տվյալները։
router.patch("/:id", verifyToken, verifyAdmin, updateUserProfile);

// ✅ Ջնջել user (Միայն Admin)
router.delete("/:id", verifyToken, verifyAdmin, deleteUser);


export default router;