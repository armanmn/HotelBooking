// New
// hotelOrdersRoutes.js
import { Router } from "express";
import { requireAuth, requireAuthOrDebug } from "../utils/acl.js";
import { listHotelOrders, getHotelOrder, patchAgentRef } from "../controllers/hotelOrdersController.js";

const r = Router();

r.get("/orders/hotel", requireAuthOrDebug, listHotelOrders);
r.get("/orders/hotel/:platformRef", requireAuthOrDebug, getHotelOrder);
r.patch("/orders/hotel/:platformRef/agent-ref", requireAuthOrDebug, patchAgentRef);

export default r;