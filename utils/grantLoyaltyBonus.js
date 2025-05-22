import User from "../models/User.js";

/**
 * 📌 Calculate and grant loyalty bonus to user after successful payment.
 * @param {Object} booking - Booking document (already paid).
 */
export const grantLoyaltyBonus = async (booking) => {
  try {
    if (!booking?.user || !booking?.totalPrice) {
      console.warn("⚠️ No user or totalPrice in booking. Skipping bonus.");
      return;
    }

    // Fetch the user
    const user = await User.findById(booking.user);
    if (!user) {
      console.warn("⚠️ User not found. Cannot grant bonus.");
      return;
    }

    // Determine the loyalty rate
    let loyaltyRate = 0;

    if (user.role === "b2b_sales_partner") {
      loyaltyRate = user.loyaltyRate || 0; // individualized for agent
    } else if (user.role === "b2c") {
      loyaltyRate = 1; // 1% default for B2C users
    }

    if (loyaltyRate <= 0) {
      console.info(`ℹ️ Loyalty rate is ${loyaltyRate}%. No bonus awarded.`);
      return;
    }

    // Calculate bonus amount
    const bonusAmount = (booking.totalPrice * loyaltyRate) / 100;

    // Update user's balance
    user.balance = (user.balance || 0) + bonusAmount;
    await user.save();

    console.log(
      `🎉 Loyalty bonus granted: +${bonusAmount.toFixed(2)}֏ to ${user.email}`
    );
  } catch (error) {
    console.error("❌ Error granting loyalty bonus:", error);
  }
};