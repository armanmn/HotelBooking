// server/src/services/orders/status.js

export const PLATFORM_STATUS = {
  C: "C",                 // CONFIRMED
  RQ: "RQ",               // REQUESTED
  RJ: "RJ",               // REJECTED
  RX: "RX",               // CANCELLATION_REQUESTED
  X: "X",                 // CANCELLED
  PENDING: "PENDING",
  FAILED: "FAILED",
};

// Supplier raw groups
const CONFIRMED_RAW = new Set(["C", "VCH", "VRQ"]);
const CANCELLED_RAW = new Set(["X", "XF", "XX"]);

// Map supplier raw → stored platform code (we store codes like C/RQ/…)
export function mapSupplierToPlatform(raw) {
  const s = String(raw || "").toUpperCase().trim();
  if (CANCELLED_RAW.has(s)) return PLATFORM_STATUS.X;
  if (CONFIRMED_RAW.has(s)) return PLATFORM_STATUS.C;
  if (s === "RQ") return PLATFORM_STATUS.RQ;
  if (s === "RJ") return PLATFORM_STATUS.RJ;
  if (s === "RX") return PLATFORM_STATUS.RX;
  return PLATFORM_STATUS.PENDING;
}

// Helpers to detect/filter supplier raw codes
export function isSupplierStatusCode(s) {
  const v = String(s || "").toUpperCase();
  return ["C","RQ","RJ","RX","X","VCH","VRQ","XF","XX"].includes(v);
}

// 🔹 NEW: normalize a platform-status *filter* coming from query (?status=…)
// Accepts both full names (CONFIRMED/REQUESTED/…) and stored codes (C/RQ/…)
// Returns one of PLATFORM_STATUS (C/RQ/RJ/RX/X/PENDING/FAILED), or null if unknown.
export function normalizePlatformStatusInput(input) {
  const s = String(input || "").trim().toUpperCase();
  // if already our stored codes:
  if (Object.values(PLATFORM_STATUS).includes(s)) return s;

  // full-name synonyms → code
  switch (s) {
    case "CONFIRMED": return PLATFORM_STATUS.C;
    case "REQUESTED": return PLATFORM_STATUS.RQ;
    case "REJECTED": return PLATFORM_STATUS.RJ;
    case "CANCELLATION_REQUESTED": return PLATFORM_STATUS.RX;
    case "CANCELLED": return PLATFORM_STATUS.X;
    case "PENDING": return PLATFORM_STATUS.PENDING;
    case "FAILED": return PLATFORM_STATUS.FAILED;
    default: return null;
  }
}

// Labels for UI — accept both codes and full names safely
export function platformStatusLabel(codeOrName) {
  const c = normalizePlatformStatusInput(codeOrName) || String(codeOrName || "").toUpperCase();
  switch (c) {
    case "C":        return "Confirmed";
    case "RQ":       return "Requested";
    case "RJ":       return "Rejected";
    case "RX":       return "Cancellation Requested";
    case "X":        return "Cancelled";
    case "FAILED":   return "Failed";
    case "PENDING":
    default:         return "Pending";
  }
}

// keep backward alias (your controller imports labelPlatformStatus)
export const labelPlatformStatus = platformStatusLabel;

// UX sublabel for supplier raw
export function supplierSubLabel(raw) {
  const s = String(raw || "").toUpperCase().trim();
  if (s === "VCH") return "Voucher issued";
  if (s === "VRQ") return "Voucher requested";
  if (s === "RX")  return "Cancel pending";
  if (s === "XF" || s === "XX") return "Supplier cancelled";
  return null;
}

// Payability helper
export function isPayable(platformCode, raw, platformCutoffUtc) {
  const withinCutoff = !platformCutoffUtc || Date.now() < new Date(platformCutoffUtc).getTime();
  const confirmedLike = (normalizePlatformStatusInput(platformCode) === "C") ||
                        CONFIRMED_RAW.has(String(raw || "").toUpperCase());
  const notBlocked = !["X","RJ","RX"].includes(String(normalizePlatformStatusInput(platformCode)));
  return withinCutoff && confirmedLike && notBlocked;
}