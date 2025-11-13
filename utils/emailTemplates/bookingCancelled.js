// // utils/emailTemplates/bookingCancelled.js
// import { pageShell, meta, line, button } from "./_base.js";

// export const subjectCancelled = () => "Booking Cancelled – inLobby.com";

// export const htmlCancelled = (order = {}) => {
//   const m = meta(order);
//   const body = `
//     <p>Your booking has been <b>CANCELLED</b>.</p>
//     ${line("Platform Ref", order?.platformRef)}
//     ${line("Hotel", m.service)}
//     ${line("City", m.city)}
//     ${line("Arrival", m.arrival)}
//     ${line("Nights", m.nights)}
//     ${line("Rooms", m.rooms)}
//     ${line("Lead Guest", m.lead)}
//     ${button(m.orderUrl, "View Details")}
//     <p style="color:#6b7280">If a refund applies, it will follow the supplier policy and processing times.</p>
//   `;
//   return pageShell({ title: "Booking Cancelled", subtitle: "Cancellation", bodyHtml: body });
// };

// utils/emailTemplates/bookingCancelled.js
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

export function subjectCancelled(lang = "en") {
  return `${t(lang, "cancelled")} — ${BRAND_NAME}`;
}

export function htmlCancelled(order = {}, lang = "en") {
  const href = `${FRONTEND}/admin/bookings/status/${encodeURIComponent(
    order?.platformRef || ""
  )}?refresh=1`;

  const summary = order?.summary || {};
  const mHotel = order?.hotel || {};
  const hotel = summary.service || mHotel.name || "—";
  const city = summary.city || mHotel.cityName || "—";
  const arrival = summary.arrivalDate || order?.context?.arrivalDate || "—";
  const nights = summary.nights || order?.context?.nights || "—";
  const rooms = summary.rooms || order?.context?.roomsCount || "—";
  const lead = summary.leadName || "—";

  const body = `
    ${brandHeaderHTML(t(lang, "cancelled"))}
    <div style="padding:16px 18px;background:#ffffff;font-size:14px;line-height:1.55">
      <p style="margin:0 0 10px 0;">Your booking has been <b>CANCELLED</b>.</p>

      <div style="margin:10px 0;">
        <div style="display:flex;gap:8px;margin:4px 0;"><div style="min-width:140px;color:#6b7280">Platform Ref</div><div><b>${order?.platformRef || "—"}</b></div></div>
        <div style="display:flex;gap:8px;margin:4px 0;"><div style="min-width:140px;color:#6b7280">Hotel</div><div><b>${hotel}</b></div></div>
        <div style="display:flex;gap:8px;margin:4px 0;"><div style="min-width:140px;color:#6b7280">City</div><div><b>${city}</b></div></div>
        <div style="display:flex;gap:8px;margin:4px 0;"><div style="min-width:140px;color:#6b7280">Arrival</div><div><b>${arrival}</b></div></div>
        <div style="display:flex;gap:8px;margin:4px 0;"><div style="min-width:140px;color:#6b7280">Nights</div><div><b>${nights}</b></div></div>
        <div style="display:flex;gap:8px;margin:4px 0;"><div style="min-width:140px;color:#6b7280">Rooms</div><div><b>${rooms}</b></div></div>
        <div style="display:flex;gap:8px;margin:4px 0;"><div style="min-width:140px;color:#6b7280">Lead Guest</div><div><b>${lead}</b></div></div>
      </div>

      <p style="margin:14px 0;">${ctaButtonHTML(href, t(lang, "viewDetails"))}</p>
      <p style="color:#6b7280;margin:6px 0 0 0;">Any applicable refunds follow supplier policy and processing times.</p>

      ${finePrintHTML(lang)}
      ${officeContactHTML()}
      ${legalNoticeHTML()}
    </div>
  `;
  return wrapCardHTML(body);
}