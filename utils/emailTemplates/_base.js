// utils/emailTemplates/_base.js
const brand = {
  name: process.env.EMAIL_FROM_NAME || "inLobby.com",
  primary: "#f36323",
  text: "#111827",
  muted: "#6b7280",
};

export function pageShell({ title, subtitle, bodyHtml }) {
  return `
  <div style="font-family:Inter,system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:${brand.text};">
    <div style="max-width:640px;margin:24px auto;border:1px solid #e5e7eb;border-radius:16px;overflow:hidden;box-shadow:0 6px 16px rgba(0,0,0,.06)">
      <div style="padding:14px 18px;background:${brand.primary};color:#fff">
        <div style="font-weight:800;font-size:16px;">${brand.name}</div>
        <div style="opacity:.9;font-size:13px;">${subtitle || ""}</div>
      </div>
      <div style="padding:16px 18px;background:#ffffff;font-size:14px;line-height:1.55">
        <h2 style="margin:0 0 8px 0;font-size:18px;">${title || ""}</h2>
        ${bodyHtml || ""}
      </div>
    </div>
  </div>`;
}

export function meta(order = {}) {
  const base = process.env.FRONTEND_URL || process.env.APP_BASE_URL || "http://localhost:3000";
  const plat = order?.platformRef || "";
  const orderUrl = `${base.replace(/\/$/,"")}/admin/bookings/status/${encodeURIComponent(plat)}`;
  const service = order?.summary?.service || order?.hotel?.name || "Hotel";
  const city = order?.summary?.city || order?.hotel?.cityName || "";
  const arrival = order?.summary?.arrivalDate || order?.context?.arrivalDate || "";
  const nights = order?.summary?.nights || order?.context?.nights || "";
  const rooms = order?.summary?.rooms || order?.context?.roomsCount || "";
  const lead = order?.summary?.leadName || "";
  const priceAmount = order?.summary?.price?.amount ?? order?.price?.amount ?? null;
  const priceCurr = order?.summary?.price?.currency ?? order?.price?.currency ?? "";
  const price = priceAmount != null ? `${priceAmount} ${priceCurr}`.trim() : null;
  return { base, orderUrl, service, city, arrival, nights, rooms, lead, price };
}

export function line(label, value) {
  return `
  <div style="display:flex;gap:8px;margin:4px 0;">
    <div style="min-width:140px;color:${brand.muted}">${label}</div>
    <div><b>${value || "—"}</b></div>
  </div>`;
}

export function button(href, text) {
  return `
  <p>
    <a href="${href}"
       style="display:inline-block;background:${brand.primary};color:#fff !important;padding:10px 14px;border-radius:10px;text-decoration:none;font-weight:700">
       ${text}
    </a>
  </p>`;
}