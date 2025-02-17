// controllers/roomController.js

const Room = require('../models/Room');
const Hotel = require('../models/Hotel');

// Ստանալ բոլոր սենյակները
exports.getAllRooms = async (req, res) => {
  try {
    const rooms = await Room.find().populate('hotel', 'name location');
    res.json(rooms);
  } catch (error) {
    res.status(500).json({ message: 'Սերվերի սխալ' });
  }
};

// Ստանալ կոնկրետ սենյակ ըստ ID-ի
exports.getRoomById = async (req, res) => {
  try {
    const room = await Room.findById(req.params.id).populate('hotel', 'name location');
    if (!room) {
      return res.status(404).json({ message: 'Սենյակը չի գտնվել' });
    }
    res.json(room);
  } catch (error) {
    res.status(500).json({ message: 'Սերվերի սխալ' });
  }
};

// Ավելացնել նոր սենյակ
exports.createRoom = async (req, res) => {
  const { hotelId, type, description, price, maxGuests, availableDates } = req.body;

  try {
    const hotel = await Hotel.findById(hotelId);
    if (!hotel) {
      return res.status(404).json({ message: 'Հյուրանոցը չի գտնվել' });
    }

    const newRoom = new Room({
      hotel: hotelId,
      type,
      description,
      price,
      maxGuests,
      availableDates,
    });

    await newRoom.save();

    // Ավելացնել սենյակը հյուրանոցի սենյակների ցանկում
    hotel.rooms.push(newRoom._id);
    await hotel.save();

    res.status(201).json(newRoom);
  } catch (error) {
    res.status(500).json({ message: 'Սերվերի սխալ' });
  }
};

// Թարմացնել սենյակ
exports.updateRoom = async (req, res) => {
  const { type, description, price, maxGuests, availableDates } = req.body;

  try {
    const room = await Room.findById(req.params.id);
    if (!room) {
      return res.status(404).json({ message: 'Սենյակը չի գտնվել' });
    }

    room.type = type || room.type;
    room.description = description || room.description;
    room.price = price || room.price;
    room.maxGuests = maxGuests || room.maxGuests;
    room.availableDates = availableDates || room.availableDates;

    await room.save();

    res.json(room);
  } catch (error) {
    res.status(500).json({ message: 'Սերվերի սխալ' });
  }
};

// Ջնջել սենյակ
exports.deleteRoom = async (req, res) => {
  try {
    const room = await Room.findById(req.params.id);
    if (!room) {
      return res.status(404).json({ message: 'Սենյակը չի գտնվել' });
    }

    await room.remove();

    // Հեռացնել սենյակը համապատասխան հյուրանոցի սենյակների ցանկից
    const hotel = await Hotel.findById(room.hotel);
    if (hotel) {
      hotel.rooms.pull(room._id);
      await hotel.save();
    }

    res.json({ message: 'Սենյակը հաջողությամբ ջնջվել է' });
  } catch (error) {
    res.status(500).json({ message: 'Սերվերի սխալ' });
  }
};