// New
// utils/acl.js
export const OPS_ROLES = new Set(["office_user", "finance", "finance_user", "admin"]);

export function getUserId(req) {
  // JWT middleware usually sets { id, role }, while some old code expects _id
  return req?.user?._id || req?.user?.id || null;
}

export function isOps(role) {
  return OPS_ROLES.has(String(role || "").toLowerCase());
}

export function requireAuth(req, res, next) {
  if (!getUserId(req)) return res.status(401).json({ message: "Unauthorized" });
  // also mirror id -> _id so legacy code works
  req.user._id = req.user._id || req.user.id;
  return next();
}

export function requireAuthOrDebug(req, res, next) {
  if (req.user?._id || req.user?.id) return next();

  const debugRole = req.header("X-Debug-Role") || req.header("x-debug-role");
  const debugUser = req.header("X-Debug-User") || req.header("x-debug-user"); // OPTIONAL for tests

  if (debugRole) {
    const fakeId = debugUser || "000000000000000000000000";
    req.user = { _id: fakeId, id: fakeId, role: String(debugRole) };
    return next();
  }
  return res.status(401).json({ message: "Unauthorized" });
}

export function requireOwnerOrOps(req, res, next) {
  if (!getUserId(req)) return res.status(401).json({ message: "Unauthorized" });
  if (isOps(req.user.role)) return next();
  // owner check by platformRef happens in controller via query (filter by userId)
  return next();
}