// New
import nodemailer from "nodemailer";

let transporter;
export function getTransporter() {
  if (transporter) return transporter;
  transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: Number(process.env.EMAIL_PORT || 465),
    secure: true,
    auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
    logger: false,   // 👈 debug for now
    debug: false
  });
  return transporter;
}

export async function sendEmail(p = {}) {
  const {
    to,
    subject,
    html,
    text,
    replyTo,            // կարող է undefined լինել՝ OK
    fromOverride
  } = p;

  const envFrom = (process.env.EMAIL_FROM || "").trim();     // e.g. "Your Name <test@...>"
  const fromName = process.env.EMAIL_FROM_NAME || "inLobby";
  const fromEmail = (process.env.EMAIL_USER || "").trim();

  // Display From
  const displayFrom = fromOverride
    ? fromOverride                    // 👈 force plain mailbox (test@inlobby.com)
    : (envFrom.includes("<") && envFrom.includes(">"))
        ? envFrom
        : `${fromName} <${fromEmail}>`;

  // Envelope FROM պետք է լինի authenticated user
  const envelope = { from: fromEmail, to };

  const mail = {
    from: displayFrom,
    to,
    subject,
    html,
    text,
    envelope
  };
  if (replyTo) mail.replyTo = replyTo; // միայն եթե տրված է

  try {
    const tx = getTransporter();
    await tx.sendMail(mail);
  } catch (err) {
    console.error("✉️ sendEmail failed:", {
      message: err?.message,
      code: err?.code,
      command: err?.command,
      response: err?.response,
      to,
      displayFrom,
      envelopeFrom: envelope.from
    });
    throw err;
  }
}