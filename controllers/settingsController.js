import axios from "axios";
import GlobalSettings from "../models/GlobalSettings.js";
import User from "../models/User.js";

// ✅ Public settings ըստ role-ի
export async function getPublicSettings(req, res) {
  try {
    const settings = await GlobalSettings.findOne({});
    if (!settings)
      return res.status(404).json({ error: "GlobalSettings not found" });

    let markup = 0;

    if (req.user.role === "b2c") {
      markup = settings.b2cMarkupPercentage ?? 0;
    } else if (req.user.role === "office_user") {
      markup = settings.officeMarkupPercentage ?? 0;
    } else if (req.user.role === "b2b_sales_partner") {
      const currentUser = await User.findById(req.user.id).select(
        "markupPercentage"
      );
      markup = currentUser?.markupPercentage ?? 0;
    } else {
      markup = 0; // Admin/Finance or unknown role → default 0
    }

    return res.json({
      exchangeRates: settings.exchangeRates,
      markup,
    });
  } catch (err) {
    console.error("getPublicSettings error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}

// Մնացած ֆունկցիաները մնում են անփոփոխ
export async function getGlobalSettings(req, res) {
  try {
    const settings = await GlobalSettings.findOne({});
    if (!settings)
      return res.status(404).json({ error: "GlobalSettings not found" });
    res.json(settings);
  } catch (err) {
    console.error("getGlobalSettings error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}

export async function updateGlobalSettings(req, res) {
  try {
    const { mode, rates, b2cMarkupPercentage, officeMarkupPercentage } =
      req.body;
    let newRates = {};

    if (mode === "auto") {
      const resp = await axios.get("https://cb.am/latest.json.php");
      const data = resp.data;
      newRates = {
        AMD: 1,
        USD: parseFloat(data["USD"]) + parseFloat(process.env.USD_DIFF || 0),
        EUR: parseFloat(data["EUR"]) + parseFloat(process.env.EUR_DIFF || 0),
        RUB: parseFloat(data["RUB"]) + parseFloat(process.env.RUB_DIFF || 0),
      };
    } else {
      if (typeof rates.USD !== "number" || typeof rates.EUR !== "number") {
        return res.status(400).json({ message: "Rates missing or invalid" });
      }
      newRates = {
        AMD: 1,
        USD: rates.USD,
        EUR: rates.EUR,
        RUB: rates.RUB,
      };
    }

    const updated = await GlobalSettings.findOneAndUpdate(
      {},
      {
        exchangeRates: newRates,
        b2cMarkupPercentage,
        officeMarkupPercentage,
      },
      { new: true, runValidators: true, context: "query" }
    );

    if (!updated)
      return res.status(404).json({ message: "GlobalSettings not found" });
    return res.json(updated);
  } catch (err) {
    console.error("updateGlobalSettings error:", err);
    if (err.name === "ValidationError") {
      return res.status(400).json({ error: "Validation", details: err.errors });
    }
    res.status(500).json({ error: err.message });
  }
}
