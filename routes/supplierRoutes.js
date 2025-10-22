// New
// /routes/supplierRoutes.js
import express from "express";
import optionalAuth from "../middlewares/optionalAuth.js";
import { requireAuthOrDebug } from "../utils/acl.js";
import {
  goglobalAvailability,
  goglobalValuation,
  goglobalHotelInfo,
  goglobalHotelAvailability,
  goglobalBookingCreate,
  goglobalBookingStatus,
  goglobalBookingDetails,
  goglobalBookingCancel,
  goglobalBookingCancelByPlatformRef,
  goglobalBookingStatusSyncByPlatformRef,
} from "../controllers/supplierController.js";

const router = express.Router();

// role/markup-ի համար optionalAuth (guest-ը չկտրվի)
router.get("/goglobal/availability", optionalAuth, goglobalAvailability);
router.get("/goglobal/hotel-availability",  optionalAuth, goglobalHotelAvailability);
router.post("/goglobal/valuation", optionalAuth, goglobalValuation);
router.get("/goglobal/valuation", optionalAuth, goglobalValuation);
router.get("/goglobal/hotel-info", optionalAuth, goglobalHotelInfo);

// Booking primitive endpoints (legacy) — թողնում ենք optionalAuth
router.post("/goglobal/booking/create",  optionalAuth, goglobalBookingCreate);
router.get ("/goglobal/booking/status",  optionalAuth, goglobalBookingStatus);
router.get ("/goglobal/booking/details", optionalAuth, goglobalBookingDetails);
router.post("/goglobal/booking/cancel",  optionalAuth, goglobalBookingCancel);

// NEW: PlatformRef-based Order actions → AUTH-ED (կամ Debug)
// Հետագայում փոխարինել requireAuthOrDebug requireAuth ով, դեռևս swagger տեստի համար
// օգտագործում ենք requireAuthOrDebug ը
router.post("/goglobal/booking/:platformRef/cancel",     requireAuthOrDebug, goglobalBookingCancelByPlatformRef);
router.get ("/goglobal/booking/:platformRef/status-sync", requireAuthOrDebug, goglobalBookingStatusSyncByPlatformRef);

export default router;