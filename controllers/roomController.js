import Room from "../models/Room.js";
import Hotel from "../models/Hotel.js";

// ✅ Ստեղծել նոր սենյակ
// ✅ Ստեղծել նոր սենյակ
export const createRoom = async (req, res) => {
  try {
    const { hotelId } = req.params;
    const hotel = await Hotel.findById(hotelId);

    if (!hotel) {
      return res.status(404).json({ message: "Hotel not found" });
    }

    if (hotel.owner.toString() !== req.user.id && req.user.role !== "admin") {
      return res.status(403).json({ message: "Access Denied" });
    }

    const newRoom = new Room({ ...req.body, hotel: hotelId });
    const savedRoom = await newRoom.save();

    // ✅ Հյուրանոցին ավելացնում ենք նոր սենյակի ID-ն
    await Hotel.findByIdAndUpdate(hotelId, {
      $push: { rooms: savedRoom._id }
    });

    res.status(201).json(savedRoom);
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// ✅ Թարմացնել սենյակի տվյալները
// ✅ Թարմացնել սենյակի տվյալները
export const updateRoom = async (req, res) => {
  try {
    const roomId = req.params.roomId;
    const room = await Room.findById(roomId);
    if (!room) {
      return res.status(404).json({ message: "Room not found" });
    }

    const currentHotel = await Hotel.findById(room.hotel);
    if (currentHotel.owner.toString() !== req.user.id && req.user.role !== "admin") {
      return res.status(403).json({ message: "Access Denied" });
    }

    const newHotelId = req.body.hotel;

    // ✅ Ստուգում ենք՝ արդյոք սենյակի հյուրանոցը փոխվել է
    if (newHotelId && newHotelId !== room.hotel.toString()) {
      const newHotel = await Hotel.findById(newHotelId);
      if (!newHotel) {
        return res.status(404).json({ message: "New hotel not found" });
      }

      // ✅ Թարմացնում ենք հին հյուրանոցի rooms-ից սենյակը հանելով
      await Hotel.findByIdAndUpdate(room.hotel, {
        $pull: { rooms: room._id }
      });

      // ✅ Ավելացնում ենք սենյակը նոր հյուրանոցի rooms-ում
      await Hotel.findByIdAndUpdate(newHotelId, {
        $addToSet: { rooms: room._id }
      });

      room.hotel = newHotelId; // ✅ Սահմանում ենք նոր հյուրանոցը սենյակի մեջ
    }

    // ✅ Թարմացնում ենք մնացած դաշտերը
    Object.assign(room, req.body);
    const updatedRoom = await room.save();

    res.status(200).json(updatedRoom);
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// ✅ Ջնջել սենյակ
export const deleteRoom = async (req, res) => {
  try {
    const room = await Room.findById(req.params.roomId);

    if (!room) {
      return res.status(404).json({ message: "Room not found" });
    }

    const hotel = await Hotel.findById(room.hotel);
    if (!hotel) {
      return res.status(404).json({ message: "Associated hotel not found" });
    }

    if (hotel.owner.toString() !== req.user.id && req.user.role !== "admin") {
      return res.status(403).json({ message: "Access Denied" });
    }
    // ✅ Հեռացնում ենք սենյակի ID-ն հյուրանոցից
    await Hotel.findByIdAndUpdate(hotel._id, {
      $pull: { rooms: room._id }
    });
    // ✅ Ջնջում ենք սենյակը
    await Room.findByIdAndDelete(room._id);

    res.status(200).json({ message: "Room deleted and removed from hotel." });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// ✅ Ստանալ հյուրանոցի բոլոր սենյակները
export const getRoomsByHotel = async (req, res) => {
  try {
    const rooms = await Room.find({ hotel: req.params.hotelId });
    res.status(200).json(rooms);
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// ✅ Ստանալ կոնկրետ սենյակ ըստ ID-ի
export const getRoomById = async (req, res) => {
  try {
    const room = await Room.findById(req.params.roomId).populate("hotel");
    if (!room) return res.status(404).json({ message: "Room not found" });

    let finalPrice = room.price;

    if (req.user?.role === "b2b_sales_partner") {
      finalPrice = room.price * (1 + req.user.markupPercentage / 100);
    } else {
      const markup = Number(process.env.B2C_MARKUP || 15);
      finalPrice = room.price * (1 + markup / 100);
    }

    res.status(200).json({ ...room.toObject(), computedPrice: finalPrice });
  } catch (error) {
    console.error("❌ Room fetch error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

export const getPublicRoomById = async (req, res) => {
  try {
    const room = await Room.findById(req.params.roomId).populate("hotel");
    if (!room) return res.status(404).json({ message: "Room not found" });

    const markup = Number(process.env.B2C_MARKUP || 15);
    const finalPrice = room.price * (1 + markup / 100);

    res.status(200).json({ ...room.toObject(), computedPrice: finalPrice });
  } catch (error) {
    console.error("❌ Public room fetch error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};