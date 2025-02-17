// controllers/hotelController.js

const Hotel = require('../models/Hotel');

// Ստանալ բոլոր հյուրանոցները
exports.getAllHotels = async (req, res) => {
  try {
    const hotels = await Hotel.find();
    res.json(hotels);
  } catch (error) {
    res.status(500).json({ message: 'Սերվերի սխալ' });
  }
};

// Ստանալ կոնկրետ հյուրանոց ըստ ID-ի
exports.getHotelById = async (req, res) => {
  try {
    const hotel = await Hotel.findById(req.params.id);
    if (!hotel) {
      return res.status(404).json({ message: 'Հյուրանոցը չի գտնվել' });
    }
    res.json(hotel);
  } catch (error) {
    res.status(500).json({ message: 'Սերվերի սխալ' });
  }
};

// Ավելացնել նոր հյուրանոց
exports.createHotel = async (req, res) => {
  const { name, location, description, stars, amenities } = req.body;

  try {
    const newHotel = new Hotel({
      name,
      location,
      description,
      stars,
      amenities,
    });

    await newHotel.save();

    res.status(201).json(newHotel);
  } catch (error) {
    res.status(500).json({ message: 'Սերվերի սխալ' });
  }
};

// Թարմացնել հյուրանոց
exports.updateHotel = async (req, res) => {
  const { name, location, description, stars, amenities } = req.body;

  try {
    const hotel = await Hotel.findById(req.params.id);
    if (!hotel) {
      return res.status(404).json({ message: 'Հյուրանոցը չի գտնվել' });
    }

    hotel.name = name || hotel.name;
    hotel.location = location || hotel.location;
    hotel.description = description || hotel.description;
    hotel.stars = stars || hotel.stars;
    hotel.amenities = amenities || hotel.amenities;

    await hotel.save();

    res.json(hotel);
  } catch (error) {
    res.status(500).json({ message: 'Սերվերի սխալ' });
  }
};

// Ջնջել հյուրանոց
exports.deleteHotel = async (req, res) => {
  try {
    const hotel = await Hotel.findById(req.params.id);
    if (!hotel) {
      return res.status(404).json({ message: 'Հյուրանոցը չի գտնվել' });
    }

    await hotel.remove();

    res.json({ message: 'Հյուրանոցը հաջողությամբ ջնջվել է' });
  } catch (error) {
    res.status(500).json({ message: 'Սերվերի սխալ' });
  }
};