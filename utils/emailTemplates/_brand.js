// utils/emailTemplates/_brand.js
export const BRAND_NAME = process.env.EMAIL_BRAND_NAME || "inLobby.com";
export const BRAND_URL  = process.env.EMAIL_BRAND_URL  || "https://inlobby.com";
export const PRIMARY_HEX = process.env.EMAIL_PRIMARY_HEX || "#f36323";

export const SUPPORT_EMAIL = process.env.SUPPORT_EMAIL || "support@inlobby.com";
export const REPLY_TO = process.env.EMAIL_REPLY_TO || "no-reply@inlobby.com";
export const FRONTEND = (process.env.FRONTEND_URL || process.env.APP_BASE_URL || "http://localhost:3000").replace(/\/$/,"");

// white brand anchor (forces white even in picky email clients)
export function brandHeaderHTML(titleSmall = "") {
  return `
    <div style="padding:14px 18px;background:${PRIMARY_HEX};color:#ffffff;">
      <div style="font-weight:800;font-size:16px;line-height:1">
        <a href="${BRAND_URL}"
           style="color:#ffffff !important;text-decoration:none !important;display:inline-block;font-weight:800;font-size:16px;line-height:1">
          <font color="#ffffff">${BRAND_NAME}</font>
        </a>
      </div>
      ${titleSmall ? `<div style="opacity:.9;font-size:13px;line-height:1.25">${titleSmall}</div>` : ``}
    </div>
  `;
}

// common CTA button
export function ctaButtonHTML(href, label = "View Details") {
  return `
    <a href="${href}"
       style="display:inline-block;background:${PRIMARY_HEX};color:#ffffff !important;padding:10px 14px;border-radius:10px;text-decoration:none;font-weight:700">
      ${label}
    </a>
  `;
}

// fine print (common footer)
export function finePrintHTML(lang = "en") {
  const lines = {
    en: {
      note1: "This is an automated message. Replies to this email are not monitored.",
      note2: `For questions please contact ${SUPPORT_EMAIL}.`,
      note3: "If your booking is non-refundable or past the free cancellation deadline, fees may apply.",
    },
    hy: {
      note1: "Սա ավտոմատ նամակ է․ պատասխանները չեն մշակում։",
      note2: `Հարցերի դեպքում գրեք ${SUPPORT_EMAIL} հասցեին։`,
      note3: "Եթե ամրագրումը չվերադարձվող է կամ անցել է անվճար չեղարկման ժամկետը, կարող են կիրառվել տույժեր։",
    }
  }[lang] || this.en;

  return `
    <div style="margin-top:14px;padding-top:12px;border-top:1px solid #e5e7eb;color:#6b7280;font-size:12px;line-height:1.55">
      <div>${lines.note1}</div>
      <div>${lines.note2}</div>
      <div>${lines.note3}</div>
    </div>
  `;
}

// wraps full card layout
export function wrapCardHTML(inner) {
  return `
    <div style="font-family:Inter,system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#111827;">
      <div style="max-width:640px;margin:24px auto;border:1px solid #e5e7eb;border-radius:16px;overflow:hidden;box-shadow:0 6px 16px rgba(0,0,0,.06)">
        ${inner}
      </div>
    </div>
  `;
}

// utils/emailTemplates/_brand.js (append these helpers)

export function officeContactHTML() {
  const phone = process.env.OFFICE_PHONE || "+37460400006";
  const company = process.env.OFFICE_NAME || "inLobby Com";
  return `
    <div style="margin-top:12px;padding-top:10px;border-top:1px dashed #e5e7eb;font-size:12px;line-height:1.55;color:#374151">
      <div style="font-weight:700">${company}</div>
      <div>Phone: ${phone}</div>
      <div>E-Mail: ${SUPPORT_EMAIL}</div>
      <div style="margin-top:6px;color:#6b7280">Dear customer, this notification is for your info only, it cannot be used as a voucher.</div>
    </div>
  `;
}

export function legalNoticeHTML() {
  return `
    <div style="margin-top:10px;font-size:11px;line-height:1.55;color:#6b7280">
      CONFIDENTIAL! This email contains confidential information and is intended for the authorized recipient only.
      If you are not an authorized recipient please return the email to us and then delete it from your computer and mail-server.
      You may neither use nor edit any such emails including attachments, nor make them accessible to third parties in any manner whatsoever.
      Thank you for your cooperation.
    </div>
  `;
}