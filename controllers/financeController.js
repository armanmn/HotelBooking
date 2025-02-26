import Finance from "../models/Finance.js";
import Payment from "../models/Payment.js";
import GlobalSettings from "../models/GlobalSettings.js";

// ✅ Վերադարձնում է արժույթների փոխարժեքները (Finance User & Admin)
export const getExchangeRates = async (req, res) => {
  try {
    const settings = await GlobalSettings.findOne();
    if (!settings) {
      return res.status(404).json({ message: "Exchange rates not found" });
    }
    res.status(200).json(settings.exchangeRates);
  } catch (err) {
    res.status(500).json({ message: "Something went wrong", error: err.message });
  }
};

// ✅ Թարմացնում է արժույթների փոխարժեքները (Միայն Finance User)
export const updateExchangeRates = async (req, res) => {
  try {
    const { exchangeRates } = req.body;

    if (
      !exchangeRates ||
      typeof exchangeRates.USD !== "number" ||
      typeof exchangeRates.EUR !== "number" ||
      typeof exchangeRates.RUB !== "number"
    ) {
      return res.status(400).json({ message: "Invalid exchange rates format" });
    }

    let settings = await GlobalSettings.findOne();
    if (!settings) {
      settings = new GlobalSettings();
    }

    settings.exchangeRates = exchangeRates;
    await settings.save();

    res.status(200).json({ message: "Exchange rates updated successfully", settings });
  } catch (err) {
    res.status(500).json({ message: "Something went wrong", error: err.message });
  }
};

// ✅ Վերադարձնում է բոլոր ֆինանսական գրառումները (Finance User)
export const getFinanceRecords = async (req, res) => {
  try {
    const records = await Finance.find().sort({ createdAt: -1 });
    res.status(200).json(records);
  } catch (err) {
    res.status(500).json({ message: "Something went wrong", error: err.message });
  }
};

// ✅ Ավելացնում է նոր ֆինանսական գրառում (Finance User)
export const recordTransaction = async (req, res) => {
  try {
    const { transactionType, amount, currency, exchangeRate, convertedAmountAMD, referenceId, referenceModel, note } = req.body;

    if (!["incoming", "outgoing"].includes(transactionType)) {
      return res.status(400).json({ message: "Invalid transaction type" });
    }

    const newTransaction = new Finance({
      transactionType,
      amount,
      currency,
      exchangeRate,
      convertedAmountAMD,
      referenceId,
      referenceModel,
      processedBy: req.user.id,
      note
    });

    await newTransaction.save();
    res.status(201).json({ message: "Transaction recorded successfully", newTransaction });
  } catch (err) {
    res.status(500).json({ message: "Something went wrong", error: err.message });
  }
};

// ✅ Վերադարձնում է բոլոր վճարումները (Finance User)
export const getAllPayments = async (req, res) => {
  try {
    const payments = await Payment.find().populate("bookingId userId");
    res.status(200).json(payments);
  } catch (err) {
    res.status(500).json({ message: "Something went wrong", error: err.message });
  }
};

// ✅ Թարմացնում է վճարման կարգավիճակը (Finance User)
export const updatePaymentStatus = async (req, res) => {
  try {
    const { status } = req.body;

    const payment = await Payment.findById(req.params.id);
    if (!payment) {
      return res.status(404).json({ message: "Payment not found" });
    }

    payment.status = status;
    await payment.save();

    res.status(200).json({ message: "Payment status updated successfully", payment });
  } catch (err) {
    res.status(500).json({ message: "Something went wrong", error: err.message });
  }
};