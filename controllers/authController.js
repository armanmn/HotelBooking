import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/User.js";

// ✅ Գրանցում - Միայն B2C օգտատերերի համար
export const registerB2CUser = async (req, res) => {
  try {
    const { name, email, password } = req.body;

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
      name,
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

// ✅ Մուտք (Login)
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

    const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, {
      expiresIn: "7d",
    });

    res.status(200).json({ token, user });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// ✅ Թարմացնում է օգտատիրոջ անունը կամ email-ը
export const updateUserProfile = async (req, res) => {
  try {
    const { name, email } = req.body;

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
      { name, email },
      { new: true }
    ).select("-password"); // Գաղտնաբառը չենք վերադարձնում

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

// ✅ Օգտատիրոջ պրոֆիլը ստանալու ֆունկցիա
export const getUserProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-password");
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json(user);
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};