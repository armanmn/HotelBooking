import express from "express";
import { getPublicSettings, getGlobalSettings, updateGlobalSettings } from "../controllers/settingsController.js";
import { verifyToken } from "../middlewares/authMiddleware.js";
import { verifyRole } from "../middlewares/roleMiddleware.js";

const router = express.Router();

// Public settings – բոլոր authenticated օգտատերերի համար
router.get("/public-settings", verifyToken, getPublicSettings);

router.get("/global-settings", verifyToken, verifyRole(["admin", "finance_user"]), getGlobalSettings); // կստանա ընթացիկ exchangeRates-ը
router.post("/global-settings", verifyToken, verifyRole(["admin", "finance_user"]), updateGlobalSettings); // թարմացնում է rate-երը և վերադարձնում նոր տվյալներ

export default router;