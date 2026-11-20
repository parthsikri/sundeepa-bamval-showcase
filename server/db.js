const fs = require("fs");
const path = require("path");
const os = require("os");
const { createSeedDatabase } = require("./seedData");

const IS_VERCEL = Boolean(process.env.VERCEL);
const BASE_STORAGE = IS_VERCEL ? path.join(os.tmpdir(), "sundeepa-bamval-studio") : __dirname;

const DATA_DIR = path.join(BASE_STORAGE, "data");
const UPLOADS_DIR = path.join(BASE_STORAGE, "uploads");
const DB_FILE = path.join(DATA_DIR, "collection.json");

function ensureDirs() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

let cache = null;

function loadDB() {
  ensureDirs();
  if (cache) return cache;
  if (fs.existsSync(DB_FILE)) {
    try {
      const raw = fs.readFileSync(DB_FILE, "utf8");
      cache = JSON.parse(raw);
      return cache;
    } catch (err) {
      console.error("Failed to parse existing DB, recreating clean state:", err.message);
    }
  }
  cache = createSeedDatabase();
  saveDB(cache);
  return cache;
}

function saveDB(data) {
  ensureDirs();
  data.meta = data.meta || {};
  data.meta.updated = new Date().toISOString();
  cache = data;
  const tmpFile = `${DB_FILE}.tmp`;
  fs.writeFileSync(tmpFile, JSON.stringify(data, null, 2), "utf8");
  fs.renameSync(tmpFile, DB_FILE);
  return cache;
}

function resetDB() {
  const fresh = createSeedDatabase();
  return saveDB(fresh);
}

function deleteUploadedFile(urlPath) {
  if (!urlPath || typeof urlPath !== "string" || !urlPath.startsWith("/uploads/")) return;
  const filename = path.basename(urlPath);
  const fullPath = path.join(UPLOADS_DIR, filename);
  if (fs.existsSync(fullPath)) {
    try {
      fs.unlinkSync(fullPath);
    } catch (err) {
      console.warn("Could not remove file:", fullPath, err.message);
    }
  }
}

module.exports = {
  IS_VERCEL,
  DATA_DIR,
  UPLOADS_DIR,
  DB_FILE,
  ensureDirs,
  loadDB,
  saveDB,
  resetDB,
  deleteUploadedFile,
};
