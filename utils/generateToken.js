// // utils/generateToken.js
// import jwt from "jsonwebtoken";

// const generateToken = (res, userId, role, extras = {}) => {
//   const payload = {
//     id: userId.toString(),
//     role,
//     ...extras, // ✅ allow extra claims (e.g., markupPercentage)
//   };

//   const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: "7d" });

//   res.cookie("authToken", token, {
//     httpOnly: true,
//     secure: process.env.NODE_ENV === "production",
//     sameSite: "lax",
//     maxAge: 7 * 24 * 60 * 60 * 1000,
//   });

//   return token;
// };

// export default generateToken;

// utils/generateToken.js
import jwt from "jsonwebtoken";

const generateToken = (res, userId, role, _extrasIgnored = {}) => {
  // ✅ keep token minimal & stable: no mutable fields like markupPercentage
  const payload = {
    id: userId.toString(),
    role,
  };

  const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: "7d" });

  res.cookie("authToken", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax", // keep your current behavior
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });

  return token;
};

export default generateToken;