import express from "express";
import optionalAuth from "../middlewares/optionalAuth.js";
import { goglobalAvailability, goglobalValuation, goglobalHotelInfo, goglobalHotelAvailability } from "../controllers/supplierController.js";

const router = express.Router();

// role/markup-ի համար ցանկալի է optionalAuth, որ guest-ը չկտրվի
router.get("/goglobal/availability", optionalAuth, goglobalAvailability);
router.get("/goglobal/hotel-availability",  optionalAuth, goglobalHotelAvailability);

router.post("/goglobal/valuation", optionalAuth, goglobalValuation);
router.get("/goglobal/valuation", optionalAuth, goglobalValuation);


router.get("/goglobal/hotel-info", optionalAuth, goglobalHotelInfo);

export default router;