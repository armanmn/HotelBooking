// import jwt from "jsonwebtoken";

// export default function optionalAuth(req, _res, next) {
//   const token = req.cookies?.authToken;
//   if (!token) return next();

//   try {
//     const decoded = jwt.verify(token, process.env.JWT_SECRET);
//     req.user = decoded; // { id, role, markupPercentage? }
//   } catch (_e) {
//     // ignore invalid token for optional flow
//   }
//   next();
// }

import jwt from "jsonwebtoken";
import User from "../models/User.js";

export default function optionalAuth(req, _res, next) {
  const token = req.cookies?.authToken;
  if (!token) return next();

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    req.user = { id: decoded?.id || decoded?._id, role: decoded?.role };
  } catch (_e) {
    // invalid token → guest
    return next();
  }

  // ։) Թարմ user-ը DB-ից (քյաշավորելու կարիք այս պահին չկա)
  (async () => {
    try {
      const uid = req.user?.id || req.user?._id;
      if (!uid) return next();

      const u = await User.findById(uid)
        .select(
          "role markupPercentage firstName lastName email companyName balance lastActiveAt"
        )
        .lean();

      if (!u) return next(); // user not found → guest

      // Normalize: պահպանում ենք և id, և _id, և թարմ դաշտերը
      req.user = {
        id: String(u._id),
        _id: String(u._id),
        role: u.role,
        markupPercentage:
          typeof u.markupPercentage === "number"
            ? u.markupPercentage
            : undefined,
        // կարելի է ավելացնել նաև այլ թեթև դաշտեր, եթե պետք գան controller-ներում
      };
    } catch (_err) {
      // DB error → treat as guest
    } finally {
      next();
    }
  })();
}
