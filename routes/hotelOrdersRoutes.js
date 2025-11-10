// routes/hotelOrdersRoutes.js
import { Router } from "express";
import { verifyToken } from "../middlewares/authMiddleware.js";
import {
  listHotelOrders,
  getHotelOrder,
  patchAgentRef,
} from "../controllers/hotelOrdersController.js";

const r = Router();

/**
 * Small helpers local to this router to avoid touching other files
 */
const isOps = (role) => ["admin", "office_user", "finance_user"].includes(role);

/**
 * Build an access scope for controllers:
 *  - ops roles   => { visibility: "all" }
 *  - other roles => { visibility: "own", userId, email }
 *
 * Controllers should use req.orderScope to filter or authorize.
 */
const buildHotelOrderScope = (req, _res, next) => {
  const role = req.user?.role;
  if (isOps(role)) {
    req.orderScope = { visibility: "all" };
  } else {
    // keep both userId and email handy for flexible matching
    req.orderScope = {
      visibility: "own",
      userId: req.user?.id || null,
      email: req.user?.email || null,
    };
  }
  next();
};

/**
 * Only ops can edit agent-ref (internal note/field).
 */
const requireOps = (req, res, next) => {
  if (!isOps(req.user?.role)) {
    return res.status(403).json({ message: "Only ops/admin allowed" });
  }
  next();
};

// ==================== ROUTES ====================

// GET /orders/hotel
// - ops: full list
// - others: only their own orders
r.get(
  "/orders/hotel",
  verifyToken,
  buildHotelOrderScope,
  listHotelOrders
);

// GET /orders/hotel/:platformRef
// - ops: any
// - others: only if it is theirs (controller checks with req.orderScope)
r.get(
  "/orders/hotel/:platformRef",
  verifyToken,
  buildHotelOrderScope,
  getHotelOrder
);

// PATCH /orders/hotel/:platformRef/agent-ref
// - only ops/admin
r.patch(
  "/orders/hotel/:platformRef/agent-ref",
  verifyToken,
  requireOps,
  patchAgentRef
);

export default r;

/**
 * FUTURE (for your upcoming cancel flow)
 * Example policy:
 *  - ops/admin can cancel any eligible order
 *  - user can cancel only if it's their own and still cancelable
 *
 * r.post(
 *   "/suppliers/goglobal/booking/:platformRef/cancel",
 *   verifyToken,
 *   buildHotelOrderScope,
 *   cancelHotelOrder // controller should authorize using req.orderScope
 * );
 */