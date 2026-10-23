const express = require("express");
const crypto = require("crypto");
const app = express();
app.use(express.json({ limit: "256kb" }));
app.use(express.urlencoded({ extended: true, limit: "256kb" }));
app.use(express.static("public"));

const PORT = process.env.PORT || 10000;
const WEBHOOK_PATH_SECRET = process.env.WEBHOOK_PATH_SECRET || "";
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || "";
let queue = [];
let nextId = 1;
const seen = new Set();

function flattenStrings(value, out = [], depth = 0) {
  if (depth > 5 || value == null) return out;
  if (typeof value === "string" || typeof value === "number") {
    out.push(String(value));
  } else if (Array.isArray(value)) {
    for (const v of value) flattenStrings(v, out, depth + 1);
  } else if (typeof value === "object") {
    for (const [k, v] of Object.entries(value)) {
      // Keep keys with their values, since providers name message fields differently.
      if (typeof v === "string" || typeof v === "number") out.push(`${k}: ${v}`);
      else flattenStrings(v, out, depth + 1);
    }
  }
  return out;
}
function getStringDeep(obj, names) {
  if (!obj || typeof obj !== "object") return "";
  for (const [k, v] of Object.entries(obj)) {
    if (names.includes(k.toLowerCase()) && (typeof v === "string" || typeof v === "number")) return String(v).trim();
  }
  for (const v of Object.values(obj)) {
    if (v && typeof v === "object") {
      const found = getStringDeep(v, names);
      if (found) return found;
    }
  }
  return "";
}
function parseNickAndId(payload) {
  const msg = getStringDeep(payload, ["message", "note", "comment", "donation_message", "custom_message", "supporter_message", "pesan"]);
  const source = msg || flattenStrings(payload).join("\n");
  const nickMatch = source.match(/(?:NICK|NICKNAME)\s*[:=]\s*([^|\n,;]+)/i);
  const idMatch = source.match(/(?:ID(?:\s*FF)?|PLAYER\s*ID)\s*[:=]\s*([0-9]{5,20})/i);
  if (!nickMatch || !idMatch) return null;
  const nickname = nickMatch[1].trim().slice(0, 30);
  const playerId = idMatch[1].trim();
  if (!nickname || !/^[0-9]{5,20}$/.test(playerId)) return null;
  return { nickname, playerId, message: msg };
}
function donationKey(payload) {
  return getStringDeep(payload, ["id", "donation_id", "transaction_id", "payment_id", "event_id"]) ||
    crypto.createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}
function isProbablyDonation(payload) {
  const str = flattenStrings(payload).join(" ").toLowerCase();
  // Test events may not identify themselves as donations; accept them if they contain a valid NICK + ID format.
  return !/(?:status|payment_status)\s*[:=]\s*(?:failed|cancelled|canceled|pending)/i.test(str);
}
function addPlayer(data, origin) {
  const item = { id: nextId++, nickname: data.nickname, playerId: data.playerId, origin, createdAt: new Date().toISOString() };
  queue.push(item);
  return item;
}
function adminOnly(req, res, next) {
  const token = req.get("x-admin-token") || req.query.token || "";
  if (!ADMIN_TOKEN || token !== ADMIN_TOKEN) return res.status(401).json({ error: "Admin token salah atau belum disetel." });
  next();
}
app.get("/health", (_req, res) => res.json({ ok: true }));
app.get("/api/queue", (_req, res) => res.json({ queue }));
app.post("/webhook/:secret", (req, res) => {
  if (!WEBHOOK_PATH_SECRET || req.params.secret !== WEBHOOK_PATH_SECRET) return res.status(404).json({ error: "Not found" });
  const payload = req.body || {};
  const key = donationKey(payload);
  if (seen.has(key)) return res.status(200).json({ ok: true, duplicate: true });
  if (!isProbablyDonation(payload)) return res.status(200).json({ ok: true, ignored: true });
  const parsed = parseNickAndId(payload);
  if (!parsed) {
    console.log("Webhook diterima tetapi format NICK/ID tidak terbaca. Payload keys:", Object.keys(payload || {}));
    return res.status(200).json({ ok: true, queued: false, reason: "Nickname/ID tidak terbaca. Periksa format pesan dan payload provider." });
  }
  seen.add(key);
  const item = addPlayer(parsed, "SociaBuzz");
  console.log("Pemain antrean baru:", item.nickname, item.playerId);
  return res.status(200).json({ ok: true, queued: true, number: item.id });
});
app.post("/api/admin/add", adminOnly, (req, res) => {
  const nickname = String(req.body.nickname || "").trim().slice(0, 30);
  const playerId = String(req.body.playerId || "").trim();
  if (!nickname || !/^[0-9]{5,20}$/.test(playerId)) return res.status(400).json({ error: "Isi nickname dan ID FF (5–20 digit)." });
  return res.json({ ok: true, player: addPlayer({ nickname, playerId }, "Admin") });
});
app.post("/api/admin/remove/:id", adminOnly, (req, res) => {
  const id = Number(req.params.id);
  queue = queue.filter(p => p.id !== id);
  res.json({ ok: true, queue });
});
app.post("/api/admin/clear", adminOnly, (_req, res) => { queue = []; res.json({ ok: true }); });
app.listen(PORT, "0.0.0.0", () => console.log(`FF queue server listening on ${PORT}`));
