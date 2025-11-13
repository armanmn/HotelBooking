// New

import { Router } from "express";
import { sendOrderEventEmail } from "../controllers/notificationController.js";
import { verifyToken } from "../middlewares/authMiddleware.js";

const router = Router();
router.post("/order-event", verifyToken, sendOrderEventEmail);

export default router;