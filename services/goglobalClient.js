// services/goglobalClient.js
import { buildSoapEnvelope, extractProviderPayload } from "../utils/soap.js";

const REQTYPE = {
  HOTEL_SEARCH: process.env.GG_REQTYPE_HOTEL_SEARCH || "11",
  BOOKING_VALUATION: process.env.GG_REQTYPE_BOOKING_VALUATION || "9",
  HOTEL_INFO: process.env.GG_REQTYPE_HOTEL_INFO || "6",
  // ⬇️ NEW
  BOOKING_INSERT: process.env.GG_REQTYPE_BOOKING_INSERT || "2",
  BOOKING_CANCEL: process.env.GG_REQTYPE_BOOKING_CANCEL || "3",
  BOOKING_SEARCH: process.env.GG_REQTYPE_BOOKING_SEARCH || "4",
  BOOKING_STATUS: process.env.GG_REQTYPE_BOOKING_STATUS || "5",
};

// ------------------------- Helpers (local to this service) -------------------------
function buildRoomsXmlForInsert(rooms = []) {
  // Խմբավորում ենք Adults արժեքով՝ ըստ GoGlobal request-ի
  const groups = new Map();
  rooms.forEach((r) => {
    const k = String(r?.adults ?? 0);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(r);
  });

  let xml = `<Rooms>`;
  for (const [adultsStr, list] of groups.entries()) {
    xml += `<RoomType Adults="${adultsStr}">`;
    list.forEach((room, idx) => {
      const pax = Array.isArray(room?.pax) ? room.pax : [];
      xml += `<Room RoomID="${idx + 1}">`;

      let personId = 1;

      // Մեծահասակներ՝ <PersonName ... />
      pax
        .filter((p) => p?.type !== "child")
        .slice(0, Number(room?.adults || 0))
        .forEach((p) => {
          const title = String(p?.title || "").toUpperCase();
          const fn = String(p?.firstName || "").toUpperCase();
          const ln = String(p?.lastName || "").toUpperCase();
          xml += `<PersonName PersonID="${personId++}" Title="${title}" FirstName="${fn}" LastName="${ln}"/>`;
        });

      // Երեխաներ՝ <ExtraBed ... ChildAge="x" />
      pax
        .filter((p) => p?.type === "child")
        .forEach((p) => {
          const fn = String(p?.firstName || "").toUpperCase();
          const ln = String(p?.lastName || "").toUpperCase();
          const age = Number(p?.age || 0);
          xml += `<ExtraBed PersonID="${personId++}" FirstName="${fn}" LastName="${ln}" ChildAge="${age}"/>`;
        });

      xml += `</Room>`;
    });
    xml += `</RoomType>`;
  }
  xml += `</Rooms>`;
  return xml;
}

// Read env with safe fallbacks (so both old/new names work)
function getSupplierEnv() {
  const endpoint =
    process.env.GG_SOAP_ENDPOINT ||
    process.env.GOGLOBAL_ENDPOINT ||
    process.env.GOGLOBAL_URL;

  const agency = process.env.GOGLOBAL_AGENCY;
  const user = process.env.GOGLOBAL_USER;
  const pass = process.env.GOGLOBAL_PASSWORD;

  if (!endpoint)
    throw new Error(
      "Missing SOAP endpoint (GG_SOAP_ENDPOINT or GOGLOBAL_ENDPOINT)"
    );
  if (!agency) throw new Error("Missing env GOGLOBAL_AGENCY");
  if (!user) throw new Error("Missing env GOGLOBAL_USER");
  if (!pass) throw new Error("Missing env GOGLOBAL_PASSWORD");

  return { endpoint, agency, user, pass };
}

async function postSoap({ endpoint, agency, operation, envelope, timeoutMs = 20000 }) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);

  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/soap+xml; charset=utf-8",
      "API-Operation": operation,
      "API-AgencyID": agency,
    },
    body: envelope,
    signal: ctrl.signal,
  }).catch((e) => {
    clearTimeout(timer);
    throw e;
  });

  clearTimeout(timer);
  const text = await res.text();

  if (!res.ok || /<Fault|<soap:Fault|<soap12:Fault/i.test(text)) {
    const snip = text.slice(0, 800);
    throw new Error(`SOAP error for ${operation}. Snippet: ${snip}`);
  }
  return text;
}

/* ============================================================================
 * Availability (requestType = 11)
 * Supplier default currency (NO Currency attribute/tag)
 * ========================================================================== */
