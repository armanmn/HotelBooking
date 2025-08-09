// scripts/importGoGlobalFull.js
import mongoose from "mongoose";
import axios from "axios";
import xml2js from "xml2js";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import Hotel from "../models/Hotel.js";
import Offer from "../models/Offer.js";

dotenv.config();

const MONGO_URI = process.env.MONGO_URI;
const GOGLOBAL_ENDPOINT =
  "https://inlobby.xml.goglobal.travel/xmlwebservice.asmx";
const agency = process.env.GOGLOBAL_AGENCY;
const user = process.env.GOGLOBAL_USER;
const password = process.env.GOGLOBAL_PASSWORD;
const goglobalOwnerId = "6867edc41d14c3f94e5e6092";

const parser = new xml2js.Parser({ explicitArray: false });

// Load cities list
const __dirname = path.dirname(new URL(import.meta.url).pathname);
const citiesRaw = fs.readFileSync(
  path.join(__dirname, "../data/gogl_cities.json"),
  "utf-8"
);
const goglCities = JSON.parse(citiesRaw);

// Date helper
function getTodayPlusDays(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().split("T")[0];
}

// Build HOTEL_SEARCH request by CityCode
const buildCitySearchRequest = (cityId) => `
<Root>
  <Header>
    <Agency>${agency}</Agency>
    <User>${user}</User>
    <Password>${password}</Password>
    <Operation>HOTEL_SEARCH_REQUEST</Operation>
    <OperationType>Request</OperationType>
  </Header>
  <Main Version="2.3" ResponseFormat="JSON" MaxResponses="10">
    <MaximumWaitTime>15</MaximumWaitTime>
    <MaxOffers>10</MaxOffers>
    <Nationality>AM</Nationality>
    <CityCode>${cityId}</CityCode>
    <ArrivalDate>${getTodayPlusDays(30)}</ArrivalDate>
    <Nights>1</Nights>
    <Rooms>
      <Room Adults="2" RoomCount="1" ChildCount="0" />
    </Rooms>
  </Main>
</Root>
`;

// Wrap SOAP
const wrapInSoapEnvelope = (xmlRequest) => `
<soap12:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
                 xmlns:xsd="http://www.w3.org/2001/XMLSchema"
                 xmlns:soap12="http://www.w3.org/2003/05/soap-envelope">
  <soap12:Body>
    <MakeRequest xmlns="http://www.goglobal.travel/">
      <requestType>11</requestType>
      <xmlRequest><![CDATA[
        ${xmlRequest}
      ]]></xmlRequest>
    </MakeRequest>
  </soap12:Body>
</soap12:Envelope>
`;

// Fetch hotels for a city
const fetchHotelsForCity = async (city) => {
  try {
    const xmlRequest = buildCitySearchRequest(city.CityId);
    const soapRequest = wrapInSoapEnvelope(xmlRequest);

    const response = await axios.post(GOGLOBAL_ENDPOINT, soapRequest, {
      headers: { "Content-Type": "application/soap+xml; charset=utf-8" },
    });

    const result = await parser.parseStringPromise(response.data);
    const jsonResponse = JSON.parse(
      result["soap:Envelope"]["soap:Body"]["MakeRequestResponse"][
        "MakeRequestResult"
      ]
    );

    const hotels = jsonResponse?.Hotels || [];
    return Array.isArray(hotels) ? hotels : [];
  } catch (err) {
    console.error(
      `❌ Failed to fetch hotels for city ${city.CityName}`,
      err.message
    );
    return [];
  }
};

