// New

export function resetSubject() {
  return "Password Reset Request";
}

export function resetHtml({ resetLink }) {
  const brand = process.env.EMAIL_FROM_NAME || "inLobby.com";
  const BRAND_URL = process.env.EMAIL_BRAND_URL || "https://inlobby.com";
  const primary = "#f36323";
  return `
  <div style="font-family:Inter,system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#111827;">
    <div style="max-width:640px;margin:24px auto;border:1px solid #e5e7eb;border-radius:16px;overflow:hidden;box-shadow:0 6px 16px rgba(0,0,0,.06)">
      <div style="padding:14px 18px;background:${primary};color:#fff;">
        <a href="${BRAND_URL}"
            style="color:#ffffff !important;text-decoration:none !important;display:inline-block;font-weight:800;font-size:16px;line-height:1">
            <font color="#ffffff">${brand}</font>
        </a>

        <div style="opacity:.9;font-size:13px;">Password Reset</div>
      </div>
      <div style="padding:16px 18px;background:#ffffff;font-size:14px;line-height:1.55">
        <p>We received a request to reset your password.</p>
        <p>
          <a href="${resetLink}" style="display:inline-block;background:${primary};color:#fff;padding:10px 14px;border-radius:10px;text-decoration:none;font-weight:700">Reset Password</a>
        </p>
        <p style="color:#6b7280">If you did not request this, please ignore this message.</p>
        <p style="color:#6b7280">This link will expire in 30 minutes.</p>
      </div>
    </div>
  </div>`;
}
