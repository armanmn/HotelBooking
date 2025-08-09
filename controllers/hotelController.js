import Hotel from "../models/Hotel.js";
import Offer from "../models/Offer.js";
import GlobalSettings from "../models/GlobalSettings.js";

// Ստեղծել նոր հյուրանոց
export const createHotel = async (req, res) => {
  try {
    const newHotel = new Hotel({
      ...req.body,
      owner: req.user.id,
      isApproved: false,
    });

    const savedHotel = await newHotel.save();
    res.status(201).json(savedHotel);
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Թարմացնել հյուրանոց
export const updateHotel = async (req, res) => {
  try {
    const hotel = await Hotel.findById(req.params.id);
    if (!hotel) return res.status(404).json({ message: "Hotel not found" });

    if (hotel.owner.toString() !== req.user.id && req.user.role !== "admin") {
      return res.status(403).json({ message: "Access Denied" });
    }

    const updatedHotel = await Hotel.findByIdAndUpdate(
      req.params.id,
      { ...req.body },
      { new: true }
    );

    res.status(200).json(updatedHotel);
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Ջնջել հյուրանոց
export const deleteHotel = async (req, res) => {
  try {
    const hotel = await Hotel.findById(req.params.id);
    if (!hotel) return res.status(404).json({ message: "Hotel not found" });

    if (hotel.owner.toString() !== req.user.id && req.user.role !== "admin") {
      return res.status(403).json({ message: "Access Denied" });
    }

    await Hotel.findByIdAndDelete(req.params.id);
    res.status(200).json({ message: "Hotel deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// export const getAllHotels = async (req, res) => {
//   try {
//     const user = req.user || {};
//     const role = user.role || "guest";

//     // ⚙️ Վերցնում ենք settings
//     const settings = await GlobalSettings.findOne({});
//     const b2cMarkup = (settings?.b2cMarkupPercentage || 0) / 100;
//     const officeMarkup = (settings?.officeMarkupPercentage || 0) / 100;
//     const defaultSalesPartnerMarkup = (settings?.defaultSalesPartnerMarkup || 0) / 100;

//     // --- Ֆիլտր
//     let filter = {};
//     if (role === "b2b_hotel_partner") filter = { owner: user.id };
//     else if (role !== "admin" && role !== "office_user") {
//       filter = { $or: [{ isApproved: true }, { partnerType: "external_api" }] };
//     }

//     if (req.query.city) {
//       filter["location.city"] = new RegExp(`^${req.query.city}$`, "i");
//     }

//     // --- Pagination params ---
//     const page = parseInt(req.query.page) || 1;
//     const limit = parseInt(req.query.limit) || 20;
//     const skip = (page - 1) * limit;

//     // --- Aggregation with $facet ---
//     const result = await Hotel.aggregate([
//       { $match: filter },
//       {
//         $lookup: {
//           from: "offers",
//           localField: "_id",
//           foreignField: "hotel",
//           as: "offers",
//         },
//       },
//       {
//         $addFields: {
//           minOffer: {
//             $first: {
//               $filter: {
//                 input: "$offers",
//                 as: "offer",
//                 cond: {
//                   $eq: ["$$offer.price.amount", { $min: "$offers.price.amount" }]
//                 }
//               }
//             }
//           }
//         }
//       },
//       {
//         $match: {
//           "minOffer.price.amount": { $gt: 0 },
//           "minOffer.price.currency": { $exists: true, $ne: null }
//         }
//       },
//       {
//         $facet: {
//           hotels: [
//             { $skip: skip },
//             { $limit: limit },
//             {
//               $project: {
//                 _id: 1,
//                 name: 1,
//                 stars: 1,
//                 thumbnail: 1,
//                 images: 1,
//                 rating: 1,
//                 reviewsCount: 1,
//                 externalRating: 1,
//                 location: {
//                   city: "$location.city",
//                   country: "$location.country",
//                   address: "$location.address",
//                   lat: "$location.coordinates.lat",
//                   lng: "$location.coordinates.lng",
//                 },
//                 externalSource: {
//                   provider: "$externalSource.provider",
//                   hotelCode: "$externalSource.providerHotelId",
//                   cityId: "$externalSource.cityId",
//                 },
//                 "minOffer.price.amount": 1,
//                 "minOffer.price.currency": 1,
//               },
//             },
//           ],
//           totalCount: [{ $count: "count" }],
//         },
//       },
//     ]);

//     const hotels = result[0].hotels;
//     const total = result[0].totalCount[0]?.count || 0;

//     // --- Հաշվում ենք գնային դաշտը ըստ ռոլի ---
//     const hotelsWithPrices = hotels.map((hotel) => {
//       const net = hotel.minOffer.price.amount;
//       const currency = hotel.minOffer.price.currency;
//       let finalPrice = net;

//       if (role === "b2c") {
//         finalPrice = net * (1 + b2cMarkup);
//       } else if (role === "b2b_sales_partner") {
//         const individualMarkup = (user.markupPercentage || defaultSalesPartnerMarkup * 100) / 100;
//         finalPrice = net * (1 + individualMarkup);
//       } else if (role === "office_user") {
//         finalPrice = net * (1 + officeMarkup);
//       }

//       return {
//         ...hotel,
//         minPrice: {
//           amount: Number(finalPrice.toFixed(2)),
//           currency,
//         },
//       };
//     });

//     res.status(200).json({
//       hotels: hotelsWithPrices,
//       total,
//       totalPages: Math.ceil(total / limit),
//       currentPage: page,
//     });
//   } catch (error) {
//     console.error("❌ getAllHotels error:", error);
//     res.status(500).json({ message: "Server error", error: error.message });
//   }
// };

export const getAllHotels = async (req, res) => {
  try {
    const user = req.user || {};
    const role = user.role || "guest";

    // ⚙️ Վերցնում ենք settings
    const settings = await GlobalSettings.findOne({});
    const b2cMarkup = (settings?.b2cMarkupPercentage || 0) / 100;
    const officeMarkup = (settings?.officeMarkupPercentage || 0) / 100;
    const defaultSalesPartnerMarkup = (settings?.defaultSalesPartnerMarkup || 0) / 100;

    // --- Ֆիլտր
    let filter = {};
    if (role === "b2b_hotel_partner") filter = { owner: user.id };
    else if (role !== "admin" && role !== "office_user") {
      filter = { $or: [{ isApproved: true }, { partnerType: "external_api" }] };
    }

    if (req.query.city) {
      filter["location.city"] = new RegExp(`^${req.query.city}$`, "i");
    }

    // --- Pagination params ---
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    // --- Sorting ---
    const sortParam = req.query.sort;
    let sortStage = null;

    if (sortParam === "price_asc") {
      sortStage = { $sort: { "minOffer.price.amount": 1 } };
    } else if (sortParam === "price_desc") {
      sortStage = { $sort: { "minOffer.price.amount": -1 } };
    }

    // --- Aggregation with $facet ---
    const result = await Hotel.aggregate([
      { $match: filter },
      {
        $lookup: {
          from: "offers",
          localField: "_id",
          foreignField: "hotel",
          as: "offers",
        },
      },
      {
        $addFields: {
          minOffer: {
            $first: {
              $filter: {
                input: "$offers",
                as: "offer",
                cond: {
                  $eq: ["$$offer.price.amount", { $min: "$offers.price.amount" }]
                }
              }
            }
          }
        }
      },
      {
        $match: {
          "minOffer.price.amount": { $gt: 0 },
          "minOffer.price.currency": { $exists: true, $ne: null }
        }
      },
      {
        $facet: {
          hotels: [
            ...(sortStage ? [sortStage] : []),  // ✅ Ավելացնում ենք սորտավորում եթե պահանջված է
            { $skip: skip },
            { $limit: limit },
            {
              $project: {
                _id: 1,
                name: 1,
                stars: 1,
                thumbnail: 1,
                images: 1,
                rating: 1,
                reviewsCount: 1,
                externalRating: 1,
                location: {
                  city: "$location.city",
                  country: "$location.country",
                  address: "$location.address",
                  lat: "$location.coordinates.lat",
                  lng: "$location.coordinates.lng",
                },
                externalSource: {
                  provider: "$externalSource.provider",
                  hotelCode: "$externalSource.providerHotelId",
                  cityId: "$externalSource.cityId",
                },
                "minOffer.price.amount": 1,
                "minOffer.price.currency": 1,
              },
            },
          ],
          totalCount: [{ $count: "count" }],
        },
      },
    ]);

    const hotels = result[0].hotels;
    const total = result[0].totalCount[0]?.count || 0;

    // --- Հաշվում ենք գնային դաշտը ըստ ռոլի ---
    const hotelsWithPrices = hotels.map((hotel) => {
      const net = hotel.minOffer.price.amount;
      const currency = hotel.minOffer.price.currency;
      let finalPrice = net;

      if (role === "b2c") {
        finalPrice = net * (1 + b2cMarkup);
      } else if (role === "b2b_sales_partner") {
        const individualMarkup = (user.markupPercentage || defaultSalesPartnerMarkup * 100) / 100;
        finalPrice = net * (1 + individualMarkup);
      } else if (role === "office_user") {
        finalPrice = net * (1 + officeMarkup);
      }

      return {
        ...hotel,
        minPrice: {
          amount: Number(finalPrice.toFixed(2)),
          currency,
        },
      };
    });

    res.status(200).json({
      hotels: hotelsWithPrices,
      total,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
    });
  } catch (error) {
    console.error("❌ getAllHotels error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Ստանալ կոնկրետ հյուրանոց ըստ ID-ի
export const getHotelById = async (req, res) => {
  try {
    const hotel = await Hotel.findById(req.params.id).populate("owner", "firstName lastName email");
    if (!hotel) return res.status(404).json({ message: "Hotel not found" });

    const offers = await Offer.find({ hotel: hotel._id }).sort({ "price.amount": 1 });

    res.status(200).json({ ...hotel.toObject(), offers });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Հաստատել հյուրանոցը ադմինի կողմից
export const approveHotel = async (req, res) => {
  try {
    const hotel = await Hotel.findById(req.params.id);
    if (!hotel) return res.status(404).json({ message: "Hotel not found" });

    hotel.isApproved = req.body.isApproved;
    await hotel.save();

    res.status(200).json({
      message: `Hotel has been ${req.body.isApproved ? "approved" : "suspended"}`,
      hotel,
    });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Որոնում հյուրանոցների՝ ըստ պարամետրերի
// export const searchHotels = async (req, res) => {
//   try {
//     const {
//       destination,
//       hotelName,
//       priceMin,
//       priceMax,
//       facilities,
//     } = req.query;

//     let hotelFilter = { isApproved: true };
//     if (destination) {
//       hotelFilter["location.city"] = { $regex: destination, $options: "i" };
//     }
//     if (hotelName) {
//       hotelFilter.name = { $regex: hotelName, $options: "i" };
//     }
//     if (facilities) {
//       hotelFilter.facilities = { $all: facilities.split(",") };
//     }

//     const hotels = await Hotel.aggregate([
//       { $match: hotelFilter },
//       {
//         $lookup: {
//           from: "offers",
//           localField: "_id",
//           foreignField: "hotel",
//           as: "offers",
//         },
//       },
//       {
//         $addFields: {
//           filteredOffers: {
//             $filter: {
//               input: "$offers",
//               as: "offer",
//               cond: {
//                 $and: [
//                   priceMin ? { $gte: ["$$offer.price.amount", Number(priceMin)] } : {},
//                   priceMax ? { $lte: ["$$offer.price.amount", Number(priceMax)] } : {},
//                 ],
//               },
//             },
//           },
//         },
//       },
//       {
//         $addFields: {
//           netMinPrice: { $min: "$filteredOffers.price.amount" },
//         },
//       },
//       {
//         $addFields: {
//           finalPrice: { $cond: [
//             { $gt: ["$netMinPrice", 0] },
//             { $multiply: ["$netMinPrice", 1 + (req.user?.markupPercentage || 0) / 100] },
//             null
//           ] },
//         },
//       },
//       {
//         $project: {
//           name: 1,
//           stars: 1,
//           thumbnail: 1,
//           location: 1,
//           externalRating: 1,
//           rating: 1,
//           reviewsCount: 1,
//           finalPrice: 1,
//         },
//       },
//     ]);

//     res.status(200).json(hotels);
//   } catch (error) {
//     res.status(500).json({ message: "Search failed", error: error.message });
//   }
// };

export const searchHotels = async (req, res) => {
  try {
    const {
      destination,
      hotelName,
      priceMin,
      priceMax,
      facilities,
      sort, // ✅ վերցնում ենք sort պարամետրը
    } = req.query;

    let hotelFilter = { isApproved: true };
    if (destination) {
      hotelFilter["location.city"] = { $regex: destination, $options: "i" };
    }
    if (hotelName) {
      hotelFilter.name = { $regex: hotelName, $options: "i" };
    }
    if (facilities) {
      hotelFilter.facilities = { $all: facilities.split(",") };
    }

    // ✅ Նախապատրաստում ենք pipeline
    const pipeline = [
      { $match: hotelFilter },
      {
        $lookup: {
          from: "offers",
          localField: "_id",
          foreignField: "hotel",
          as: "offers",
        },
      },
      {
        $addFields: {
          filteredOffers: {
            $filter: {
              input: "$offers",
              as: "offer",
              cond: {
                $and: [
                  priceMin ? { $gte: ["$$offer.price.amount", Number(priceMin)] } : {},
                  priceMax ? { $lte: ["$$offer.price.amount", Number(priceMax)] } : {},
                ],
              },
            },
          },
        },
      },
      {
        $addFields: {
          netMinPrice: { $min: "$filteredOffers.price.amount" },
        },
      },
      {
        $addFields: {
          finalPrice: {
            $cond: [
              { $gt: ["$netMinPrice", 0] },
              {
                $multiply: [
                  "$netMinPrice",
                  1 + (req.user?.markupPercentage || 0) / 100,
                ],
              },
              null,
            ],
          },
        },
      },
    ];

    // ✅ Ավելացնում ենք սորտավորում ըստ պահանջված ուղղության
    if (sort === "price_asc") {
      pipeline.push({ $sort: { finalPrice: 1 } });
    } else if (sort === "price_desc") {
      pipeline.push({ $sort: { finalPrice: -1 } });
    }

    // ✅ Շարունակում ենք project-ով
    pipeline.push({
      $project: {
        name: 1,
        stars: 1,
        thumbnail: 1,
        location: 1,
        externalRating: 1,
        rating: 1,
        reviewsCount: 1,
        finalPrice: 1,
      },
    });

    const hotels = await Hotel.aggregate(pipeline);

    res.status(200).json(hotels);
  } catch (error) {
    res.status(500).json({ message: "Search failed", error: error.message });
  }
};

// Ստանալ հասանելի քաղաքներ
export const getAvailableCities = async (req, res) => {
  try {
    const cities = await Hotel.distinct("location.city", {
      isVisible: true,
      isApproved: true,
    });
    const lowercased = cities.map((c) => c.toLowerCase());
    res.json(lowercased);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch cities", error: error.message });
  }
};

// Ստանալ գործընկեր հյուրանոցները
export const getMyHotels = async (req, res) => {
  try {
    const { id, role } = req.user;

    if (role !== "b2b_hotel_partner") {
      return res.status(403).json({ message: "Only hotel partners can access their hotels." });
    }

    const hotels = await Hotel.find({ owner: id });
    res.status(200).json(hotels);
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};