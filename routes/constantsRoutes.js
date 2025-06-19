import express from "express";
import { getRoomTypes } from "../controllers/constantsController.js";

const router = express.Router();

router.get("/room-types", getRoomTypes);

export default router;