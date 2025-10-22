// platformRef.js
const pad2 = (n) => String(n).padStart(2, "0");

export function makePlatformRef(orderId) {
  const d = new Date();
  const y = d.getUTCFullYear();
  const m = pad2(d.getUTCMonth() + 1);
  const day = pad2(d.getUTCDate());
  const shortId = String(orderId).slice(-6).toUpperCase();
  return `IL-H-${y}${m}${day}-${shortId}`;
}