import express from "express";
import { verifyToken, verifyFinanceUser } from "../middlewares/authMiddleware.js";
import {
  getExchangeRates,
  updateExchangeRates,
  getFinanceRecords,
  recordTransaction,
  getAllPayments,
  updatePaymentStatus
} from "../controllers/financeController.js";

const router = express.Router();

// ✅ Վերադարձնում է բոլոր ֆինանսական գրառումները (Finance User)
router.get("/", verifyToken, verifyFinanceUser, getFinanceRecords);

// ✅ Մուտքագրում է ֆինանսական գործարք (Finance User)
router.post("/", verifyToken, verifyFinanceUser, recordTransaction);

// ✅ Վերադարձնում է արժույթների փոխարժեքները (Finance User & Admin)
router.get("/exchange-rates", verifyToken, getExchangeRates);

// ✅ Թարմացնում է արժույթների փոխարժեքները (Միայն Finance User)
router.patch("/exchange-rates", verifyToken, verifyFinanceUser, updateExchangeRates);

// ✅ Վերադարձնում է բոլոր վճարումները (Finance User)
router.get("/payments", verifyToken, verifyFinanceUser, getAllPayments);

// ✅ Թարմացնում է վճարման կարգավիճակը (Finance User)
router.patch("/payments/:id", verifyToken, verifyFinanceUser, updatePaymentStatus);

export default router;