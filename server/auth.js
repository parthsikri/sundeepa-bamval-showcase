const crypto = require("crypto");

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "atelier2026";
const TOKEN_SECRET = process.env.TOKEN_SECRET || crypto.createHash("sha256").update(`atelier-secret:${ADMIN_PASSWORD}`).digest("hex");
const TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function safeEqual(a, b) {
  const bufA = Buffer.from(String(a || ""), "utf8");
  const bufB = Buffer.from(String(b || ""), "utf8");
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

function verifyPassword(input) {
  return safeEqual(input, ADMIN_PASSWORD);
}

function issueToken() {
  const payload = Buffer.from(JSON.stringify({ role: "admin", exp: Date.now() + TOKEN_TTL_MS })).toString("base64url");
  const sig = crypto.createHmac("sha256", TOKEN_SECRET).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

function verifyToken(token) {
  if (!token || typeof token !== "string" || !token.includes(".")) return false;
  const [payload, sig] = token.split(".");
  const expected = crypto.createHmac("sha256", TOKEN_SECRET).update(payload).digest("base64url");
  if (!safeEqual(sig, expected)) return false;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    return data.role === "admin" && typeof data.exp === "number" && data.exp > Date.now();
  } catch {
    return false;
  }
}

function extractToken(req) {
  const auth = req.headers.authorization || "";
  if (auth.startsWith("Bearer ")) return auth.slice(7).trim();
  return req.headers["x-admin-token"] || "";
}

function requireAdmin(req, res, next) {
  const token = extractToken(req);
  if (!verifyToken(token)) {
    return res.status(401).json({ error: "Admin authentication required" });
  }
  next();
}

module.exports = {
  ADMIN_PASSWORD,
  verifyPassword,
  issueToken,
  verifyToken,
  extractToken,
  requireAdmin,
};
