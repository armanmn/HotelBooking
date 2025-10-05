// routes/searchSessionRoutes.js
import { Router, json } from "express";
import { getCurrent, upsert, clear } from "../controllers/searchSessionController.js";

const router = Router();

router.get("/", getCurrent);
router.put("/", json(), upsert);
router.delete("/", clear);

export default router;