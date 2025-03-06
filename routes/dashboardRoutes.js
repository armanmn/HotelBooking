import express from "express";
import { getDashboardStats } from "../controllers/dashboardController.js";
import { getRecentBookings } from "../controllers/dashboardController.js";
import { getRecentHotels } from "../controllers/dashboardController.js";
import { verifyAdmin } from "../middlewares/authMiddleware.js";


const router = express.Router();

// ✅ Վիճակագրական տվյալներ
router.get("/stats", verifyAdmin, getDashboardStats);

router.get("/recent-bookings", verifyAdmin, getRecentBookings);

router.get("/recent-hotels", verifyAdmin, getRecentHotels);

export default router;