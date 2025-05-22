import express from "express";
import { 
  registerB2CUser,
  registerB2BUser,
  loginUser, 
  logoutUser, 
  getUserProfile, 
  updateOwnProfile, 
  changePassword, 
  checkAuthStatus,
  resetPassword,
  requestPasswordReset
} from "../controllers/authController.js";
import { verifyToken, updateLastActive } from "../middlewares/authMiddleware.js";

const router = express.Router();

// ✅ Գրանցում (B2C)
router.post("/register", registerB2CUser);

// ✅ Գրանցում (B2B Hotel Partner / Sales Partner)
router.post("/register-b2b", registerB2BUser);

// ✅ Մուտք
router.post("/login", loginUser);

// ✅ Logout (Հանում ենք httpOnly cookie-ն)
router.post("/logout", logoutUser);

// ✅ Ստուգում է՝ արդյոք օգտատերը մուտք է գործել
router.get("/check", verifyToken, updateLastActive, checkAuthStatus);

// ✅ Վերցնել օգտատիրոջ պրոֆիլը
router.get("/profile", verifyToken, updateLastActive, getUserProfile);

// ✅ Թարմացնել օգտատիրոջ տվյալները
router.patch("/profile", verifyToken, updateOwnProfile);

// ✅ Փոխել գաղտնաբառը
router.patch("/change-password", verifyToken, changePassword);

// ✅ User-ով գաղտնաբառի վերականգնում (Email-ի միջոցով)
router.post("/reset-password", resetPassword);

// ✅ Օգտատիրոջը ուղարկում ենք Reset Password Link
router.post("/request-password-reset", requestPasswordReset);


export default router;