import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import generateToken from "../utils/generateToken.js";
import nodemailer from "nodemailer";
import { sendResetEmail } from "../utils/email.js";




// ✅ Գրանցում - Միայն B2C օգտատերերի համար
export const registerB2CUser = async (req, res) => {
  try {
    const { firstName, lastName, email, password } = req.body;

    // Ստուգում ենք՝ արդյոք օգտատերը արդեն գրանցված է
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "User already exists" });
    }

    // Ծածկագրում ենք գաղտնաբառը
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Ստեղծում ենք նոր B2C օգտատեր (role-ը սահմանված է որպես "b2c")
    const newUser = new User({
      firstName,
      lastName,
      email,
      password: hashedPassword,
      role: "b2c",
    });

    await newUser.save();
    res.status(201).json({ message: "User registered successfully" });

  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

export const registerB2BUser = async (req, res) => {
  try {
    const { firstName, lastName, email, password, phone, address, role, companyName } = req.body;

    // ✅ Սահմանում ենք թույլատրելի B2B role-երը
    const allowedRoles = ["b2b_hotel_partner", "b2b_sales_partner"];

    // ✅ Ստուգում ենք՝ արդյո՞ք ընտրած role-ը թույլատրելի է
    if (!allowedRoles.includes(role)) {
      return res.status(400).json({ message: "Invalid role selection" });
    }

    // ✅ Ստուգում ենք՝ արդյո՞ք օգտատերը արդեն գոյություն ունի
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "User already exists" });
    }

    // ✅ Ծածկագրում ենք գաղտնաբառը
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // ✅ Ստեղծում ենք նոր B2B օգտատեր
    const newUser = new User({
      firstName,
      lastName,
      email,
      phone,
      address,
      password: hashedPassword,
      role, // ✅ role-ը կարող է լինել միայն "b2b_hotel_partner" կամ "b2b_sales_partner"
      companyName, // ✅ Միայն B2B օգտատերերի համար
    });

    await newUser.save();
    res.status(201).json({ message: "B2B User registered successfully", user: { firstName, lastName, email, role, companyName } });

  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

export const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;
    console.log("🛠️ Debug: Login attempt for", email); // ✅ Debugging log

    const user = await User.findOne({ email });
    if (!user) {
      console.log("🚨 No user found with this email:", email);
      return res.status(400).json({ message: "Invalid credentials" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      console.log("🚨 Password does not match for", email);
      return res.status(400).json({ message: "Invalid credentials" });
    }

    console.log("✅ Login successful for", email);
    generateToken(res, user._id, user.role);

    const { password: _, ...userData } = user._doc;
    res.status(200).json({ message: "Login successful", user: userData });
  } catch (error) {
    console.error("🚨 Server error during login:", error.message);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};


// ✅ Logout - Ջնջում է httpOnly cookie-ն
export const logoutUser = async (req, res) => {
  try {
    res.clearCookie("authToken", { 
      httpOnly: true, 
      secure: process.env.NODE_ENV === "production", 
      sameSite: "Strict" 
    }); // ✅ Ջնջում ենք cookie-ն
  
    res.status(200).json({ message: "Logged out successfully" });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

export const requestPasswordReset = async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: "1h" });
    await sendResetEmail(user.email, token); // ✅ Ուղարկում ենք Reset Link-ը

    res.status(200).json({ message: "Password reset link sent successfully." });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

export const resetPassword = async (req, res) => {
  try {
    const { token, newPassword } = req.body;
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId);

    if (!user) {
      return res.status(404).json({ message: "Invalid token" });
    }

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);
    await user.save();

    res.status(200).json({ message: "Password reset successfully." });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// ✅ Ստուգում է՝ արդյոք օգտատերը մուտք է գործել
export const checkAuthStatus = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("firstName lastName role email phone address companyName balance avatar lastActiveAt loyaltyRate");
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json({ message: "User authenticated", user });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// ✅ Թարմացնում է օգտատիրոջ պրոֆիլը (First Name, Last Name, Email, Phone, Address, Company Name)
export const updateOwnProfile = async (req, res) => {
  try {
    const { firstName, lastName, email, phone, address, companyName } = req.body;

    // ✅ Ստուգում ենք, արդյոք email-ը արդեն գոյություն ունի
    if (email) {
      const existingUser = await User.findOne({ email });
      if (existingUser && existingUser._id.toString() !== req.user.id) {
        return res.status(400).json({ message: "Email is already in use." });
      }
    }

    // ✅ Թարմացնում ենք տվյալները
    const updatedUser = await User.findByIdAndUpdate(
      req.user.id,
      { firstName, lastName, email, phone, address, companyName },
      { new: true }
    ).select("-password");

    if (!updatedUser) {
      return res.status(404).json({ message: "User not found." });
    }

    res.status(200).json({ message: "Profile updated successfully", user: updatedUser });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// ✅ Թարմացնում է օգտատիրոջ գաղտնաբառը
export const changePassword = async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;

    // Ստուգում ենք, արդյոք նոր գաղտնաբառը բավարար է երկարությամբ
    if (newPassword.length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters long" });
    }

    // Ստանում ենք օգտատիրոջ տվյալները
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Ստուգում ենք հին գաղտնաբառը
    const isMatch = await bcrypt.compare(oldPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Old password is incorrect" });
    }

    // Ծածկագրում ենք նոր գաղտնաբառը
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);

    // Պահպանում ենք նոր գաղտնաբառը
    await user.save();

    res.status(200).json({ message: "Password changed successfully" });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};



// ✅ Օգտատիրոջ պրոֆիլը ստանալու ֆունկցիա (Frontend-ի համար)
export const getUserProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select(
      "firstName lastName email phone address companyName balance role createdAt lastActiveAt avatar"
    );

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // ✅ Վերադարձնում ենք ամբողջական URL, եթե avatar կա
    const avatarUrl = user.avatar
      ? `http://localhost:5000${user.avatar}`
      : null;

    res.status(200).json({ ...user.toObject(), avatar: avatarUrl });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};