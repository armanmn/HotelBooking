import express from "express";
import { 
  verifyToken, 
  verifyAdmin, 
  verifyOfficeUser, 
  verifyFinanceUser 
} from "../middlewares/authMiddleware.js";

import { 
  processPayment, 
  getAllPayments, 
  getUserPayments, 
  getPaymentById, 
  updatePaymentStatus, 
  recordBankPayment 
} from "../controllers/paymentController.js";

const router = express.Router();

// ✅ Վճարում կատարելու API (B2C & B2B օգտատերեր)
router.post("/", verifyToken, processPayment);

// ✅ Ստանալ բոլոր վճարումները (Admin & Finance User)
router.get("/", verifyToken, verifyFinanceUser, getAllPayments);

// ✅ Ստանալ օգտատիրոջ վճարումները (B2C & B2B)
router.get("/my-payments", verifyToken, getUserPayments);

// ✅ Ստանալ կոնկրետ վճարման տվյալները ըստ ID-ի (Finance User)
router.get("/:id", verifyToken, verifyFinanceUser, getPaymentById);

// ✅ Վճարման կարգավիճակի թարմացում (Finance User)
router.patch("/:id/status", verifyToken, verifyFinanceUser, updatePaymentStatus);

// ✅ Բանկային վճարում մուտքագրելու API (Finance User)
router.post("/record-bank-payment", verifyToken, verifyFinanceUser, recordBankPayment);

export default router;