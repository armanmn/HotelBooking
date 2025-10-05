// controllers/searchSessionController.js
import { setForUser, getForUser, delForUser } from "../models/searchSessionModel.js";

// Օգտագործիր քո auth middleware-ը՝ որ լցնի req.user.id
function getUserId(req) {
  return req.user?.id || req.auth?.id || req.headers["x-mock-user"] || null;
}

export const getCurrent = async (req, res) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: "unauthorized" });

  const spec = await getForUser(userId);
  if (!spec) return res.status(404).json({ error: "not_found" });
  return res.json(spec);
};

export const upsert = async (req, res) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: "unauthorized" });

  const spec = await setForUser(userId, req.body || {});
  return res.json(spec);
};

export const clear = async (req, res) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: "unauthorized" });

  await delForUser(userId);
  return res.json({ ok: true });
};