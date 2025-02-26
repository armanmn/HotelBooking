import Room from "../models/Room.js";
import Hotel from "../models/Hotel.js";

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
    res.status(201).json(savedRoom);
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// ✅ Թարմացնել սենյակի տվյալները
export const updateRoom = async (req, res) => {
  try {
    const room = await Room.findById(req.params.roomId);

    if (!room) {
      return res.status(404).json({ message: "Room not found" });
    }

    const hotel = await Hotel.findById(room.hotel);
    if (hotel.owner.toString() !== req.user.id && req.user.role !== "admin") {
      return res.status(403).json({ message: "Access Denied" });
    }

    const updatedRoom = await Room.findByIdAndUpdate(req.params.roomId, req.body, { new: true });
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
    if (hotel.owner.toString() !== req.user.id && req.user.role !== "admin") {
      return res.status(403).json({ message: "Access Denied" });
    }

    await Room.findByIdAndDelete(req.params.roomId);
    res.status(200).json({ message: "Room deleted successfully" });
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
      const room = await Room.findById(req.params.id).populate("hotel");
      if (!room) {
          return res.status(404).json({ message: "Room not found" });
      }

      // Հաշվարկում ենք գինը ըստ օգտատիրոջ կարգավիճակի
      let finalPrice = room.price; // Net price

      if (req.user.role === "b2c") {
          finalPrice = room.price * (1 + process.env.B2C_MARKUP / 100);
      } else if (req.user.role === "b2b_sales_partner") {
          finalPrice = room.price * (1 + req.user.markupPercentage / 100);
      }

      res.status(200).json({ ...room.toObject(), computedPrice: finalPrice });
  } catch (error) {
      res.status(500).json({ message: "Server error", error: error.message });
  }
};