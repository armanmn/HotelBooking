// // utils/emailTemplates/paymentReceived.js
// import { pageShell, meta, line, button } from "./_base.js";

// export const subjectPayment = () => "Payment Received – inLobby.com";

// export const htmlPayment = (order = {}) => {
//   const m = meta(order);
//   const method = String(order?.payment?.method || "").replace(/_/g," ");
//   const body = `
//     <p>Your payment has been <b>VERIFIED</b>.</p>
//     ${line("Platform Ref", order?.platformRef)}
//     ${m.price ? line("Amount", m.price) : ""}
//     ${line("Method", method || "—")}
//     ${button(m.orderUrl, "View Booking")}
//     <p style="color:#6b7280">If you need an invoice, you can download it from the booking page.</p>
//   `;
//   return pageShell({ title: "Payment Received", subtitle: "Billing", bodyHtml: body });
// };

// utils/emailTemplates/paymentReceived.js
import {
  BRAND_NAME,
  brandHeaderHTML,
  ctaButtonHTML,
  finePrintHTML,
  wrapCardHTML,
  FRONTEND,
  officeContactHTML,
  legalNoticeHTML,
} from "./_brand.js";
import { t } from "./_i18n.js";

export function subjectPayment(lang = "en") {
  return `${t(lang, "payment")} — ${BRAND_NAME}`;
}

export function htmlPayment(order = {}, lang = "en") {
  const href = `${FRONTEND}/admin/bookings/status/${encodeURIComponent(
    order?.platformRef || ""
  )}?refresh=1`;

  const summary = order?.summary || {};
  const amount =
    summary?.price
      ? `${summary.price.amount} ${summary.price.currency || ""}`.trim()
      : order?.price
      ? `${order.price.amount} ${order.price.currency || ""}`.trim()
      : "—";
  const method = String(order?.payment?.method || "").replace(/_/g, " ") || "—";

  const body = `
    ${brandHeaderHTML(t(lang, "payment"))}
    <div style="padding:16px 18px;background:#ffffff;font-size:14px;line-height:1.55">
      <p style="margin:0 0 10px 0;">Your payment has been <b>VERIFIED</b>.</p>

      <div style="margin:10px 0;">
        <div style="display:flex;gap:8px;margin:4px 0;"><div style="min-width:140px;color:#6b7280">Platform Ref</div><div><b>${order?.platformRef || "—"}</b></div></div>
        <div style="display:flex;gap:8px;margin:4px 0;"><div style="min-width:140px;color:#6b7280">Amount</div><div><b>${amount}</b></div></div>
        <div style="display:flex;gap:8px;margin:4px 0;"><div style="min-width:140px;color:#6b7280">Method</div><div><b>${method}</b></div></div>
      </div>

      <p style="margin:14px 0;">${ctaButtonHTML(href, t(lang, "viewDetails"))}</p>
      <p style="color:#6b7280;margin:6px 0 0 0;">If you need an invoice, you can download it from the booking page.</p>

      ${finePrintHTML(lang)}
      ${officeContactHTML()}
      ${legalNoticeHTML()}
    </div>
  `;
  return wrapCardHTML(body);
}