import Booking from "../models/Booking.js";
import Hotel from "../models/Hotel.js";
import Room from "../models/Room.js";
import { grantLoyaltyBonus } from "../utils/grantLoyaltyBonus.js";

/**
 * 📌 Ստեղծել նոր ամրագրում (with full guest, hotel, room data)
 */
// export const createBooking = async (req, res) => {
//   if (!req.user || !req.user.id) {
//     return res.status(401).json({ message: "Unauthorized" });
//   }

//   try {
//     const {
//       hotel,
//       room,
//       guest,
//       checkInDate,
//       checkOutDate,
//       nights,
//       totalPrice,
//       paymentMethod,
//     } = req.body;

//     const userId = req.user.id;

//     // ✅ Fetch full hotel & room data for snapshot
//     const hotelData = await Hotel.findById(hotel);
//     const roomData = await Room.findById(room);

//     if (!hotelData || !roomData) {
//       return res.status(404).json({ message: "Hotel or Room not found" });
//     }

//     // Վճարային կարգավիճակ ըստ մեթոդի
//     let paymentStatus = "not_paid";
//     if (paymentMethod === "credit_card" || paymentMethod === "balance") {
//       paymentStatus = "paid_pending_verification";
//     }

//     const orderStatus =
//       paymentStatus === "not_paid"
//         ? "awaiting_payment"
//         : "awaiting_confirmation";

//     const newBooking = new Booking({
//       user: userId,
//       hotel: {
//         hotelId: hotelData._id,
//         name: hotelData.name,
//         location: {
//           country: hotelData.location.country,
//           city: hotelData.location.city,
//           address: hotelData.location.address,
//         },
//         image: hotelData.images?.[0] || "",
//       },
//       room: {
//         roomId: roomData._id,
//         type: roomData.type,
//         description: roomData.description,
//         price: roomData.price,
//         maxOccupancy: roomData.maxOccupancy,
//         amenities: roomData.amenities || [],
//       },
//       guest,
//       checkInDate,
//       checkOutDate,
//       nights,
//       totalPrice,
//       paymentMethod,
//       paymentStatus,
//       bookingStatus: "waiting_approval",
//       orderStatus,
//     });

//     console.log("📥 Booking Payload:", {
//       hotel,
//       room,
//       guest,
//       checkInDate,
//       checkOutDate,
//       nights,
//       totalPrice,
//       paymentMethod,
//     });
//     await newBooking.save();

//     res.status(201).json({
//       message: "Booking created successfully",
//       bookingId: newBooking._id,
//     });
//   } catch (error) {
//     console.error("❌ Booking creation error:", error);
//     res.status(500).json({ message: "Server error", error: error.message });
//   }
// };

export const createBooking = async (req, res) => {
  if (!req.user || !req.user.id) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  try {
    const {
      hotel,
      room,
      guest,
      checkInDate,
      checkOutDate,
      nights,
      totalPrice,
      paymentMethod,
    } = req.body;

    const userId = req.user.id;

    const hotelData = await Hotel.findById(hotel);
    const roomData = await Room.findById(room);

    if (!hotelData || !roomData) {
      return res.status(404).json({ message: "Hotel or Room not found" });
    }

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
      hotel: {
        hotelId: hotelData._id,
        name: hotelData.name,
        location: {
          country: hotelData.location.country,
          city: hotelData.location.city,
          address: hotelData.location.address,
        },
        image: hotelData.images?.[0] || "",
      },
      room: {
        roomId: roomData._id,
        type: roomData.type,
        description: roomData.description,
        price: roomData.price,
        maxOccupancy: roomData.maxOccupancy,
        amenities: roomData.amenities || [],
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
      loyaltyBonus: 0, // ✅ Առայժմ 0, հետո կլրացվի
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

/**
 * 📌 Ստանալ օգտագործողի բոլոր ամրագրումները
 */
export const getUserBookings = async (req, res) => {
  try {
    const bookings = await Booking.find({ user: req.user.id });
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
    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ message: "Booking not found" });

    res.status(200).json(booking);
  } catch (error) {
    console.error("❌ Booking fetch error:", error);
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

    // ✅ Վերականգնում ենք ստատուսները
    booking.paymentStatus = "verified"; // 🔥 վճարումը հաստատված է
    booking.orderStatus = "awaiting_confirmation"; // 🔥 սպասում է հաստատման

    await booking.save(); // պահում ենք փոփոխությունները

    // ✅ Հաշվում ենք Loyalty Bonus եթե վճարումը հաստատվել է
    await grantLoyaltyBonus(booking);

    res.status(200).json({ message: "Payment marked as verified, loyalty bonus granted", booking });
  } catch (error) {
    console.error("❌ Error in markBookingAsPaid:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};