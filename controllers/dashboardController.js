import Booking from "../models/Booking.js";
import User from "../models/User.js";
import Hotel from "../models/Hotel.js";

export const getDashboardStats = async (req, res) => {
  try {
    const totalOrders = await Booking.countDocuments();
    const totalRevenue = await Booking.aggregate([
      { $group: { _id: null, total: { $sum: "$totalPrice" } } }
    ]);
    const totalUsers = await User.countDocuments();
    const totalHotels = await Hotel.countDocuments();

    res.json({
      totalOrders,
      totalRevenue: totalRevenue[0]?.total || 0,
      totalUsers,
      totalHotels,
    });
  } catch (error) {
    res.status(500).json({ message: "Error fetching dashboard stats", error });
  }
};

export const getRecentBookings = async (req, res) => {
  try {
    const recentBookings = await Booking.find().sort({ createdAt: -1 }).limit(5);
    res.json(recentBookings);
  } catch (error) {
    res.status(500).json({ message: "Error fetching recent bookings", error });
  }
};

export const getRecentHotels = async (req, res) => {
  try {
    const recentHotels = await Hotel.find().sort({ createdAt: -1 }).limit(5);
    res.json(recentHotels);
  } catch (error) {
    res.status(500).json({ message: "Error fetching recent hotels", error });
  }
};