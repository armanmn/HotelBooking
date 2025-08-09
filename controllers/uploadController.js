// uploadController.js

export const uploadOfferImage = async (req, res) => {
  try {
    const filePath = req.file.path;

    const result = await cloudinary.uploader.upload(filePath, {
      folder: "offers",
    });

    fs.unlinkSync(filePath); // delete temp file

    res.status(200).json({
      url: result.secure_url,
      public_id: result.public_id,
    });
  } catch (error) {
    res.status(500).json({ error: "Upload failed", details: error.message });
  }
};