import Booking from "../models/Booking.js";
import Hotel from "../models/Hotel.js";
import Offer from "../models/Offer.js";
import { grantLoyaltyBonus } from "../utils/grantLoyaltyBonus.js";

export const createBooking = async (req, res) => {
  if (!req.user || !req.user.id) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  try {
    const {
      offerId,
      hotel,
      guest,
      checkInDate,
      checkOutDate,
      nights,
      totalPrice,
      paymentMethod,
    } = req.body;

    const userId = req.user.id;

    const hotelData = await Hotel.findById(hotel);
    if (!hotelData) {
      return res.status(404).json({ message: "Hotel not found" });
    }

    const offerData = await Offer.findById(offerId);
    if (!offerData) {
      return res.status(404).json({ message: "Offer not found" });
    }

    // Derive payment and order status
    let paymentStatus = "not_paid";
    if (paymentMethod === "credit_card" || paymentMethod === "balance") {
      paymentStatus = "paid_pending_verification";
    }

    const orderStatus =
      paymentStatus === "not_paid"
        ? "awaiting_payment"
        : "awaiting_confirmation";

    const newBooking = new Booking({
      user: userId,

      offer: {
        offerId: offerData._id,
        title: offerData.title,
        board: offerData.board,
        cancellationPolicy: offerData.cancellationPolicy,
        rateToken: offerData.rateDetails?.rateToken || null,
        provider: offerData.origin?.provider || "direct",
        price: {
          amount: offerData.price?.amount,
          currency: offerData.price?.currency,
          originalAmount: offerData.price?.originalAmount,
          originalCurrency: offerData.price?.originalCurrency,
          discount: offerData.price?.discount || null,
        },
      },

      hotel: {
        hotelId: hotelData._id,
        name: hotelData.name,
        location: {
          country: hotelData.location.country,
          city: hotelData.location.city,
          address: hotelData.location.address,
        },
        image: hotelData.images?.[0] || "",
        externalId: hotelData.externalId || null,
      },

      guest,
      checkInDate,
      checkOutDate,
      nights,
      totalPrice,
      paymentMethod,
      paymentStatus,
      bookingStatus: "waiting_approval",
      orderStatus,
    });

    await newBooking.save();

    res.status(201).json({
      message: "Booking created successfully",
      bookingId: newBooking._id,
    });
  } catch (error) {
    console.error("❌ Booking creation error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

export const getUserBookings = async (req, res) => {
  try {
    const bookings = await Booking.find({ user: req.user.id });
    res.status(200).json(bookings);
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

export const getBookingById = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ message: "Booking not found" });

    res.status(200).json(booking);
  } catch (error) {
    console.error("❌ Booking fetch error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

export const cancelBooking = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ message: "Booking not found" });

    if (booking.bookingStatus === "cancelled") {
      return res.status(400).json({ message: "Booking is already cancelled" });
    }

    booking.bookingStatus = "cancelled";
    booking.orderStatus = "cancelled_by_user";
    await booking.save();

    res
      .status(200)
      .json({ message: "Booking cancelled successfully", booking });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

export const markBookingAsPaid = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ message: "Booking not found" });

    if (booking.paymentStatus === "verified") {
      return res.status(400).json({ message: "Booking already marked as paid" });
    }

    booking.paymentStatus = "verified";
    booking.orderStatus = "awaiting_confirmation";

    await booking.save();

    await grantLoyaltyBonus(booking);

    res.status(200).json({
      message: "Payment marked as verified, loyalty bonus granted",
      booking,
    });
  } catch (error) {
    console.error("❌ Error in markBookingAsPaid:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};