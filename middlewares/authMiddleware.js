import jwt from "jsonwebtoken";
import User from "../models/User.js";

// ✅ Վավերացնում է JWT-ն (պահված է httpOnly cookie-ի մեջ, ոչ թե Headers-ում)
// const verifyToken = (req, res, next) => {
//   console.log("Received Cookies:", req.cookies); // ✅ Ստուգում ենք cookie-ն
//   const token = req.cookies.authToken; // 🔹 Հիմա վերցնում ենք cookie-ից
//   if (!token) return res.status(401).json({ message: "Access Denied" });

//   try {
//     const verified = jwt.verify(token, process.env.JWT_SECRET);
//     req.user = verified;
//     next();
//   } catch (err) {
//     res.status(400).json({ message: "Invalid Token" });
//   }
// };

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

// const verifyToken = (req, res, next) => {
//   const token = req.cookies?.token;

//   if (!token) {
//     return res.status(401).json({ message: "No token, authorization denied" });
//   }

//   try {
//     const decoded = jwt.verify(token, process.env.JWT_SECRET);
//     req.user = decoded; // ✅ սա ներառում է user._id և role
//     next();
//   } catch (error) {
//     res.status(401).json({ message: "Token is not valid" });
//   }
// };

// const verifyToken = (req, res, next) => {
//   // ✅ Ստուգում ենք թե՛ cookie-ով, թե՛ Authorization header-ով
//   const token =
//     req.cookies?.token ||
//     (req.headers.authorization?.startsWith("Bearer ")
//       ? req.headers.authorization.split(" ")[1]
//       : null);

//   if (!token) {
//     return res.status(401).json({ message: "No token, authorization denied" });
//   }

//   try {
//     const decoded = jwt.verify(token, process.env.JWT_SECRET);
//     req.user = decoded; // ✅ այստեղ կա _id և role
//     next();
//   } catch (error) {
//     return res.status(401).json({ message: "Token is not valid" });
//   }
// };

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
