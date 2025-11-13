// // utils/emailTemplates/bookingRejected.js
// import { pageShell, meta, line, button } from "./_base.js";

// export const subjectRejected = () => "Booking Rejected – inLobby.com";

// export const htmlRejected = (order = {}) => {
//   const m = meta(order);
//   const body = `
//     <p>Unfortunately, your booking request was <b>REJECTED</b>.</p>
//     ${line("Platform Ref", order?.platformRef)}
//     ${line("Hotel", m.service)}
//     ${line("City", m.city)}
//     ${line("Arrival", m.arrival)}
//     ${line("Nights", m.nights)}
//     ${line("Rooms", m.rooms)}
//     ${button(m.orderUrl, "View Options")}
//     <p style="color:#6b7280">You may search for alternatives or contact support.</p>
//   `;
//   return pageShell({ title: "Booking Rejected", subtitle: "Status Update", bodyHtml: body });
// };

// utils/emailTemplates/bookingRejected.js
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

export function subjectRejected(lang = "en") {
  return `${t(lang, "rejected")} — ${BRAND_NAME}`;
}

export function htmlRejected(order = {}, lang = "en") {
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

  const body = `
    ${brandHeaderHTML(t(lang, "rejected"))}
    <div style="padding:16px 18px;background:#ffffff;font-size:14px;line-height:1.55">
      <p style="margin:0 0 10px 0;">Unfortunately, your booking request was <b>REJECTED</b>.</p>

      <div style="margin:10px 0;">
        <div style="display:flex;gap:8px;margin:4px 0;"><div style="min-width:140px;color:#6b7280">Platform Ref</div><div><b>${order?.platformRef || "—"}</b></div></div>
        <div style="display:flex;gap:8px;margin:4px 0;"><div style="min-width:140px;color:#6b7280">Hotel</div><div><b>${hotel}</b></div></div>
        <div style="display:flex;gap:8px;margin:4px 0;"><div style="min-width:140px;color:#6b7280">City</div><div><b>${city}</b></div></div>
        <div style="display:flex;gap:8px;margin:4px 0;"><div style="min-width:140px;color:#6b7280">Arrival</div><div><b>${arrival}</b></div></div>
        <div style="display:flex;gap:8px;margin:4px 0;"><div style="min-width:140px;color:#6b7280">Nights</div><div><b>${nights}</b></div></div>
        <div style="display:flex;gap:8px;margin:4px 0;"><div style="min-width:140px;color:#6b7280">Rooms</div><div><b>${rooms}</b></div></div>
      </div>

      <p style="margin:14px 0;">${ctaButtonHTML(href, t(lang, "viewDetails"))}</p>
      <p style="color:#6b7280;margin:6px 0 0 0;">You may search for alternatives or contact support.</p>

      ${finePrintHTML(lang)}
      ${officeContactHTML()}
      ${legalNoticeHTML()}
    </div>
  `;
  return wrapCardHTML(body);
}