// utils/offerProof.js
import crypto from "crypto";

const SECRET = process.env.OFFER_PROOF_SECRET || "dev-secret-change-me";
const TTL_MIN = Number(process.env.OFFER_PROOF_TTL_MIN || 20); // վավերականության տևողություն (րոպե)

/** base64url helpers */
function b64url(buf) {
  return Buffer.from(buf).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
function fromB64url(s) {
  s = s.replace(/-/g, "+").replace(/_/g, "/");
  while (s.length % 4) s += "=";
  return Buffer.from(s, "base64").toString("utf8");
}

/**
 * Ստորագրում ենք առաջարկը՝ որպեսզի valuation-ում ապացույց լինի, որ գինը
 * հենց availability-ից է եկել, ոչ թե client-ը “հորինել է”։
 */
export function signOfferProof(payload) {
  // payload expected: { searchCode, amount, currency, arrivalDate, issuedAt }
  const json = JSON.stringify(payload);
  const sig = crypto.createHmac("sha256", SECRET).update(json).digest();
  return `${b64url(sig)}.${b64url(json)}`;
}

/** Վերահաստատում ենք proof-ը և վերադարձնում payload-ը */
export function verifyOfferProof(token) {
  try {
    const [sigPart, jsonPart] = String(token || "").split(".");
    if (!sigPart || !jsonPart) return { ok: false, reason: "FORMAT" };
    const json = fromB64url(jsonPart);
    const expectedSig = crypto.createHmac("sha256", SECRET).update(json).digest();
    const givenSig = Buffer.from(sigPart.replace(/-/g, "+").replace(/_/g, "/"), "base64");
    if (givenSig.length !== expectedSig.length || !crypto.timingSafeEqual(givenSig, expectedSig)) {
      return { ok: false, reason: "SIG" };
    }
    const payload = JSON.parse(json);
    const issuedAt = Number(payload?.issuedAt || 0);
    if (!Number.isFinite(issuedAt)) return { ok: false, reason: "ISSUED_AT" };

    const ageMin = (Date.now() - issuedAt) / 60000;
    if (ageMin > TTL_MIN) return { ok: false, reason: "EXPIRED" };

    return { ok: true, payload };
  } catch (_e) {
    return { ok: false, reason: "EXC" };
  }
}