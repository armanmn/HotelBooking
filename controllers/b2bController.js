import Hotel from "../models/Hotel.js";
import Booking from "../models/Booking.js";
import User from "../models/User.js";

/**
 * 📌 Հյուրանոցների կառավարում (B2B Partner - Hotel Owner)
 */

// ✅ Հյուրանոցի ստեղծում
export const createHotel = async (req, res) => {
  try {
    const newHotel = new Hotel({ ...req.body, owner: req.user.id });
    const savedHotel = await newHotel.save();
    res.status(201).json(savedHotel);
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// ✅ Հյուրանոցի թարմացում
export const updateHotel = async (req, res) => {
  try {
    const updatedHotel = await Hotel.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.status(200).json(updatedHotel);
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// ✅ Հյուրանոցի հեռացում
export const deleteHotel = async (req, res) => {
  try {
    await Hotel.findByIdAndDelete(req.params.id);
    res.status(200).json({ message: "Hotel deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// ✅ B2B Partner-ի բոլոր հյուրանոցները
export const getMyHotels = async (req, res) => {
  try {
    const hotels = await Hotel.find({ owner: req.user.id });
    res.status(200).json(hotels);
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

/**
 * 📌 B2B Վաճառքի գործընկերներ (Sales Partners) - Booking կառավարում
 */

// ✅ Վաճառքի գործընկերոջ ամրագրում (Booking)
export const createB2BBooking = async (req, res) => {
  try {
    const { hotelId, checkIn, checkOut, guests, totalPrice } = req.body;

    // Ստուգում, արդյոք հյուրանոցը գոյություն ունի
    const hotel = await Hotel.findById(hotelId);
    if (!hotel) {
      return res.status(404).json({ message: "Hotel not found" });
    }

    // Ստեղծում ամրագրում
    const newBooking = new Booking({
      user: req.user.id, // Sales Partner-ի ID
      hotel: hotelId,
      checkIn,
      checkOut,
      guests,
      totalPrice,
      status: "pending", // Սկզբնական կարգավիճակ
      createdBy: "b2b_sales_partner",
    });

    await newBooking.save();

    res.status(201).json({ message: "Booking created successfully", booking: newBooking });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// ✅ Վաճառքի գործընկերոջ ամրագրումների ցուցակ
export const getB2BBookings = async (req, res) => {
  try {
    const bookings = await Booking.find({ user: req.user.id }).populate("hotel");
    res.status(200).json(bookings);
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// ✅ Վաճառքի գործընկերոջ կոնկրետ ամրագրում
export const getB2BBooking = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id).populate("hotel");
    if (!booking) {
      return res.status(404).json({ message: "Booking not found" });
    }
    res.status(200).json(booking);
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// ✅ Վաճառքի գործընկերոջ ամրագրման չեղարկում
export const cancelB2BBooking = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) {
      return res.status(404).json({ message: "Booking not found" });
    }

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

export const getAvailableHotels = async (req, res) => {
    try {
      const hotels = await Hotel.find({ status: "approved" }); // ✅ Վերցնում ենք հաստատված հյուրանոցները
      res.status(200).json(hotels);
    } catch (error) {
      res.status(500).json({ message: "Server error", error: error.message });
    }
  };