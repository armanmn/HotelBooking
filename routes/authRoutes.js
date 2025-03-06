import express from "express";
import { 
  registerB2CUser,
  registerB2BUser,
  loginUser, 
  logoutUser, 
  getUserProfile, 
  updateUserProfile, 
  changePassword, 
  checkAuthStatus  
} from "../controllers/authController.js";
import { verifyToken } from "../middlewares/authMiddleware.js";

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
router.get("/check", verifyToken, checkAuthStatus);

// ✅ Վերցնել օգտատիրոջ պրոֆիլը
router.get("/profile", verifyToken, getUserProfile);

// ✅ Թարմացնել օգտատիրոջ տվյալները
router.patch("/profile", verifyToken, updateUserProfile);

// ✅ Փոխել գաղտնաբառը
router.patch("/change-password", verifyToken, changePassword);

export default router;