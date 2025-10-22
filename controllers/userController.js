import bcrypt from "bcryptjs";
import User from "../models/User.js";
import GlobalSettings from "../models/GlobalSettings.js";
 import Booking from "../models/Booking.js";
import multer from "multer";
import path from "path";
import fs from "fs";
import { sendResetEmail } from "../utils/email.js";


const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadPath = "uploads/avatars/";
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    // ✅ Սահմանում ենք user ID-ով ֆայլի անուն
    cb(null, `${req.user.id}.jpg`); 
  },
});

const upload = multer({ storage: storage });

export const removeAvatar = async (req, res) => {
  try {
    const userId = req.user.id; // ✅ Օգտատիրոջ իրական ID-ն ենք վերցնում

    const user = await User.findByIdAndUpdate(userId, { avatar: "" }, { new: true });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json({ message: "Avatar removed successfully" });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};



// ✅ Թարմացնում է օգտատիրոջ avatar-ը (Միայն ոչ-B2C user-ների համար)
export const updateAvatar = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    const avatarUrl = `/uploads/avatars/${req.file.filename}`; // ✅ Backend-ը տալիս է ճիշտ URL

    const updatedUser = await User.findByIdAndUpdate(
      req.user.id,
      { avatar: avatarUrl },
      { new: true }
    ).select("avatar");

    res.status(200).json({ message: "Avatar updated successfully", avatar: `http://localhost:5000${updatedUser.avatar}` }); // ✅ Ավելացնում ենք բազային URL
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// ✅ Վերադարձնում է բոլոր user-ներին (Admin & Office User)
export const getAllUsers = async (req, res) => {
  try {
    const users = await User.find().select("-password"); // Չենք վերադարձնում գաղտնաբառը
    res.status(200).json(users);
  } catch (err) {
    res.status(500).json({ message: "Something went wrong", error: err.message });
  }
};

export const getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select("-password");

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json(user);
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// ✅ Վերադարձնում է B2B Sales Partner-ի ամրագրումները
export const getB2BReservations = async (req, res) => {
  try {
    const reservations = await Booking.find({ salesPartnerId: req.user.id });
    res.status(200).json(reservations);
  } catch (err) {
    res.status(500).json({ message: "Something went wrong", error: err.message });
  }
};

// ✅ Վերադարձնում է B2B Hotel Partner-ի ամրագրումները
export const getHotelPartnerBookings = async (req, res) => {
  try {
    const bookings = await Booking.find({ hotelId: req.user.hotelPartnerId }).populate("userId", "firstName lastName email");
    res.status(200).json(bookings);
  } catch (err) {
    res.status(500).json({ message: "Something went wrong", error: err.message });
  }
};

// ✅ Թարմացնում է B2B Sales Partner-ի անհատական markup (Միայն Admin)
export const updateSalesPartnerMarkup = async (req, res) => {
  try {
    const { markupPercentage } = req.body;
    if (markupPercentage < 0 || markupPercentage > 100) {
      return res.status(400).json({ message: "Markup percentage must be between 0 and 100" });
    }

    const updatedUser = await User.findByIdAndUpdate(
      req.params.id,
      { markupPercentage },
      { new: true, runValidators: true }
    );

    if (!updatedUser || updatedUser.role !== "b2b_sales_partner") {
      return res.status(404).json({ message: "Sales Partner not found" });
    }

    res.status(200).json({ message: "Sales Partner markup updated successfully", updatedUser });
  } catch (err) {
    res.status(500).json({ message: "Something went wrong", error: err.message });
  }
};

// ✅ Թարմացնում է B2B Sales Partner-ի անհատական balance (Միայն Admin, Finance user)
export const updateBalance = async (req, res) => {
  try {
    const { amount } = req.body;

    if (amount < -10000) {
      return res.status(400).json({ message: "Balance deduction is too high" });
    }

    const user = await User.findById(req.params.id);

    if (!user || user.role !== "b2b_sales_partner") {
      return res.status(404).json({ message: "Sales Partner not found" });
    }

    if (user.balance + amount < 0) {
      return res.status(400).json({ message: "Insufficient balance" });
    }

    user.balance += amount;
    await user.save();

    res.status(200).json({ message: "Balance updated successfully", balance: user.balance });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// ✅ Թարմացնում է B2C-ի ընդհանուր markup (Միայն Admin)
export const updateB2CMarkup = async (req, res) => {
  try {
    const { b2cMarkupPercentage } = req.body;
    if (b2cMarkupPercentage < 0 || b2cMarkupPercentage > 100) {
      return res.status(400).json({ message: "B2C markup percentage must be between 0 and 100" });
    }

    const updatedSettings = await GlobalSettings.findOneAndUpdate(
      {},
      { b2cMarkupPercentage },
      { new: true, upsert: true }
    );

    res.status(200).json({ message: "B2C markup updated successfully", updatedSettings });
  } catch (err) {
    res.status(500).json({ message: "Something went wrong", error: err.message });
  }
};

// ✅ Ջնջում է user (Միայն Admin)
export const deleteUser = async (req, res) => {
  try {
    const deletedUser = await User.findByIdAndDelete(req.params.id);
    if (!deletedUser) {
      return res.status(404).json({ message: "User not found" });
    }

    // ✅ Ջնջված user-ի բոլոր կապված ամրագրումները թարմացնում ենք
    await Booking.updateMany(
      { userId: req.params.id },
      { $set: { status: "cancelled" } }
    );

    res.status(200).json({ message: "User deleted successfully, related bookings updated" });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// ✅ Ստեղծում է Office User կամ Finance User (Միայն Admin)
export const createOfficeOrFinanceUser = async (req, res) => {
  try {
    const { firstName, lastName, email, password, role } = req.body;

    if (!["office_user", "finance_user"].includes(role)) {
      return res.status(400).json({ message: "Invalid role. Only Office or Finance users can be created." });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "User already exists" });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newUser = new User({
      firstName,
      lastName,
      email,
      password: hashedPassword,
      role
    });

    await newUser.save();

    // ✅ Հեռացնում ենք գաղտնաբառը պատասխանից
    const responseUser = {
      id: newUser._id,
      firstName: newUser.firstName,
      lastName: newUser.lastName,
      email: newUser.email,
      role: newUser.role
    };

    res.status(201).json({ message: "User created successfully", user: responseUser });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

export const updateUserProfile = async (req, res) => {
  try {
    const { firstName, lastName, email, phone, address, companyName, role, balance, markupPercentage, loyaltyRate } = req.body;
    const userId = req.params.id;

    // ✅ Ստուգում ենք, արդյոք email-ը արդեն գոյություն ունի այլ user-ի մոտ
    if (email) {
      const existingUser = await User.findOne({ email });
      if (existingUser && existingUser._id.toString() !== userId) {
        return res.status(400).json({ message: "Email is already in use by another user." });
      }
    }

    // ✅ Թարմացնում ենք user-ի տվյալները (Admin-ը կարող է փոփոխել role և balance)
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { firstName, lastName, email, phone, address, companyName, role, balance, markupPercentage, loyaltyRate },
      { new: true }
    ).select("-password");

    if (!updatedUser) {
      return res.status(404).json({ message: "User not found." });
    }

    res.status(200).json({ message: "User updated successfully", user: updatedUser });
  } catch (error) {
    console.error("Error updating profile:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};
