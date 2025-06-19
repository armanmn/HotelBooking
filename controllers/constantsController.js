export const getRoomTypes = (req, res) => {
  const ROOM_TYPES = [
    "Standard Single",
    "Standard Double",
    "Twin Room",
    "Deluxe Room",
    "Suite",
    "Family Room",
    "Presidential Suite",
  ];
  res.json(ROOM_TYPES);
};