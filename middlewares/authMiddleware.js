// middlewares/authMiddleware.js
import jwt from "jsonwebtoken";
import User from "../models/User.js";

/**
 * Verify JWT from cookie and ATTACH FRESH user snapshot from DB to req.user
 * - Keeps token minimal (id, role)
 * - Always reads latest fields (e.g., markupPercentage) from DB
 */
const verifyToken = async (req, res, next) => {
  try {
    // ✅ allow reset-password route to pass through
    if (req.path.startsWith("/api/v1/auth/reset-password")) {
      return next();
    }

    const token = req.cookies?.authToken;
    if (!token) {
      return res.status(401).json({ message: "Access Denied" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    // ⛑️ pull a fresh user snapshot (only fields we actually need down the stack)
    const user = await User.findById(decoded.id)
      .select(
        "firstName lastName email role markupPercentage balance companyName phone address avatar lastActiveAt"
      )
      .lean();

    if (!user) {
      return res.status(401).json({ message: "Invalid token (user not found)" });
    }

    // attach a clean, predictable shape to req.user
    req.user = {
      id: user._id.toString(),
      role: user.role,
      // 👉 this is the important one for pricing
      markupPercentage:
        typeof user.markupPercentage === "number" ? user.markupPercentage : 0,

      // optional but handy fields for controllers that need them
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      companyName: user.companyName ?? null,
      balance: typeof user.balance === "number" ? user.balance : 0,
    };

    return next();
  } catch (error) {
    return res.status(401).json({ message: "Invalid token" });
  }
};

// Generic role guard to reduce duplication
const requireRole = (role) => (req, res, next) => {
  if (!req.user || req.user.role !== role) {
    return res.status(403).json({ message: `Only ${role} allowed` });
  }
  next();
};

// Keep the named guards for compatibility
const verifyAdmin = requireRole("admin");
const verifyFinanceUser = requireRole("finance_user");
const verifyOfficeUser = requireRole("office_user");
const verifySalesPartner = requireRole("b2b_sales_partner");
const verifyHotelPartner = requireRole("b2b_hotel_partner");

/**
 * Update lastActiveAt if we have an authenticated user
 * (run AFTER verifyToken)
 */
const updateLastActive = async (req, res, next) => {
  try {
    if (req.user?.id) {
      await User.findByIdAndUpdate(req.user.id, { lastActiveAt: new Date() });
    }
  } catch {
    // don't block request if this fails
  }
  next();
};

export {
  verifyToken,
  verifyAdmin,
  verifySalesPartner,
  verifyHotelPartner,
  verifyFinanceUser,
  verifyOfficeUser,
  updateLastActive,
};