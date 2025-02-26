import Hotel from "../models/Hotel.js";

// ✅ Ստեղծել նոր հյուրանոց
export const createHotel = async (req, res) => {
  try {
    const newHotel = new Hotel({
      ...req.body,
      owner: req.user.id,
      isApproved: false, // ✅ Նախնական հաստատված չէ
    });

    const savedHotel = await newHotel.save();
    res.status(201).json(savedHotel);
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// ✅ Թարմացնել հյուրանոցի տվյալները
export const updateHotel = async (req, res) => {
  try {
    const hotel = await Hotel.findById(req.params.id);
    if (!hotel) {
      return res.status(404).json({ message: "Hotel not found" });
    }

    // ✅ Ստուգում է, արդյոք օգտատերը հյուրանոցի սեփականատերն է
    if (hotel.owner.toString() !== req.user.id && req.user.role !== "admin") {
      return res.status(403).json({ message: "Access Denied" });
    }

    const updatedHotel = await Hotel.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.status(200).json(updatedHotel);
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// ✅ Ջնջել հյուրանոց (Միայն սեփականատերը կամ Admin-ը)
export const deleteHotel = async (req, res) => {
  try {
    const hotel = await Hotel.findById(req.params.id);
    if (!hotel) {
      return res.status(404).json({ message: "Hotel not found" });
    }

    if (hotel.owner.toString() !== req.user.id && req.user.role !== "admin") {
      return res.status(403).json({ message: "Access Denied" });
    }

    await Hotel.findByIdAndDelete(req.params.id);
    res.status(200).json({ message: "Hotel deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// ✅ Ստանալ հյուրանոցները՝ կախված օգտատիրոջ կարգավիճակից և հյուրանոցի աղբյուրից
export const getAllHotels = async (req, res) => {
  try {
    let filter = { 
      isApproved: true // ✅ Default - միայն հաստատվածները B2C օգտատերերի համար
    };

    // ✅ Եթե օգտատերը admin կամ office_user է, տեսնում է բոլոր հյուրանոցները
    if (req.user && (req.user.role === "admin" || req.user.role === "office_user")) {
      filter = {}; // ✅ Ցույց է տալիս բոլոր հյուրանոցները
    }

    // ✅ Եթե հյուրանոցը ստացվել է գործընկերոջ API-ից, ապա այն արդեն հաստատված է
    filter.$or = [
      { isApproved: true }, // ✅ Հաստատված հյուրանոցները
      { partnerType: "external_api" } // ✅ API-ից ստացված հյուրանոցները (որոնք հաստատման կարիք չունեն)
    ];

    const hotels = await Hotel.find(filter).populate("owner", "name email");
    res.status(200).json(hotels);
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// ✅ Ստանալ կոնկրետ հյուրանոց ըստ ID-ի
export const getHotelById = async (req, res) => {
  try {
    const hotel = await Hotel.findById(req.params.id).populate("owner", "name email");
    if (!hotel) {
      return res.status(404).json({ message: "Hotel not found" });
    }
    res.status(200).json(hotel);
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// ✅ Ադմին կարող է հաստատել հյուրանոցը
export const approveHotel = async (req, res) => {
  try {
    const hotel = await Hotel.findById(req.params.id);
    if (!hotel) {
      return res.status(404).json({ message: "Hotel not found" });
    }

    hotel.isApproved = true;
    await hotel.save();
    res.status(200).json({ message: "Hotel approved successfully", hotel });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// ✅ Ստանալ հյուրանոցները՝ ըստ որոնման պարամետրերի
export const searchHotels = async (req, res) => {
  try {
    const { destination, hotelName, checkIn, checkOut, adults, children, rooms, priceMin, priceMax, facilities } = req.query;

    let filter = { isApproved: true }; // ✅ Default - միայն հաստատված հյուրանոցները

    // ✅ Եթե որոնում է ըստ քաղաքի կամ հյուրանոցի անվան
    if (destination) {
      filter["location.city"] = { $regex: destination, $options: "i" };
    }
    if (hotelName) {
      filter.name = { $regex: hotelName, $options: "i" };
    }

    // ✅ Եթե որոնվում է ըստ գնի
    if (priceMin || priceMax) {
      filter.rooms = {
        $elemMatch: {
          price: {
            ...(priceMin ? { $gte: priceMin } : {}),
            ...(priceMax ? { $lte: priceMax } : {}),
          }
        }
      };
    }

    // ✅ Եթե որոնվում է ըստ ֆիլտրերի (WiFi, Pool, Breakfast Included)
    if (facilities) {
      filter.facilities = { $all: facilities.split(",") };
    }

    // ✅ Եթե որոնում է կոնկրետ ամսաթվերով, պետք է ստուգենք, որ գոնե 1 սենյակ հասանելի լինի
    if (checkIn && checkOut) {
      const checkInDate = new Date(checkIn);
      const checkOutDate = new Date(checkOut);

      filter.rooms = {
        $elemMatch: {
          availability: { $gte: rooms }, // ✅ Ստուգում ենք, որ հասանելի սենյակ լինի
        }
      };
    }

    // ✅ Վերադարձնում ենք համապատասխան հյուրանոցները
    const hotels = await Hotel.find(filter).populate("rooms");
    res.status(200).json(hotels);
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};