export async function hotelSearchAvailability(params) {
  const {
    cityId,
    arrivalDate,
    nights,
    pax = [{ adults: 2, childrenAges: [], roomCount: 1 }],
    // ⛔ currency — intentionally NOT used; supplier will use profile/destination default
    nationality,
    maxHotels = 150,
    maxOffers = 5,
    maximumWaitTime = 15,

    // 👇 ՆՈՐ՝ single-hotel և/կամ basis filter
    hotelIds = [],            // e.g. ["875154"]
    filterBasis = [],         // e.g. ["BB","HB"]
  } = params;

  const { endpoint, agency, user, pass } = getSupplierEnv();

  // --- Rooms XML (self-closing when ChildCount=0)
  const roomsXml = pax
    .map(({ adults = 2, childrenAges = [], roomCount = 1 }) => {
      const cnt = childrenAges.length;
      if (cnt === 0) {
        return `<Room Adults="${adults}" RoomCount="${roomCount}" ChildCount="0"/>`;
      }
      const ages = childrenAges.map((a) => `<ChildAge>${a}</ChildAge>`).join("");
      return `<Room Adults="${adults}" RoomCount="${roomCount}" ChildCount="${cnt}">${ages}</Room>`;
    })
    .join("");

  // --- Optional blocks
  const hotelsXml = (hotelIds && hotelIds.length)
    ? `<Hotels>${hotelIds.map(id => `<HotelId>${id}</HotelId>`).join("")}</Hotels>`
    : "";

  const basisXml = (filterBasis && filterBasis.length)
    ? `<FilterRoomBasises>${filterBasis.map(b => `<FilterRoomBasis>${b}</FilterRoomBasis>`).join("")}</FilterRoomBasises>`
    : "";

  // Build <Main ...> WITHOUT <Currency>
  const attrs = [
    `Version="2.3"`,
    `ResponseFormat="JSON"`,
    `IncludeGeo="true"`,
    maxHotels ? `MaxHotels="${maxHotels}"` : null,
    maxOffers ? `MaxOffers="${maxOffers}"` : null,
  ].filter(Boolean);

  const inner = `
    <Main ${attrs.join(" ")}>
      <MaximumWaitTime>${maximumWaitTime}</MaximumWaitTime>
      ${nationality ? `<Nationality>${nationality}</Nationality>` : ""}
      <CityCode>${cityId}</CityCode>
      ${hotelsXml}
      ${basisXml}
      <ArrivalDate>${arrivalDate}</ArrivalDate>
      <Nights>${nights}</Nights>
      <Rooms>
        ${roomsXml}
      </Rooms>
    </Main>
  `.trim();

  const envelope = buildSoapEnvelope({
    requestType: REQTYPE.HOTEL_SEARCH,
    operation: "HOTEL_SEARCH_REQUEST",
    innerXml: inner,
    agency,
    user,
    password: pass,
  });

  const text = await postSoap({
    endpoint,
    agency,
    operation: "HOTEL_SEARCH_REQUEST",
    envelope,
  });

  return extractProviderPayload(text);
}

/* ============================================================================
 * Read-only Hotel Info (requestType = 6)
 * ========================================================================== */
export async function hotelInfo({
  hotelId,
  language = "en",
  responseFormat = "JSON",
}) {
  const { endpoint, agency, user, pass } = getSupplierEnv();

  const inner = `
    <Main Version="2.2" ResponseFormat="${responseFormat}">
      <InfoHotelId>${hotelId}</InfoHotelId>
      <InfoLanguage>${language}</InfoLanguage>
    </Main>
  `.trim();

  const envelope = buildSoapEnvelope({
    requestType: REQTYPE.HOTEL_INFO,
    operation: "HOTEL_INFO_REQUEST",
    innerXml: inner,
    agency,
    user,
    password: pass,
  });

  const text = await postSoap({
    endpoint,
    agency,
    operation: "HOTEL_INFO_REQUEST",
    envelope,
  });

  // JSON will be returned if supported; otherwise { __rawXml: "..." }
  return extractProviderPayload(text);
}

/* ============================================================================
 * Booking Valuation (requestType = 9)
 * NO <Currency> tag — keep supplier default currency behavior
 * ========================================================================== */
export async function bookingValuation({ hotelSearchCode, arrivalDate, currency }) {
  const { endpoint, agency, user, pass } = getSupplierEnv();

  const inner = `
    <Main Version="2.0" ResponseFormat="JSON">
      <HotelSearchCode>${hotelSearchCode}</HotelSearchCode>
      ${arrivalDate ? `<ArrivalDate>${arrivalDate}</ArrivalDate>` : ""}
      <!-- Intentionally NOT sending <Currency> to keep supplier default -->
    </Main>
  `.trim();

  const envelope = buildSoapEnvelope({
    requestType: REQTYPE.BOOKING_VALUATION,
    operation: "BOOKING_VALUATION_REQUEST",
    innerXml: inner,
    agency,
    user,
    password: pass,
  });

  const text = await postSoap({
    endpoint,
    agency,
    operation: "BOOKING_VALUATION_REQUEST",
    envelope,
  });

  return extractProviderPayload(text);
}

