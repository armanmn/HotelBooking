// controllers/bookingController.js

const Booking = require('../models/Booking');
const Room = require('../models/Room');

// Ստեղծել նոր ամրագրում
exports.createBooking = async (req, res) => {
  const { roomId, checkIn, checkOut, guests } = req.body;

  try {
    const room = await Room.findById(roomId);
    if (!room) {
      return res.status(404).json({ message: 'Սենյակը չի գտնվել' });
    }

    // Ստուգել սենյակի հասանելիությունը նշված ամսաթվերի համար
    const isAvailable = room.availableDates.some(
      (date) =>
        new Date(date.startDate) <= new Date(checkIn) &&
        new Date(date.endDate) >= new Date(checkOut)
    );

    if (!isAvailable) {
      return res.status(400).json({ message: 'Սենյակը հասանելի չէ նշված ամսաթվերի համար' });
    }

    const newBooking = new Booking({
      user: req.user.id,
      hotel: room.hotel,
      room: roomId,
      checkIn,
      checkOut,
      guests,
      totalPrice: room.price * (new Date(checkOut) - new Date(checkIn)) / (1000 * 60 * 60 * 24),
    });

    await newBooking.save();

    res.status(201).json(newBooking);
  } catch (error) {
    res.status(500).json({ message: 'Սերվերի սխալ' });
  }
};

// Ստանալ օգտատիրոջ ամրագրումները
exports.getUserBookings = async (req, res) => {
  try {
    const bookings = await Booking.find({ user: req.user.id }).populate('hotel room');
    res.json(bookings);
  } catch (error) {
    res.status(500).json({ message: 'Սերվերի սխալ' });
  }
};

// Չեղարկել ամրագրում
exports.cancelBooking = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) {
      return res.status(404).json({ message: 'Ամրագրումը չի գտնվել' });
    }

    if (booking.user.toString() !== req.user.id) {
      return res.status(401).json({ message: 'Չեք կարող չեղարկել այս ամրագրումը' });
    }

    booking.status = 'Cancelled';
    await booking.save();

    res.json({ message: 'Ամրագրումը հաջողությամբ չեղարկվել է' });
  } catch (error) {
    res.status(500).json({ message: 'Սերվերի սխալ' });
  }
};