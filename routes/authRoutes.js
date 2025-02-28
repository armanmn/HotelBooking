import express from "express";
import { 
  registerB2CUser, 
  loginUser, 
  logoutUser, 
  getUserProfile, 
  updateUserProfile, 
  changePassword, 
  checkAuthStatus  // ✅ Ավելացվել է checkAuthStatus ֆունկցիան
} from "../controllers/authController.js";
import { verifyToken } from "../middlewares/authMiddleware.js";

const router = express.Router();

// ✅ Գրանցում (Միայն B2C)
router.post("/register", registerB2CUser);

// ✅ Մուտք
router.post("/login", loginUser);

// ✅ Logout (Հանում ենք httpOnly cookie-ն)
router.post("/logout", logoutUser);

// ✅ Ստուգում է՝ արդյոք օգտատերը մուտք է գործել
router.get("/check", verifyToken, checkAuthStatus); // ✅ Այստեղ ավելացվել է checkAuthStatus ֆունկցիան

// ✅ Վերցնել օգտատիրոջ պրոֆիլը
router.get("/profile", verifyToken, getUserProfile);

// ✅ Թարմացնել օգտատիրոջ տվյալները (Անուն & Email)
router.patch("/profile", verifyToken, updateUserProfile);

// ✅ Փոխել գաղտնաբառը
router.patch("/change-password", verifyToken, changePassword);

export default router;