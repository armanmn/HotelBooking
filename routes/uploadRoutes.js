import express from "express";
import multer from "multer";
import { uploadOfferImage } from "../controllers/uploadController.js";

const router = express.Router();
const upload = multer({ dest: "temp/" });

router.post("/offer", upload.single("image"), uploadOfferImage);

export default router;