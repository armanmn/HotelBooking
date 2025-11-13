// // utils/emailTemplates/bookingConfirmed.js
// import { pageShell, meta, line, button } from "./_base.js";

// export const subjectConfirmed = () => "Booking Confirmed – inLobby.com";

// export const htmlConfirmed = (order = {}) => {
//   const m = meta(order);
//   const body = `
//     <p>Your booking has been <b>CONFIRMED</b>.</p>
//     ${line("Platform Ref", order?.platformRef)}
//     ${line("Hotel", m.service)}
//     ${line("City", m.city)}
//     ${line("Arrival", m.arrival)}
//     ${line("Nights", m.nights)}
//     ${line("Rooms", m.rooms)}
//     ${line("Lead Guest", m.lead)}
//     ${m.price ? line("Total", m.price) : ""}
//     ${button(m.orderUrl, "View Booking")}
//     <p style="color:#6b7280">Please review the cancellation policy inside the booking page.</p>
//   `;
//   return pageShell({ title: "Booking Confirmed", subtitle: "Confirmation", bodyHtml: body });
// };

// // Second version
// // utils/emailTemplates/bookingConfirmed.js
// import {
//   BRAND_NAME,
//   brandHeaderHTML,
//   ctaButtonHTML,
//   finePrintHTML,
//   wrapCardHTML,
//   FRONTEND,
// } from "./_brand.js";
// import { t } from "./_i18n.js";

// export function subjectConfirmed(lang = "en") {
//   return `${t(lang, "confirmed")} — ${BRAND_NAME}`;
// }

// export function htmlConfirmed(order = {}, lang = "en") {
//   const href = `${FRONTEND}/admin/bookings/status/${encodeURIComponent(
//     order?.platformRef || ""
//   )}?refresh=1`;

//   const summary = order?.summary || {};
//   const mHotel = order?.hotel || {};
//   const hotel = summary.service || mHotel.name || "—";
//   const city = summary.city || mHotel.cityName || "—";
//   const arrival = summary.arrivalDate || order?.context?.arrivalDate || "—";
//   const nights = summary.nights || order?.context?.nights || "—";
//   const rooms = summary.rooms || order?.context?.roomsCount || "—";
//   const lead = summary.leadName || "—";
//   const total = summary?.price
//     ? `${summary.price.amount} ${summary.price.currency || ""}`.trim()
//     : order?.price
//     ? `${order.price.amount} ${order.price.currency || ""}`.trim()
//     : "—";

//   const body = `
//     ${brandHeaderHTML(t(lang, "confirmed"))}
//     <div style="padding:16px 18px;background:#ffffff;font-size:14px;line-height:1.55">
//       <p style="margin:0 0 10px 0;">Your booking has been <b>CONFIRMED</b>.</p>

//       <div style="margin:10px 0;">
//         <div style="display:flex;gap:8px;margin:4px 0;">
//           <div style="min-width:140px;color:#6b7280">Platform Ref</div>
//           <div><b>${order?.platformRef || "—"}</b></div>
//         </div>
//         <div style="display:flex;gap:8px;margin:4px 0;">
//           <div style="min-width:140px;color:#6b7280">Hotel</div>
//           <div><b>${hotel}</b></div>
//         </div>
//         <div style="display:flex;gap:8px;margin:4px 0;">
//           <div style="min-width:140px;color:#6b7280">City</div>
//           <div><b>${city}</b></div>
//         </div>
//         <div style="display:flex;gap:8px;margin:4px 0;">
//           <div style="min-width:140px;color:#6b7280">Arrival</div>
//           <div><b>${arrival}</b></div>
//         </div>
//         <div style="display:flex;gap:8px;margin:4px 0;">
//           <div style="min-width:140px;color:#6b7280">Nights</div>
//           <div><b>${nights}</b></div>
//         </div>
//         <div style="display:flex;gap:8px;margin:4px 0;">
//           <div style="min-width:140px;color:#6b7280">Rooms</div>
//           <div><b>${rooms}</b></div>
//         </div>
//         <div style="display:flex;gap:8px;margin:4px 0;">
//           <div style="min-width:140px;color:#6b7280">Lead Guest</div>
//           <div><b>${lead}</b></div>
//         </div>
//         <div style="display:flex;gap:8px;margin:4px 0;">
//           <div style="min-width:140px;color:#6b7280">Total</div>
//           <div><b>${total}</b></div>
//         </div>
//       </div>

//       <p style="margin:14px 0;">
//         ${ctaButtonHTML(href, "View Booking")}
//       </p>

//       <p style="color:#6b7280;margin:6px 0 0 0;">Please review the cancellation policy inside the booking page.</p>

//       ${finePrintHTML(lang)}
//     </div>
//   `;
//   return wrapCardHTML(body);
// }

// utils/emailTemplates/bookingConfirmed.js
import {
  BRAND_NAME,
  brandHeaderHTML,
  ctaButtonHTML,
  finePrintHTML,
  wrapCardHTML,
  FRONTEND,
  officeContactHTML,   // ✅ ճիշտ արտահանումները
  legalNoticeHTML,     // ✅
} from "./_brand.js";
import { t } from "./_i18n.js";

export function subjectConfirmed(lang = "en") {
  return `${t(lang, "confirmed")} — ${BRAND_NAME}`;
}

export function htmlConfirmed(order = {}, lang = "en") {
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
  const total = summary?.price
    ? `${summary.price.amount} ${summary.price.currency || ""}`.trim()
    : order?.price
    ? `${order.price.amount} ${order.price.currency || ""}`.trim()
    : "—";

  const body = `
    ${brandHeaderHTML(t(lang, "confirmed"))}
    <div style="padding:16px 18px;background:#ffffff;font-size:14px;line-height:1.55">
      <p style="margin:0 0 10px 0;">Your booking has been <b>CONFIRMED</b>.</p>

      <div style="margin:10px 0;">
        <div style="display:flex;gap:8px;margin:4px 0;"><div style="min-width:140px;color:#6b7280">Platform Ref</div><div><b>${order?.platformRef || "—"}</b></div></div>
        <div style="display:flex;gap:8px;margin:4px 0;"><div style="min-width:140px;color:#6b7280">Hotel</div><div><b>${hotel}</b></div></div>
        <div style="display:flex;gap:8px;margin:4px 0;"><div style="min-width:140px;color:#6b7280">City</div><div><b>${city}</b></div></div>
        <div style="display:flex;gap:8px;margin:4px 0;"><div style="min-width:140px;color:#6b7280">Arrival</div><div><b>${arrival}</b></div></div>
        <div style="display:flex;gap:8px;margin:4px 0;"><div style="min-width:140px;color:#6b7280">Nights</div><div><b>${nights}</b></div></div>
        <div style="display:flex;gap:8px;margin:4px 0;"><div style="min-width:140px;color:#6b7280">Rooms</div><div><b>${rooms}</b></div></div>
        <div style="display:flex;gap:8px;margin:4px 0;"><div style="min-width:140px;color:#6b7280">Lead Guest</div><div><b>${lead}</b></div></div>
        <div style="display:flex;gap:8px;margin:4px 0;"><div style="min-width:140px;color:#6b7280">Total</div><div><b>${total}</b></div></div>
      </div>

      <p style="margin:14px 0;">${ctaButtonHTML(href, "View Booking")}</p>
      <p style="color:#6b7280;margin:6px 0 0 0;">Please review the cancellation policy inside the booking page.</p>

      ${finePrintHTML(lang)}
      ${officeContactHTML()}
      ${legalNoticeHTML()}
    </div>
  `;
  return wrapCardHTML(body);
}