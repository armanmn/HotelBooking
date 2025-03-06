import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import generateToken from "../utils/generateToken.js";


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

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    // ✅ Օգտագործում ենք մեր `generateToken` ֆունկցիան
    generateToken(res, user._id, user.role);

    // ✅ Հեռացնում ենք գաղտնաբառը պատասխանից
    const { password: _, ...userData } = user._doc;

    res.status(200).json({ message: "Login successful", user: userData });
  } catch (error) {
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

// ✅ Ստուգում է՝ արդյոք օգտատերը մուտք է գործել
export const checkAuthStatus = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("firstName lastName role email phone address companyName balance");
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json({ message: "User authenticated", user });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// ✅ Թարմացնում է օգտատիրոջ պրոֆիլը (First Name, Last Name, Email, Phone, Address, Company Name)
export const updateUserProfile = async (req, res) => {
  try {
    const { firstName, lastName, email, phone, address, companyName } = req.body;

    // Ստուգում ենք, արդյոք email-ը արդեն գոյություն ունի
    if (email) {
      const existingUser = await User.findOne({ email });
      if (existingUser && existingUser._id.toString() !== req.user.id) {
        return res.status(400).json({ message: "Email already in use" });
      }
    }

    // Թարմացնում ենք տվյալները
    const updatedUser = await User.findByIdAndUpdate(
      req.user.id,
      { firstName, lastName, email, phone, address, companyName },
      { new: true }
    ).select("-password");

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
      "firstName lastName email phone address companyName balance role createdAt avatar"
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