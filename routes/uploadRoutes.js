import express from "express";
import multer from "multer";
import { uploadRoomImage } from "../controllers/uploadController.js";

const router = express.Router();
const upload = multer({ dest: "temp/" });

router.post("/room", upload.single("image"), uploadRoomImage);

export default router;