/* ============================================================================
 * BOOKING INSERT (requestType = 2)
 * input:
 *  {
 *    hotelSearchCode, arrivalDate, nights,
 *    agentReference?, noAlternativeHotel?=1, leaderPersonId?="1",
 *    rooms: [{ adults, pax:[ {type:'adult', title, firstName, lastName} | {type:'child', firstName, lastName, age} ] }, ...]
 *  }
 * Note: PaymentCreditCard omitted for refundable flow (optional).
 * ========================================================================== */
export async function bookingInsert({
  hotelSearchCode,
  arrivalDate,
  nights,
  agentReference = "inLobby",
  noAlternativeHotel = 1,
  leaderPersonId = "1",
  rooms = [],
}) {
  const { endpoint, agency, user, pass } = getSupplierEnv();

  const roomsXml = buildRoomsXmlForInsert(rooms);

  // Պահպանում ենք նույն ձևաչափը, ինչ Postman-ում աշխատեց
  const inner = `
    <Main Version="2.3">
      <AgentReference>${agentReference}</AgentReference>
      <HotelSearchCode>${hotelSearchCode}</HotelSearchCode>
      <ArrivalDate>${arrivalDate}</ArrivalDate>
      <Nights>${Number(nights) || 1}</Nights>
      <NoAlternativeHotel>${noAlternativeHotel ? 1 : 0}</NoAlternativeHotel>
      <Leader LeaderPersonID="${leaderPersonId}"/>
      ${roomsXml}
      <!-- <PaymentCreditCard>...</PaymentCreditCard> -->
    </Main>
  `.trim();

  const envelope = buildSoapEnvelope({
    requestType: REQTYPE.BOOKING_INSERT,
    operation: "BOOKING_INSERT_REQUEST",
    innerXml: inner,
    agency,
    user,
    password: pass,
  });

  const text = await postSoap({
    endpoint,
    agency,
    operation: "BOOKING_INSERT_REQUEST",
    envelope,
  });

  return extractProviderPayload(text); // JSON չլինելու դեպքում => { __rawXml }
}

/* ============================================================================
 * BOOKING STATUS (requestType = 5)
 * input: { goBookingCode }
 * ========================================================================== */
export async function bookingStatus({ goBookingCode }) {
  const { endpoint, agency, user, pass } = getSupplierEnv();

  const inner = `
    <Main>
      <GoBookingCode>${goBookingCode}</GoBookingCode>
    </Main>
  `.trim();

  const envelope = buildSoapEnvelope({
    requestType: REQTYPE.BOOKING_STATUS,
    operation: "BOOKING_STATUS_REQUEST",
    innerXml: inner,
    agency,
    user,
    password: pass,
  });

  const text = await postSoap({
    endpoint,
    agency,
    operation: "BOOKING_STATUS_REQUEST",
    envelope,
  });

  return extractProviderPayload(text);
}

/* ============================================================================
 * BOOKING SEARCH / DETAILS (requestType = 4)
 * input: { goBookingCode }
 * ========================================================================== */
export async function bookingSearch({ goBookingCode }) {
  const { endpoint, agency, user, pass } = getSupplierEnv();

  const inner = `
    <Main>
      <GoBookingCode>${goBookingCode}</GoBookingCode>
    </Main>
  `.trim();

  const envelope = buildSoapEnvelope({
    requestType: REQTYPE.BOOKING_SEARCH,
    operation: "BOOKING_SEARCH_REQUEST",
    innerXml: inner,
    agency,
    user,
    password: pass,
  });

  const text = await postSoap({
    endpoint,
    agency,
    operation: "BOOKING_SEARCH_REQUEST",
    envelope,
  });

  return extractProviderPayload(text);
}

/* ============================================================================
 * BOOKING CANCEL (requestType = 3)
 * input: { goBookingCode }
 * ========================================================================== */
export async function bookingCancel({ goBookingCode }) {
  const { endpoint, agency, user, pass } = getSupplierEnv();

  const inner = `
    <Main>
      <GoBookingCode>${goBookingCode}</GoBookingCode>
    </Main>
  `.trim();

  const envelope = buildSoapEnvelope({
    requestType: REQTYPE.BOOKING_CANCEL,
    operation: "BOOKING_CANCEL_REQUEST",
    innerXml: inner,
    agency,
    user,
    password: pass,
  });

  const text = await postSoap({
    endpoint,
    agency,
    operation: "BOOKING_CANCEL_REQUEST",
    envelope,
  });

  return extractProviderPayload(text);
}
