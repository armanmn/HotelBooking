// controllers/settingsController.js
import GlobalSettings from "../models/GlobalSettings.js";
import User from "../models/User.js";
import {
  ensureFreshRates,
  fetchAndUpdateRates,
} from "../services/exchange/refresh.js";

// ✅ Public settings ըստ role-ի (lazy refresh)
export async function getPublicSettings(req, res) {
  try {
    const gs = await ensureFreshRates(); // ավտոմատ թարմացում, եթե TTL-ը անցել է
    if (!gs) return res.status(404).json({ error: "GlobalSettings not found" });

    let markup = 0;
    const role = String(req.user?.role || "").toLowerCase();

    if (role === "b2c") {
      markup = gs.b2cMarkupPercentage ?? 0;
    } else if (role === "office_user") {
      markup = gs.officeMarkupPercentage ?? 0;
    } else if (role === "b2b_sales_partner") {
      const u = await User.findById(req.user.id).select("markupPercentage");
      markup = u?.markupPercentage ?? 0;
    } // admin/finance → 0

    return res.json({
      exchangeRates: gs.exchangeRates,
      exchangeMode: gs.exchangeMode,
      lastRatesUpdateAt: gs.lastRatesUpdateAt,
      ratesSource: gs.ratesSource,
      defaultCurrency: "AMD", // FE init-ի համար
      markup,
    });
  } catch (err) {
    console.error("getPublicSettings error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}

// ✅ Full admin view (lazy refresh)
export async function getGlobalSettings(req, res) {
  try {
    const gs = await ensureFreshRates();
    if (!gs) return res.status(404).json({ error: "GlobalSettings not found" });
    res.json(gs);
  } catch (err) {
    console.error("getGlobalSettings error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}

// ✅ Update (auto/manual) + markup
export async function updateGlobalSettings(req, res) {
  try {
    const { mode, rates, b2cMarkupPercentage, officeMarkupPercentage } = req.body;

    // always have a doc
    let gs = await GlobalSettings.findOne({});
    if (!gs) gs = await GlobalSettings.create({});

    // update markups if provided
    if (typeof b2cMarkupPercentage === "number") {
      gs.b2cMarkupPercentage = b2cMarkupPercentage;
    }
    if (typeof officeMarkupPercentage === "number") {
      gs.officeMarkupPercentage = officeMarkupPercentage;
    }

    if (mode === "manual") {
      // manual validation: բոլոր արժեքները > 0 թվեր
      const manual = {
        AMD: 1,
        USD: Number(rates?.USD),
        EUR: Number(rates?.EUR),
        RUB: Number(rates?.RUB),
        GBP: Number(rates?.GBP),
      };
      const ok = Object.values(manual).every(
        (v) => Number.isFinite(v) && v > 0
      );
      if (!ok) {
        return res.status(400).json({ message: "Rates missing or invalid" });
      }
      gs.exchangeMode = "manual";
      gs.exchangeRates = manual;
      gs.lastRatesUpdateAt = new Date();
      gs.ratesSource = "manual";
      await gs.save();
      return res.json(gs);
    }

    // mode === "auto" → կենտրոնացված ու անվտանգ թարմացում
    await fetchAndUpdateRates(); // ներսում՝ fetch, diffs, drift guard, save
    const refreshed = await GlobalSettings.findOne({});
    if (!refreshed) return res.status(404).json({ error: "GlobalSettings not found" });
    refreshed.exchangeMode = "auto"; // ensure
    await refreshed.save();
    return res.json(refreshed);
  } catch (err) {
    console.error("updateGlobalSettings error:", err);
    if (err.name === "ValidationError") {
      return res.status(400).json({ error: "Validation", details: err.errors });
    }
    res.status(500).json({ error: err.message });
  }
}

// 🧰 Optional: ձեռքով refresh endpoint (Admin/Finance)
export async function refreshExchangeRates(req, res) {
  try {
    const force = String(req.query.force || "").toLowerCase() === "true";
    const updated = await fetchAndUpdateRates({ force });
    if (!updated) return res.status(503).json({ error: "Refresh failed; old rates kept" });
    res.json(updated);
  } catch (err) {
    console.error("refreshExchangeRates error:", err);
    res.status(500).json({ error: err.message });
  }
}