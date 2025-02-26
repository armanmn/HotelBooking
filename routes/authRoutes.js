import express from "express";
import { 
  registerB2CUser, 
  loginUser, 
  getUserProfile, 
  updateUserProfile, 
  changePassword 
} from "../controllers/authController.js";
import { verifyToken } from "../middlewares/authMiddleware.js";

const router = express.Router();

// ✅ Գրանցում (Միայն B2C)
router.post("/register", registerB2CUser);

// ✅ Մուտք
router.post("/login", loginUser);

// ✅ Վերցնել օգտատիրոջ պրոֆիլը
router.get("/profile", verifyToken, getUserProfile);

// ✅ Թարմացնել օգտատիրոջ տվյալները (Անուն & Email)
router.patch("/profile", verifyToken, updateUserProfile);

// ✅ Փոխել գաղտնաբառը
router.patch("/change-password", verifyToken, changePassword);

export default router;