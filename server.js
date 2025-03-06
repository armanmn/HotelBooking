import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import cookieParser from "cookie-parser";
import authRoutes from "./routes/authRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import hotelRoutes from "./routes/hotelRoutes.js";
import bookingRoutes from "./routes/bookingRoutes.js";
import paymentRoutes from "./routes/paymentRoutes.js";
import b2bRoutes from "./routes/b2bRoutes.js";
import financeRoutes from "./routes/financeRoutes.js"; // ✅ Ավելացվել է ֆինանսական API-ի համար
import "./config/dotenv.js";
import dashboardRoutes from "./routes/dashboardRoutes.js";
import { fileURLToPath } from "url";
import path from "path";

// Սերվերի ստեղծում
const app = express();

// ✅ Ստեղծում ենք __dirname (ES Module-ի ճիշտ տարբերակ)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ✅ Middleware-ներ
app.use(
  cors({
    origin: process.env.FRONTEND_URL, // Թույլատրված origin-ը (Frontend-ի URL)
    credentials: true,
  })
);
app.use(express.json()); // JSON տվյալների համար
app.use(cookieParser()); // Cookies-ի կառավարում

app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// ✅ Ռոութերներ
app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/users", userRoutes);
app.use("/api/v1/hotels", hotelRoutes);
app.use("/api/v1/bookings", bookingRoutes);
app.use("/api/v1/payments", paymentRoutes);
app.use("/api/v1/b2b", b2bRoutes);
app.use("/api/v1/finance", financeRoutes); // ✅ Նոր ֆինանսական API
app.use("/api/v1/dashboard", dashboardRoutes);


// ✅ MongoDB-ի հետ միացում
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ MongoDB Connected");
  } catch (error) {
    console.error("❌ MongoDB Connection Error:", error);
    process.exit(1);
  }
};

// ✅ Սերվերի լսում
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  connectDB();
  console.log(`🚀 Server running on port ${PORT}`);
});