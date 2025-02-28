import jwt from "jsonwebtoken";

const generateToken = (res, userId, role) => {
  const token = jwt.sign({ id: userId, role }, process.env.JWT_SECRET, {
    expiresIn: "7d",
  });

  res.cookie("authToken", token, {
    httpOnly: true, // ❌ JavaScript-ը չի կարող կարդալ
    secure: process.env.NODE_ENV === "production", // ✅ Միայն HTTPS-ի վրա
    sameSite: "Strict", // ✅ CSRF պաշտպանություն
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 օր
  });
};

export default generateToken;