// controllers/paymentController.js

const Payment = require('../models/Payment');
const Booking = require('../models/Booking');

// Ստեղծել նոր վճարում
exports.createPayment = async (req, res) => {
  const { bookingId, amount, paymentMethod } = req.body;

  try {
    const booking = await Booking.findById(bookingId);
    if (!booking) {
      return res.status(404).json({ message: 'Ամրագրումը չի գտնվել' });
    }

    // Ստեղծել նոր վճարում
    const newPayment = new Payment({
      user: req.user.id,
      booking: bookingId,
      amount,
      paymentMethod,
      status: 'Completed', // Կախված ձեր վճարային համակարգից, կարող է լինել 'Pending'
    });

    await newPayment.save();

    // Թարմացնել ամրագրումը որպես վճարված
    booking.isPaid = true;
    await booking.save();

    res.status(201).json(newPayment);
  } catch (error) {
    res.status(500).json({ message: 'Սերվերի սխալ' });
  }
};

// Ստանալ օգտատիրոջ վճարումները
exports.getUserPayments = async (req, res) => {
  try {
    const payments = await Payment.find({ user: req.user.id }).populate('booking');
    res.json(payments);
  } catch (error) {
    res.status(500).json({ message: 'Սերվերի սխալ' });
  }
};

// Ստանալ բոլոր վճարումները (միայն ադմինիստրատորների համար)
exports.getAllPayments = async (req, res) => {
  try {
    const payments = await Payment.find().populate('booking user');
    res.json(payments);
  } catch (error) {
    res.status(500).json({ message: 'Սերվերի սխալ' });
  }
};