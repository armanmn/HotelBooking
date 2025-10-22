// New
// server/src/services/orders/derivers.js

/** Lead name — վերցնում է առաջին մեծահասակին (ADT/adult/ADL), fallback՝ առաջին pax */
export function deriveLeadName(rooms = []) {
  if (!Array.isArray(rooms) || rooms.length === 0) return null;

  for (const r of rooms) {
    const pax = Array.isArray(r?.pax) ? r.pax : [];
    const adult = pax.find((p) => {
      const t = String(p?.type || "").toUpperCase();
      return t === "ADT" || t === "ADULT" || t === "ADL";
    });
    if (adult) {
      const fn = adult.firstName || adult.firstname || adult.given || "";
      const ln = adult.lastName  || adult.lastname  || adult.surname || "";
      const name = [fn, ln].filter(Boolean).join(" ").trim();
      if (name) return name;
    }
  }

  // fallback: very first pax (room 0, pax 0)
  const p = rooms?.[0]?.pax?.[0];
  if (p) {
    const fn = p.firstName || p.firstname || p.given || "";
    const ln = p.lastName  || p.lastname  || p.surname || "";
    const name = [fn, ln].filter(Boolean).join(" ").trim();
    if (name) return name;
  }
  return null;
}

/** Alias — թողնում ենք, որ supplierController-ում աշխատի առանց փոփոխության */
export const pickLeadName = deriveLeadName;

/** Սենյակների քանակ — պարզ length, fallback=1 */
export function deriveRoomsCount(rooms = []) {
  return Array.isArray(rooms) && rooms.length > 0 ? rooms.length : 1;
}

/** Վճարման վիճակ — true երբ արդեն authorized/paid/captured/settled/refunded */
export function derivePaid(payment) {
  const s = String(payment?.status || "").toLowerCase();
  if (
    s === "authorized" ||
    s === "captured" ||
    s === "paid" ||
    s === "settled" ||
    s === "refunded" ||
    s === "partially_refunded"
  ) return true;

  // secondary flags if provider returns booleans
  if (payment?.authorized === true) return true;
  if (payment?.paid === true) return true;

  return false;
}

/* ────────────────────────────────────────────────────────────
   Pax/Room normalizers — provider → platform schema
   ADULT/child → ADT/CHD, վերնագրերի/անունների մաքրում
   ──────────────────────────────────────────────────────────── */

/** "adult"/"ADT" → "ADT"; "child"/"CHD"/"children" → "CHD" */
function mapPaxType(t) {
  const s = String(t || "").trim().toLowerCase();
  if (s === "chd" || s === "child" || s === "children") return "CHD";
  return "ADT";
}

/** Վերնագրերի նորմալիզացում՝ մեծահասակներին MR./MRS./MISS/MS, երեխաներին CHD */
function normalizeTitle(title, type) {
  const t = String(title || "").toUpperCase().replace(/\s+/g, "");
  const allowed = new Set(["MR.", "MRS.", "MISS", "MS", "CHD"]);
  if (mapPaxType(type) === "CHD") return "CHD";
  return allowed.has(t) ? t : "MR.";
}

/** Սենյակների նորմալիզացում՝ schema-ի PaxSchema-ին համապատասխան */
export function normalizeRoomsForOrder(rooms = []) {
  return (rooms || []).map((r, idx) => {
    const pax = Array.isArray(r?.pax) ? r.pax : [];
    const cleaned = pax.map((p) => {
      const type = mapPaxType(p?.type);
      const first = p.firstName || p.firstname || p.given || "";
      const last  = p.lastName  || p.lastname  || p.surname || "";

      const out = {
        type,
        title: normalizeTitle(p?.title, type),
        firstName: String(first).toUpperCase(),
        lastName:  String(last).toUpperCase(),
      };

      // keep age only for children
      if (type === "CHD") out.age = p?.age ?? null;

      return out;
    });

    return {
      roomId: r?.roomId || (idx + 1),
      pax: cleaned,
    };
  });
}