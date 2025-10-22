// New
export function mapSupplierStatusToOrder(s) {
  const x = String(s || "").toUpperCase();
  if (x === "C" || x === "CONFIRMED") return "CONFIRMED";
  if (x === "RQ" || x === "ON_REQUEST") return "ON_REQUEST";
  if (x === "RJ" || x === "REJECTED") return "REJECTED";
  if (x === "X"  || x === "CANCELLED") return "CANCELLED";
  return "PENDING";
}