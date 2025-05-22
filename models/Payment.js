import mongoose from "mongoose";

const PaymentSchema = new mongoose.Schema(
  {
    userId: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: "User", 
      required: true 
    },
    bookingId: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: "Booking", 
      required: true 
    },
    amount: { 
      type: Number, 
      required: true 
    },
    currency: { 
      type: String, 
      enum: ["AMD", "USD", "EUR", "RUB"], // ✅ Բոլոր ընդունված արժույթները
      required: true 
    },
    exchangeRate: { 
      type: Number, 
      required: true 
    }, // ✅ Ֆինանսական բաժինը սահմանում է փոխարժեքը
    
    convertedAmountAMD: { 
      type: Number, 
      required: true 
    }, // ✅ Պահպանում ենք AMD-ով փոխարկված գումարը
    
    paymentMethod: {
      type: String, 
      enum: ["credit_card", "bank_transfer", "balance", "pay_later"],
      required: true 
    },
    transactionId: { 
      type: String, 
      unique: true 
    }, // ✅ Անհատական ID (եթե առկա է)
    
    status: { 
      type: String, 
      enum: ["pending", "completed", "failed", "refunded"], 
      default: "pending" 
    },
    
    processedBy: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: "User", 
      default: null 
    }, // ✅ Վճարումը հաստատած աշխատակից
    
    processedAt: { 
      type: Date 
    }, // ✅ Վճարման հաստատման ժամկետ
    
    bankTransactionId: { 
      type: String, 
      default: null 
    }, // ✅ Բանկային գործարքի համար (եթե առկա է)
    
    refundAmount: { 
      type: Number,
      default: 0
    }, // ✅ Վերադարձվող գումարի չափը

    penaltyFee: {
      type: Number,
      default: 0
    }, // ✅ Տուգանքի չափը

  },
  { timestamps: true }
);

const Payment = mongoose.model("Payment", PaymentSchema);
export default Payment;