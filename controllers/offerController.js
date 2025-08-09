import Offer from "../models/Offer.js";
import Hotel from "../models/Hotel.js";

// ➕ Create a new offer
export const createOffer = async (req, res) => {
  try {
    const offer = await Offer.create(req.body);
    res.status(201).json(offer);
  } catch (err) {
    res.status(500).json({ error: "Failed to create offer", details: err.message });
  }
};

// 🔄 Update an existing offer
export const updateOffer = async (req, res) => {
  try {
    const updated = await Offer.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!updated) return res.status(404).json({ error: "Offer not found" });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: "Failed to update offer", details: err.message });
  }
};

// 🔍 Get all offers for a hotel
export const getOffersByHotelId = async (req, res) => {
  try {
    const hotelId = req.params.hotelId;
    const offers = await Offer.find({ hotel: hotelId });
    res.json(offers);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch offers", details: err.message });
  }
};

// 🔍 Get a single offer
export const getOfferById = async (req, res) => {
  try {
    const offer = await Offer.findById(req.params.id);
    if (!offer) return res.status(404).json({ error: "Offer not found" });
    res.json(offer);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch offer", details: err.message });
  }
};

// ❌ Delete an offer
export const deleteOffer = async (req, res) => {
  try {
    const deleted = await Offer.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ error: "Offer not found" });
    res.json({ message: "Offer deleted" });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete offer", details: err.message });
  }
};