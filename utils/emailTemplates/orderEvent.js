// New

export function orderEventSubject({ type, platformRef }) {
  const map = {
    created: "Booking Created",
    cancelled: "Booking Cancelled",
    paid: "Payment Received",
    payment_initiated: "Payment Started",
  };
  return `${map[type] || "Booking Update"} — ${platformRef}`;
}

export function orderEventHtml({ type, platformRef, summary = {}, details = {}, remarksHtml = "" }) {
  const brand = process.env.EMAIL_FROM_NAME || "inLobby";
  const primary = "#f36323";
  const muted = "#6b7280";

  const rows = [
    ["Reservation Number", platformRef || "—"],
    ["City", summary.city || "—"],
    ["Hotel Name", summary.service || "—"],
    ["Check-In Date", summary.arrivalDate || "—"],
    ["Number Of Nights", summary.nights ?? "—"],
    ["Number Of Rooms", summary.rooms ?? "—"],
    ["Cancellation Deadline", details?.cancellation?.platform?.cutoffUtc?.slice(0,10) || "—"],
  ];

  const statusTitle = (
    type === "created" ? "Booking Created" :
    type === "cancelled" ? "Booking Cancelled" :
    type === "paid" ? "Payment Received" :
    "Booking Update"
  );

  const safeRemarks = remarksHtml
    ? String(remarksHtml)
    : (details?.remarksHtml || "").toString();

  return `
  <div style="font-family:Inter,system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#111827;">
    <div style="max-width:720px;margin:24px auto;border:1px solid #e5e7eb;border-radius:16px;overflow:hidden;box-shadow:0 6px 16px rgba(0,0,0,.06)">
      <div style="padding:14px 18px;background:${primary};color:#fff;">
        <div style="font-weight:800;font-size:16px;">${brand}</div>
        <div style="opacity:.9;font-size:13px;">${statusTitle}</div>
      </div>

      <div style="padding:16px 18px;background:#ffffff;">
        <h2 style="margin:0 0 10px 0;font-size:18px;">${statusTitle}</h2>
        <div style="border:1px solid #e5e7eb;border-radius:12px;overflow:hidden">
          <table width="100%" cellpadding="8" cellspacing="0" style="border-collapse:collapse;">
            <tbody>
              ${rows.map(([k,v],i)=>`
                <tr style="border-bottom:1px solid #f1f5f9;">
                  <td style="width:40%;color:${muted};font-size:13px;background:#f9fafb">${k}</td>
                  <td style="font-weight:600;font-size:14px;">${v}</td>
                </tr>`).join("")}
            </tbody>
          </table>
        </div>

        ${safeRemarks ? `
          <div style="margin-top:12px;">
            <div style="font-weight:800;margin-bottom:6px;">Remarks</div>
            <div style="font-size:14px;line-height:1.55">${safeRemarks}</div>
          </div>
        ` : ""}

        <div style="margin-top:16px;padding:10px 12px;border:1px solid #e5e7eb;border-radius:12px;background:#f9fafb;font-size:13px;color:${muted}">
          This is an automated message from ${brand}. Please do not reply to this email.  
          For assistance contact support at <a href="mailto:${process.env.SUPPORT_EMAIL || "support@inlobby.com"}" style="color:${primary};text-decoration:none">${process.env.SUPPORT_EMAIL || "support@inlobby.com"}</a>.
        </div>
      </div>
    </div>
  </div>`;
}