const runImport = async () => {
  try {
    await mongoose.connect(MONGO_URI);
    console.log("✅ Connected to MongoDB");

    // Clear all GoGlobal offers first
    const offersDeleted = await Offer.deleteMany({ provider: "goglobal" });
    console.log(`🗑️ Deleted ${offersDeleted.deletedCount} old GoGlobal offers`);

    let totalHotels = 0;
    let totalOffers = 0;

    for (const city of goglCities) {
      const startTime = Date.now();
      const hotels = await fetchHotelsForCity(city);
      console.log(`🏨 City ${city.CityName}: Found ${hotels.length} hotels`);

      for (const h of hotels) {
        const payload = {
          name: h.HotelName,
          description: { en: h.Remark || "" },
          location: {
            country: city.Country || "",
            city: city.CityName || "",
            address: h.Location || "N/A",
            coordinates: {
              lat: parseFloat(h.Latitude) || 0,
              lng: parseFloat(h.Longitude) || 0,
            },
          },
          stars: parseInt(h.Category || 3),

          // Նոր դաշտ՝ thumbnail (փոքր նկարը)
          thumbnail: h.Thumbnail || null,

          // Լիարժեք նկարների զանգված
          images: [
            ...(h.HotelImage ? [{ url: h.HotelImage, isMain: true }] : []),
            ...(h.Thumbnail ? [{ url: h.Thumbnail, isMain: false }] : []),
          ],

          facilities: h.HotelFacilities || [],

          partnerType: "external_api",
          externalSource: {
            provider: "goglobal",
            providerHotelId: String(h.HotelCode), // HotelCode
            cityId: String(city.CityId), // CityId
            countryId: String(h.CountryId || city.CountryId || ""),
            lastSyncedAt: new Date(),
          },
          isApproved: true,
          isVisible: true,
          owner: goglobalOwnerId,
        };

        // Upsert hotel
        const hotelDoc = await Hotel.findOneAndUpdate(
          {
            "externalSource.provider": "goglobal",
            "externalSource.providerHotelId": String(h.HotelCode),
          },
          payload,
          { upsert: true, new: true }
        );

        totalHotels++;

        // --- Prepare offers for BulkWrite ---
        const offers = h.Offers || [];
        const bulkOps = [];
        let minPrice = null;
        let minCurrency = null;

        for (const room of offers) {
          const offerPrice = parseFloat(room.TotalPrice);
          const offerCurrency = room.Currency;
          if (!offerPrice || !offerCurrency) continue; // skip invalid offers

          // Track min price
          if (minPrice === null || offerPrice < minPrice) {
            minPrice = offerPrice;
            minCurrency = offerCurrency;
          }

          bulkOps.push({
            updateOne: {
              filter: {
                hotel: hotelDoc._id,
                externalOfferId: room.HotelSearchCode,
              },
              update: {
                $set: {
                  hotel: hotelDoc._id,
                  provider: "goglobal",
                  externalOfferId: room.HotelSearchCode,
                  roomType: room.RoomType || "N/A",
                  boardType: room.BoardType || "RO",
                  price: {
                    amount: offerPrice,
                    currency: offerCurrency,
                    lastUpdated: new Date(),
                  },
                  cancellationPolicy: {
                    refundable: !room.NonRef,
                    deadline: room.CxlDeadLine,
                    notes: room.CancellationDescription || "",
                  },
                  rateDetails: { rateType: room.RatePlanCode || "" },
                  sync: {
                    providerHotelId: String(h.HotelCode),
                    providerRoomId: room.RoomCode || "",
                    lastSyncedAt: new Date(),
                  },
                  hotelStars: parseInt(h.Category || 3),
                },
              },
              upsert: true,
            },
          });
        }

        if (bulkOps.length > 0) {
          await Offer.bulkWrite(bulkOps);
          totalOffers += bulkOps.length;
        }

        // --- Update hotel's minPrice if offers exist ---
        if (minPrice !== null && minCurrency) {
          await Hotel.updateOne(
            { _id: hotelDoc._id },
            { $set: { minPrice: { amount: minPrice, currency: minCurrency } } }
          );
        }
      }

      console.log(
        `✅ Finished city ${city.CityName} in ${
          (Date.now() - startTime) / 1000
        }s`
      );
    }

    console.log(
      `🏁 Import finished: ${totalHotels} hotels, ${totalOffers} offers imported.`
    );
    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error("❌ Error during import:", err);
    await mongoose.disconnect();
    process.exit(1);
  }
};

runImport();
