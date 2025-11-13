// utils/emailTemplates/_i18n.js
export function t(lang = "en", key, vars = {}) {
  const dict = {
    en: {
      confirmed: "Booking Confirmed",
      cancelled: "Booking Cancelled",
      rejected:  "Booking Rejected",
      voucher:   "Voucher Issued",
      payment:   "Payment Received",
      viewDetails: "View Details",
      platformRef: "Order",
      hotel: "Hotel",
      city: "City",
      dates: "Dates",
      total: "Total",
    },
    hy: {
      confirmed: "Ամրագրումը հաստատված է",
      cancelled: "Ամրագրումը չեղարկված է",
      rejected:  "Ամրագրումը մերժվել է",
      voucher:   "Վաուչերը տրամադրվել է",
      payment:   "Վճարումը ստացվել է",
      viewDetails: "Դիտել մանրամասները",
      platformRef: "Պատվեր",
      hotel: "Հյուրանոց",
      city: "Քաղաք",
      dates: "Ամսաթվեր",
      total: "Ընդամենը",
    }
  };
  const table = dict[lang] || dict.en;
  let s = table[key] || key;
  Object.entries(vars).forEach(([k,v]) => { s = s.replaceAll(`{${k}}`, String(v)); });
  return s;
}