// // utils/emailTemplates/voucherIssued.js
// import { pageShell, meta, line, button } from "./_base.js";

// export const subjectVoucher = () => "Voucher Issued – inLobby.com";

// export const htmlVoucher = (order = {}) => {
//   const m = meta(order);
//   const body = `
//     <p>Your <b>VOUCHER</b> is ready.</p>
//     ${line("Platform Ref", order?.platformRef)}
//     ${line("Hotel", m.service)}
//     ${line("Arrival", m.arrival)}
//     ${line("Nights", m.nights)}
//     ${button(m.orderUrl, "View / Download Voucher")}
//     <p style="color:#6b7280">Please carry a copy (printed or digital) during check-in.</p>
//   `;
//   return pageShell({ title: "Voucher Issued", subtitle: "Documents", bodyHtml: body });
// };

// utils/emailTemplates/voucherIssued.js
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

export function subjectVoucher(lang = "en") {
  return `${t(lang, "voucher")} — ${BRAND_NAME}`;
}

export function htmlVoucher(order = {}, lang = "en") {
  const href = `${FRONTEND}/admin/bookings/status/${encodeURIComponent(
    order?.platformRef || ""
  )}?refresh=1`;

  const summary = order?.summary || {};
  const mHotel = order?.hotel || {};
  const hotel = summary.service || mHotel.name || "—";
  const arrival = summary.arrivalDate || order?.context?.arrivalDate || "—";
  const nights = summary.nights || order?.context?.nights || "—";

  const body = `
    ${brandHeaderHTML(t(lang, "voucher"))}
    <div style="padding:16px 18px;background:#ffffff;font-size:14px;line-height:1.55">
      <p style="margin:0 0 10px 0;">Your <b>VOUCHER</b> is ready.</p>

      <div style="margin:10px 0;">
        <div style="display:flex;gap:8px;margin:4px 0;"><div style="min-width:140px;color:#6b7280">Platform Ref</div><div><b>${order?.platformRef || "—"}</b></div></div>
        <div style="display:flex;gap:8px;margin:4px 0;"><div style="min-width:140px;color:#6b7280">Hotel</div><div><b>${hotel}</b></div></div>
        <div style="display:flex;gap:8px;margin:4px 0;"><div style="min-width:140px;color:#6b7280">Arrival</div><div><b>${arrival}</b></div></div>
        <div style="display:flex;gap:8px;margin:4px 0;"><div style="min-width:140px;color:#6b7280">Nights</div><div><b>${nights}</b></div></div>
      </div>

      <p style="margin:14px 0;">${ctaButtonHTML(href, t(lang, "viewDetails"))}</p>
      <p style="color:#6b7280;margin:6px 0 0 0;">Please carry a copy (printed or digital) during check-in.</p>

      ${finePrintHTML(lang)}
      ${officeContactHTML()}
      ${legalNoticeHTML()}
    </div>
  `;
  return wrapCardHTML(body);
}