import bcrypt from "bcryptjs";
import User from "../models/User.js";
import GlobalSettings from "../models/GlobalSettings.js";
import Booking from "../models/Booking.js";

// ✅ Վերադարձնում է բոլոր user-ներին (Admin & Office User)
export const getAllUsers = async (req, res) => {
  try {
    const users = await User.find().select("-password"); // Չենք վերադարձնում գաղտնաբառը
    res.status(200).json(users);
  } catch (err) {
    res.status(500).json({ message: "Something went wrong", error: err.message });
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
    const bookings = await Booking.find({ hotelId: req.user.hotelPartnerId }).populate("userId", "name email");
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

// ✅ Ստեղծում է B2B User (Hotel Partner կամ Sales Partner) (Միայն Admin)
export const createB2BUser = async (req, res) => {
  try {
    const { name, email, password, role, hotelPartnerId, markupPercentage } = req.body;

    if (!["b2b_hotel_partner", "b2b_sales_partner"].includes(role)) {
      return res.status(400).json({ message: "Invalid role. Only B2B roles are allowed." });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "User already exists" });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newUser = new User({
      name,
      email,
      password: hashedPassword,
      role,
      hotelPartnerId: role === "b2b_hotel_partner" ? hotelPartnerId : null,
      markupPercentage: role === "b2b_sales_partner" ? markupPercentage : null
    });

    await newUser.save();

    // ✅ Պատասխանից հեռացնում ենք գաղտնաբառը
    const responseUser = {
      id: newUser._id,
      name: newUser.name,
      email: newUser.email,
      role: newUser.role,
      hotelPartnerId: newUser.hotelPartnerId,
      markupPercentage: newUser.markupPercentage
    };

    res.status(201).json({ message: "B2B User created successfully", newUser: responseUser });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// ✅ Ստեղծում է Office User կամ Finance User (Միայն Admin)
export const createOfficeOrFinanceUser = async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

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
      name,
      email,
      password: hashedPassword,
      role
    });

    await newUser.save();

    // ✅ Հեռացնում ենք գաղտնաբառը պատասխանից
    const responseUser = {
      id: newUser._id,
      name: newUser.name,
      email: newUser.email,
      role: newUser.role
    };

    res.status(201).json({ message: "User created successfully", user: responseUser });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
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