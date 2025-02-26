import Payment from "../models/Payment.js";
import Booking from "../models/Booking.js";
import GlobalSettings from "../models/GlobalSettings.js";

// ✅ Վճարում կատարելու API (B2C & B2B օգտատերեր)
export const processPayment = async (req, res) => {
  try {
    const { bookingId, amount, currency, paymentMethod, transactionId } = req.body;

    const booking = await Booking.findById(bookingId);
    if (!booking) {
      return res.status(404).json({ message: "Booking not found" });
    }

    // Ստանում ենք ընթացիկ փոխարժեքները
    const globalSettings = await GlobalSettings.findOne();
    if (!globalSettings) {
      return res.status(500).json({ message: "Exchange rates not found" });
    }

    // Կախված արժույթից՝ հաշվարկում ենք AMD համարժեքը
    const exchangeRate = globalSettings.exchangeRates[currency];
    if (!exchangeRate) {
      return res.status(400).json({ message: "Invalid currency or missing exchange rate" });
    }
    const convertedAmountAMD = amount * exchangeRate;

    // Ստեղծում ենք նոր վճարում
    const newPayment = new Payment({
      userId: req.user.id,
      bookingId,
      amount,
      currency,
      exchangeRate,
      convertedAmountAMD,
      paymentMethod,
      transactionId,
      status: "pending",
    });

    await newPayment.save();
    res.status(201).json({ message: "Payment initiated successfully", payment: newPayment });
  } catch (error) {
    res.status(500).json({ message: "Payment processing failed", error: error.message });
  }
};

// ✅ Ստանալ բոլոր վճարումները (Finance User)
export const getAllPayments = async (req, res) => {
  try {
    const payments = await Payment.find().populate("userId", "name email").populate("bookingId");
    res.status(200).json(payments);
  } catch (error) {
    res.status(500).json({ message: "Something went wrong", error: error.message });
  }
};

// ✅ Ստանալ օգտատիրոջ վճարումները (B2C & B2B)
export const getUserPayments = async (req, res) => {
  try {
    const payments = await Payment.find({ userId: req.user.id }).populate("bookingId");
    res.status(200).json(payments);
  } catch (error) {
    res.status(500).json({ message: "Something went wrong", error: error.message });
  }
};

// ✅ Ստանալ կոնկրետ վճարման տվյալները ըստ ID-ի (Finance User)
export const getPaymentById = async (req, res) => {
  try {
    const payment = await Payment.findById(req.params.id).populate("bookingId userId");
    if (!payment) {
      return res.status(404).json({ message: "Payment not found" });
    }
    res.status(200).json(payment);
  } catch (error) {
    res.status(500).json({ message: "Something went wrong", error: error.message });
  }
};

// ✅ Վճարման կարգավիճակի թարմացում (Finance User)
export const updatePaymentStatus = async (req, res) => {
  try {
    const { status } = req.body;
    if (!["pending", "completed", "failed", "refunded"].includes(status)) {
      return res.status(400).json({ message: "Invalid payment status" });
    }

    const payment = await Payment.findByIdAndUpdate(
      req.params.id,
      { status, processedAt: new Date(), processedBy: req.user.id },
      { new: true }
    );

    if (!payment) {
      return res.status(404).json({ message: "Payment not found" });
    }

    // Եթե վճարումը հաստատվել է, ամրագրումը դարձնել "paid"
    if (status === "completed") {
      const booking = await Booking.findById(payment.bookingId);
      if (booking) {
        booking.status = "paid";
        await booking.save();
      }
    }

    res.status(200).json({ message: "Payment status updated successfully", payment });
  } catch (error) {
    res.status(500).json({ message: "Something went wrong", error: error.message });
  }
};

// ✅ Մուտքագրել բանկային վճարում (Finance User)
export const recordBankPayment = async (req, res) => {
  try {
    const { bookingId, amount, currency, bankTransactionId } = req.body;

    const booking = await Booking.findById(bookingId);
    if (!booking) {
      return res.status(404).json({ message: "Booking not found" });
    }

    // Ստանում ենք ընթացիկ փոխարժեքները
    const globalSettings = await GlobalSettings.findOne();
    if (!globalSettings) {
      return res.status(500).json({ message: "Exchange rates not found" });
    }

    const exchangeRate = globalSettings.exchangeRates[currency];
    if (!exchangeRate) {
      return res.status(400).json({ message: "Invalid currency or missing exchange rate" });
    }
    const convertedAmountAMD = amount * exchangeRate;

    // Ստեղծում ենք բանկային վճարումը
    const newPayment = new Payment({
      userId: req.user.id,
      bookingId,
      amount,
      currency,
      exchangeRate,
      convertedAmountAMD,
      paymentMethod: "bank_transfer",
      transactionId: bankTransactionId,
      status: "completed",
      processedBy: req.user.id,
      processedAt: new Date(),
    });

    await newPayment.save();
    res.status(201).json({ message: "Bank payment recorded successfully", payment: newPayment });
  } catch (error) {
    res.status(500).json({ message: "Failed to record bank payment", error: error.message });
  }
};