// routes/settingsRoutes.js
import express from "express";
import {
  getPublicSettings,
  getGlobalSettings,
  updateGlobalSettings,
  refreshExchangeRates,   // ⬅️ NEW
} from "../controllers/settingsController.js";
import { verifyToken } from "../middlewares/authMiddleware.js";
import { verifyRole } from "../middlewares/roleMiddleware.js";

const router = express.Router();

router.get("/public-settings", verifyToken, getPublicSettings);
router.get(
  "/global-settings",
  verifyToken,
  verifyRole(["admin", "finance_user"]),
  getGlobalSettings
);
router.post(
  "/global-settings",
  verifyToken,
  verifyRole(["admin", "finance_user"]),
  updateGlobalSettings
);

// ⬇️ OPTIONAL: ձեռքով refresh
router.post(
  "/exchange/refresh",
  verifyToken,
  verifyRole(["admin", "finance_user"]),
  refreshExchangeRates
);

export default router;