import Booking from "../models/Booking.js";
import Hotel from "../models/Hotel.js";
import Room from "../models/Room.js";

/**
 * 📌 Ստեղծել նոր ամրագրում
 */
export const createBooking = async (req, res) => {
  try {
    const { hotelId, roomId, checkInDate, checkOutDate, totalPrice, guests } = req.body;

    const hotel = await Hotel.findById(hotelId);
    if (!hotel) return res.status(404).json({ message: "Hotel not found" });

    const room = await Room.findById(roomId);
    if (!room) return res.status(404).json({ message: "Room not found" });

    // ✅ Ստեղծում ենք ամրագրումը՝ առանց balance-ից գումար պահելու
    const newBooking = new Booking({
      user: req.user.id,
      hotel: hotelId,
      room: roomId,
      checkInDate,
      checkOutDate,
      totalPrice,
      guests,
      status: "pending", // Սկզբում ամրագրումը սպասման մեջ է
    });

    await newBooking.save();
    res.status(201).json({ message: "Booking created successfully", booking: newBooking });

  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

/**
 * 📌 Ստանալ կոնկրետ օգտագործողի բոլոր ամրագրումները
 */
export const getUserBookings = async (req, res) => {
  try {
    const bookings = await Booking.find({ user: req.user.id }).populate("hotel room");
    res.status(200).json(bookings);
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

/**
 * 📌 Ստանալ կոնկրետ ամրագրում ըստ ID-ի
 */
export const getBookingById = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id).populate("hotel room");
    if (!booking) return res.status(404).json({ message: "Booking not found" });

    res.status(200).json(booking);
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

/**
 * 📌 Չեղարկել ամրագրումը
 */
export const cancelBooking = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ message: "Booking not found" });

    if (booking.status === "cancelled") {
      return res.status(400).json({ message: "Booking is already cancelled" });
    }

    booking.status = "cancelled";
    await booking.save();

    res.status(200).json({ message: "Booking cancelled successfully", booking });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};