import jwt from "jsonwebtoken";
import User from "../models/User.js";


const verifyToken = (req, res, next) => {

  // ✅ Եթե request-ը reset-password-ի համար է, բաց թող
  if (req.path.startsWith("/api/v1/auth/reset-password")) {
    return next();
  }

  const token = req.cookies.authToken;
  if (!token) {
    return res.status(401).json({ message: "Access Denied" });
  }

  console.log("🍪 Incoming Cookies:", req.cookies);
  console.log("🔐 Token from cookie:", req.cookies.authToken);

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({ message: "Invalid token" });
  }
};

// ✅ Վավերացնում է, որ օգտատերը Admin է
const verifyAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== "admin") {
    return res.status(403).json({ message: "Only Admins allowed" });
  }
  next();
};

// ✅ Վավերացնում է, որ օգտատերը Finance User է
const verifyFinanceUser = (req, res, next) => {
  if (!req.user || req.user.role !== "finance_user") {
    return res
      .status(403)
      .json({ message: "Access Denied. Only Finance Users allowed" });
  }
  next();
};

// ✅ Վավերացնում է, որ օգտատերը Office User է
const verifyOfficeUser = (req, res, next) => {
  if (!req.user || req.user.role !== "office_user") {
    return res
      .status(403)
      .json({ message: "Access Denied. Only Office Users allowed" });
  }
  next();
};

// ✅ Վավերացնում է, որ օգտատերը B2B Sales Partner է (Reseller)
const verifySalesPartner = (req, res, next) => {
  if (!req.user || req.user.role !== "b2b_sales_partner") {
    return res
      .status(403)
      .json({ message: "Access Denied. Only Sales Partners allowed" });
  }
  next();
};

// ✅ Վավերացնում է, որ օգտատերը B2B Hotel Partner է (Hotel Owner/Manager)
const verifyHotelPartner = (req, res, next) => {
  if (!req.user || req.user.role !== "b2b_hotel_partner") {
    return res
      .status(403)
      .json({ message: "Access Denied. Only Hotel Partners allowed" });
  }
  next();
};

const updateLastActive = async (req, res, next) => {
  if (req.user) {
    await User.findByIdAndUpdate(req.user.id, { lastActiveAt: new Date() });
  }
  next();
};

// 📌 Վերջնական export
export {
  verifyToken,
  verifyAdmin,
  verifySalesPartner,
  verifyHotelPartner,
  verifyFinanceUser,
  verifyOfficeUser,
  updateLastActive,
};
