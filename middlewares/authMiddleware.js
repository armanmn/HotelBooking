import jwt from "jsonwebtoken";
import User from "../models/User.js";

const verifyToken = (req, res, next) => {
  const token = req.headers.authorization;
  if (!token) return res.status(401).json({ message: "Access Denied" });

  try {
    const verified = jwt.verify(token.split(" ")[1], process.env.JWT_SECRET);
    req.user = verified;
    next();
  } catch (err) {
    res.status(400).json({ message: "Invalid Token" });
  }
};

// ✅ Վավերացնում է, որ օգտատերը Admin է
const verifyAdmin = (req, res, next) => {
  verifyToken(req, res, () => {
    if (req.user.role === "admin") {
      next();
    } else {
      res.status(403).json({ message: "Access Denied. Only Admins allowed" });
    }
  });
};

// ✅ Վավերացնում է, որ օգտատերը Finance User է
const verifyFinanceUser = (req, res, next) => {
  verifyToken(req, res, () => {
    if (req.user.role === "finance_user") {
      next();
    } else {
      res.status(403).json({ message: "Access Denied. Only Finance Users allowed" });
    }
  });
};

// ✅ Վավերացնում է, որ օգտատերը Office User է
const verifyOfficeUser = (req, res, next) => {
  verifyToken(req, res, () => {
    if (req.user.role === "office_user") {
      next();
    } else {
      res.status(403).json({ message: "Access Denied. Only Office Users allowed" });
    }
  });
};

// ✅ Վավերացնում է, որ օգտատերը B2B Sales Partner է (Reseller)
const verifySalesPartner = (req, res, next) => {
  verifyToken(req, res, () => {
    if (req.user.role === "b2b_sales_partner") {
      next();
    } else {
      res.status(403).json({ message: "Access Denied. Only Sales Partners allowed" });
    }
  });
};

// ✅ Վավերացնում է, որ օգտատերը B2B Hotel Partner է (Hotel Owner/Manager)
const verifyHotelPartner = (req, res, next) => {
  verifyToken(req, res, () => {
    if (req.user.role === "b2b_hotel_partner") {
      next();
    } else {
      res.status(403).json({ message: "Access Denied. Only Hotel Partners allowed" });
    }
  });
};

// 📌 Վերջնական export՝ առանց `verifyAdminOrOfficeUser`
export { verifyToken, verifyAdmin, verifySalesPartner, verifyHotelPartner, verifyFinanceUser, verifyOfficeUser };
