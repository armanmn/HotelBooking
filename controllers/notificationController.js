// New

import { sendEmail } from "../utils/mailer.js";
import { orderEventSubject, orderEventHtml } from "../utils/emailTemplates/orderEvent.js";
import HotelOrder from "../models/HotelOrder.js"; // եթե ունես այս մոդելը

export const sendOrderEventEmail = async (req, res, next) => {
  try {
    const { event, platformRef, userEmail, summary, details, remarksHtml } = req.body;

    // եթե userEmail չի ուղարկվել՝ փորձել բերել order-ից
    let to = userEmail;
    if (!to && platformRef) {
      const order = await HotelOrder.findOne({ platformRef }).lean();
      to = order?.summary?.userEmail || order?.customer?.email;
    }

    if (!to) return res.status(400).json({ ok:false, message:"Recipient email not found" });

    const subject = orderEventSubject({ type: event, platformRef });
    const html = orderEventHtml({
      type: event,
      platformRef,
      summary: summary || {},   // կամ order?.summary
      details: details || {},   // կամ order?.details
      remarksHtml: remarksHtml, // optional
    });

    await sendEmail({ to, subject, html });
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
};