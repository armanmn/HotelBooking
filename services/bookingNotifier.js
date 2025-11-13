// // services/bookingNotifier.js
// import { sendEmail } from "../utils/mailer.js";
// import { subjectConfirmed, htmlConfirmed } from "../utils/emailTemplates/bookingConfirmed.js";
// import { subjectCancelled, htmlCancelled } from "../utils/emailTemplates/bookingCancelled.js";
// import { subjectRejected, htmlRejected } from "../utils/emailTemplates/bookingRejected.js";
// import { subjectVoucher, htmlVoucher } from "../utils/emailTemplates/voucherIssued.js";
// import { subjectPayment, htmlPayment } from "../utils/emailTemplates/paymentReceived.js";

// function pickupUserEmail(order) {
//   return order?.summary?.userEmail || order?.userEmail || null;
// }

// export async function notifyOnFinalStatus(order, prevStatus) {
//   const to = pickupUserEmail(order);
//   if (!to) return;

//   const was = String(prevStatus || "").toUpperCase();
//   const now = String(order?.status || "").toUpperCase();
//   if (was === now) return; // avoid duplicates

//   try {
//     if (now === "C") {
//       await sendEmail({ to, subject: subjectConfirmed(), html: htmlConfirmed(order) });
//     } else if (now === "X") {
//       await sendEmail({ to, subject: subjectCancelled(), html: htmlCancelled(order) });
//     } else if (now === "RJ") {
//       await sendEmail({ to, subject: subjectRejected(), html: htmlRejected(order) });
//     } else if (now === "VCH") {
//       await sendEmail({ to, subject: subjectVoucher(), html: htmlVoucher(order) });
//     }
//   } catch (e) {
//     console.error("notifyOnFinalStatus failed:", e?.message || e);
//   }
// }

// export async function notifyOnPaymentVerified(order, prevPaymentStatus) {
//   const to = pickupUserEmail(order);
//   if (!to) return;

//   const was = String(prevPaymentStatus || "").toLowerCase();
//   const now = String(order?.payment?.status || "").toLowerCase();
//   if (was === now) return;
//   if (now !== "verified" && now !== "paid") return;

//   try {
//     await sendEmail({ to, subject: subjectPayment(), html: htmlPayment(order) });
//   } catch (e) {
//     console.error("notifyOnPaymentVerified failed:", e?.message || e);
//   }
// }

// services/bookingNotifier.js (փոքր շտկում՝ email picker + lang)
import { sendEmail } from "../utils/mailer.js";
import { subjectConfirmed, htmlConfirmed } from "../utils/emailTemplates/bookingConfirmed.js";
import { subjectCancelled, htmlCancelled } from "../utils/emailTemplates/bookingCancelled.js";
import { subjectRejected, htmlRejected } from "../utils/emailTemplates/bookingRejected.js";
import { subjectVoucher, htmlVoucher } from "../utils/emailTemplates/voucherIssued.js";
import { subjectPayment, htmlPayment } from "../utils/emailTemplates/paymentReceived.js";

function getUserEmail(order) {
  return order?.summary?.userEmail || order?.userEmail || null;
}
function getLang(order) {
  // եթե հետո պահես order.summary.locale կամ user.locale, այստեղից վերցրու
  return process.env.EMAIL_DEFAULT_LANG || "en"; // կամ "hy"
}

export async function notifyOnFinalStatus(order, prevStatus) {
  const to = getUserEmail(order);
  if (!to) return;

  const was = String(prevStatus || "").toUpperCase();
  const now = String(order?.status || "").toUpperCase();
  if (was === now) return;

  const lang = getLang(order);

  try {
    if (now === "C") {
      await sendEmail({ to, subject: subjectConfirmed(lang), html: htmlConfirmed(order, lang) });
    } else if (now === "X") {
      await sendEmail({ to, subject: subjectCancelled(lang), html: htmlCancelled(order, lang) });
    } else if (now === "RJ") {
      await sendEmail({ to, subject: subjectRejected(lang), html: htmlRejected(order, lang) });
    } else if (now === "VCH") {
      await sendEmail({ to, subject: subjectVoucher(lang), html: htmlVoucher(order, lang) });
    }
  } catch (e) {
    console.error("notifyOnFinalStatus failed:", e?.message || e);
  }
}

export async function notifyOnPaymentVerified(order, prevPaymentStatus) {
  const to = getUserEmail(order);
  if (!to) return;

  const was = String(prevPaymentStatus || "").toLowerCase();
  const now = String(order?.payment?.status || "").toLowerCase();
  if (was === now) return;
  if (now !== "verified" && now !== "paid") return;

  const lang = getLang(order);

  try {
    await sendEmail({ to, subject: subjectPayment(lang), html: htmlPayment(order, lang) });
  } catch (e) {
    console.error("notifyOnPaymentVerified failed:", e?.message || e);
  }
}