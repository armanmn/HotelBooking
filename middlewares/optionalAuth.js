import jwt from "jsonwebtoken";

export default function optionalAuth(req, _res, next) {
  const token = req.cookies?.authToken;
  if (!token) return next();

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // { id, role, markupPercentage? }
  } catch (_e) {
    // ignore invalid token for optional flow
  }
  next();
}