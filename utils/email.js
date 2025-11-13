// import nodemailer from "nodemailer";

// export const sendResetEmail = async (email, token) => {
//   const transporter = nodemailer.createTransport({
//     host: process.env.EMAIL_HOST,
//     port: process.env.EMAIL_PORT,
//     secure: true, // ✅ Պետք է true լինի, եթե օգտագործում ես 465 port
//     auth: {
//       user: process.env.EMAIL_USER,
//       pass: process.env.EMAIL_PASS,
//     },
//   });

//   const resetLink = `http://localhost:3000/reset-password?token=${token}`;

//   const mailOptions = {
//     from: process.env.EMAIL_FROM,
//     to: email,
//     subject: "Password Reset Request",
//     html: `<p>Click <a href="${resetLink}">here</a> to reset your password.</p>`,
//   };

//   await transporter.sendMail(mailOptions);
// };

// New

import { sendEmail } from "./mailer.js";
import { resetSubject, resetHtml } from "./emailTemplates/resetPassword.js";

export const sendResetEmail = async (email, token) => {
  const base = process.env.FRONTEND_URL || process.env.APP_BASE_URL || "http://localhost:3000";
  const resetLink = `${base.replace(/\/$/,"")}/reset-password?token=${encodeURIComponent(token)}`;

  await sendEmail({
    to: email,
    subject: resetSubject(),
    html: resetHtml({ resetLink }),
    fromOverride: process.env.EMAIL_USER,   // 👈 ուղիղ mailbox, առանց display name
    replyTo: undefined                      // 👈 հանում ենք reply-to-ն
  });
//   await sendEmail({
//   to: email,
//   subject: resetSubject(),
//   html: resetHtml({ resetLink }),
//   fromOverride: `${process.env.EMAIL_FROM_NAME || "inLobby"} <${process.env.EMAIL_USER}>`,
//   replyTo: process.env.EMAIL_REPLY_TO || "no-reply@inlobby.com",
// });
};