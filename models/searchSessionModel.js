// models/searchSessionModel.js
import { randomUUID } from "crypto";

let redisClient = null;
const hasRedis = !!process.env.REDIS_URL;

if (hasRedis) {
  const { createClient } = await import("redis"); // safe ESM dynamic import
  redisClient = createClient({ url: process.env.REDIS_URL });
  redisClient.on("error", (e) => console.error("[redis] error:", e));
  try {
    await redisClient.connect();
  } catch (e) {
    console.error("[redis] connect failed", e);
  }
}

// dev fallback (process-scoped memory)
const mem = new Map(); // key: userId -> { ...spec, updatedAt }

const KEY = (userId) => `search-session:${userId}`;
const TTL_SECONDS = 3600; // 1 ժամ

const clamp = (n, min, max) => {
  n = Number(n ?? 0);
  if (!Number.isFinite(n)) n = 0;
  return Math.max(min, Math.min(max, n));
};

function canonGuests(spec) {
  const rooms = clamp(spec?.rooms ?? 1, 1, 9);
  const adultsCSV = String(spec?.adultsCSV ?? spec?.adults ?? "2");
  const childrenCSV = String(spec?.childrenCSV ?? spec?.children ?? "0");
  const childrenAgesCSV = String(spec?.childrenAgesCSV ?? spec?.childrenAges ?? "");

  const A = adultsCSV.split(",").map((x) => clamp(x, 1, 6));
  const C = childrenCSV.split(",").map((x) => clamp(x, 0, 6));

  const groups = childrenAgesCSV
    .split("|")
    .map((seg) =>
      String(seg || "")
        .split(",")
        .filter(Boolean)
        .map((x) => clamp(x, 0, 17))
    );

  const roomsArr = [];
  for (let i = 0; i < rooms; i++) {
    const a = A[i] ?? A[0] ?? 2;
    const c = C[i] ?? C[0] ?? 0;
    const ages = (groups[i] || []).slice(0, c);
    while (ages.length < c) ages.push(8);
    roomsArr.push({ adults: a, children: c, ages });
  }

  return {
    rooms,
    adultsCSV: roomsArr.map((r) => r.adults).join(","),
    childrenCSV: roomsArr.map((r) => r.children).join(","),
    childrenAgesCSV: roomsArr.map((r) => r.ages.join(",")).join("|"),
  };
}

function canonSession(input) {
  const checkInDate = String(input?.checkInDate || "").slice(0, 10);
  const checkOutDate = String(input?.checkOutDate || "").slice(0, 10);
  const cityCode = String(input?.cityCode || input?.cityId || "");
  const guests = canonGuests(input);

  const now = new Date().toISOString();
  const version = (Number(input?.version) || 0) + 1;

  return {
    id: randomUUID(), // տեղեկատվական
    cityCode,
    checkInDate,
    checkOutDate,
    ...guests,
    createdAt: now,
    updatedAt: now,
    version,
  };
}

export async function setForUser(userId, input) {
  const spec = canonSession(input);
  if (hasRedis && redisClient) {
    await redisClient.set(KEY(userId), JSON.stringify(spec), { EX: TTL_SECONDS });
  } else {
    mem.set(userId, spec);
  }
  return spec;
}

export async function getForUser(userId) {
  if (hasRedis && redisClient) {
    const raw = await redisClient.get(KEY(userId));
    return raw ? JSON.parse(raw) : null;
  } else {
    return mem.get(userId) || null;
  }
}

export async function delForUser(userId) {
  if (hasRedis && redisClient) {
    await redisClient.del(KEY(userId));
  } else {
    mem.delete(userId);
  }
  return true;
}