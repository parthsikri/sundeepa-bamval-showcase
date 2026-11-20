const { createSeedDatabase } = require("./seedData");
const storage = require("./storage");

let cache = null;
let cacheTs = 0;
const CACHE_TTL_MS = 2000;

async function loadDB(forceFresh = false) {
  const driver = storage.getDriver();
  const isCloud = driver !== "local";

  if (!forceFresh && cache && (!isCloud || Date.now() - cacheTs < CACHE_TTL_MS)) {
    return cache;
  }

  const existing = await storage.readState();
  if (existing) {
    cache = existing;
    cacheTs = Date.now();
    return cache;
  }

  cache = createSeedDatabase();
  await saveDB(cache);
  return cache;
}

async function saveDB(data) {
  data.meta = data.meta || {};
  data.meta.updated = new Date().toISOString();
  cache = data;
  cacheTs = Date.now();
  await storage.writeState(data);
  return cache;
}

async function resetDB() {
  const fresh = createSeedDatabase();
  return saveDB(fresh);
}

async function uploadImage(file) {
  if (!file || !file.buffer) throw new Error("Invalid image upload");
  return storage.saveImage(file.buffer, file.originalname, file.mimetype);
}

async function deleteUploadedFile(urlPath) {
  return storage.deleteImage(urlPath);
}

module.exports = {
  UPLOADS_DIR: storage.UPLOADS_DIR,
  ensureDirs: storage.ensureLocalDirs,
  getStorageDriver: storage.getDriver,
  loadDB,
  saveDB,
  resetDB,
  uploadImage,
  deleteUploadedFile,
};
