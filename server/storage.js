const fs = require("fs");
const path = require("path");
const os = require("os");
const crypto = require("crypto");

const IS_VERCEL = Boolean(process.env.VERCEL);
const BASE_LOCAL = IS_VERCEL ? path.join(os.tmpdir(), "sundeepa-bamval-studio") : __dirname;
const DATA_DIR = path.join(BASE_LOCAL, "data");
const UPLOADS_DIR = path.join(BASE_LOCAL, "uploads");
const DB_FILE = path.join(DATA_DIR, "collection.json");

const CLOUDINARY_FOLDER = process.env.CLOUDINARY_FOLDER || "sundeepa-bamval";
const CLOUDINARY_STATE_PUBLIC_ID = `${CLOUDINARY_FOLDER}/collection.json`;
const BLOB_STATE_KEY = "atelier-db/collection.json";

function hasCloudinaryConfig() {
  return Boolean(
    process.env.CLOUDINARY_CLOUD_NAME &&
      process.env.CLOUDINARY_API_KEY &&
      process.env.CLOUDINARY_API_SECRET
  );
}

function getDriver() {
  if (hasCloudinaryConfig()) return "cloudinary";
  if (process.env.BLOB_READ_WRITE_TOKEN) return "vercel-blob";
  return "local";
}

function safeExt(originalname = "") {
  const ext = path.extname(originalname).toLowerCase() || ".jpg";
  return [".jpg", ".jpeg", ".png", ".webp", ".gif", ".svg", ".avif"].includes(ext) ? ext : ".jpg";
}

function makeFilename(originalname) {
  return `${Date.now()}-${crypto.randomBytes(6).toString("hex")}${safeExt(originalname)}`;
}

function ensureLocalDirs() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// ==========================================================================
// Driver 1: Cloudinary (25 GB Free, No Credit Card, Never Pauses, Auto WebP)
// ==========================================================================

let cloudinaryInst = null;

function getCloudinary() {
  if (!cloudinaryInst) {
    const { v2 } = require("cloudinary");
    v2.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
      secure: true,
    });
    cloudinaryInst = v2;
  }
  return cloudinaryInst;
}

function uploadBufferToCloudinary(buffer, options) {
  const cld = getCloudinary();
  return new Promise((resolve, reject) => {
    const stream = cld.uploader.upload_stream(options, (err, result) => {
      if (err) return reject(err);
      resolve(result);
    });
    stream.end(buffer);
  });
}

async function cloudinaryReadJSON() {
  const cld = getCloudinary();
  try {
    // Admin API returns the exact latest versioned secure_url (never stale CDN cache)
    const info = await cld.api.resource(CLOUDINARY_STATE_PUBLIC_ID, { resource_type: "raw" });
    if (!info || !info.secure_url) return null;
    const res = await fetch(`${info.secure_url}?t=${Date.now()}`, { cache: "no-store" });
    if (!res.ok) return null;
    return res.json();
  } catch (err) {
    const status = err?.http_code || err?.error?.http_code;
    if (status === 404) return null;
    throw new Error(`Cloudinary read error: ${err?.message || err?.error?.message || "Unknown error"}`);
  }
}

async function cloudinaryWriteJSON(data) {
  const buf = Buffer.from(JSON.stringify(data), "utf8");
  await uploadBufferToCloudinary(buf, {
    public_id: CLOUDINARY_STATE_PUBLIC_ID,
    resource_type: "raw",
    overwrite: true,
    invalidate: true,
  });
}

async function cloudinaryUploadImage(buffer) {
  const result = await uploadBufferToCloudinary(buffer, {
    folder: `${CLOUDINARY_FOLDER}/uploads`,
    resource_type: "image",
    transformation: [{ quality: "auto:good", fetch_format: "auto" }],
  });
  return result.secure_url;
}

async function cloudinaryDeleteImage(url) {
  if (!url || !url.includes("res.cloudinary.com")) return;
  try {
    const marker = "/upload/";
    const idx = url.indexOf(marker);
    if (idx === -1) return;
    let tail = url.slice(idx + marker.length);
    // Strip optional transformation/version segments (e.g. v1795175000/)
    tail = tail.replace(/^(?:[a-z]_[^/]+\/)*v\d+\//, "");
    const publicId = tail.replace(/\.[^/.]+$/, "");
    if (!publicId) return;
    const cld = getCloudinary();
    await cld.uploader.destroy(publicId, { resource_type: "image" });
  } catch (err) {
    console.warn("Cloudinary delete warning:", err.message);
  }
}

// ==========================================================================
// Driver 2: Vercel Blob (1 GB Free, 1-Click in Vercel Dashboard)
// ==========================================================================

let vercelBlobMod = null;
function getVercelBlob() {
  if (!vercelBlobMod) vercelBlobMod = require("@vercel/blob");
  return vercelBlobMod;
}

async function blobReadJSON() {
  const { list } = getVercelBlob();
  const { blobs } = await list({ prefix: BLOB_STATE_KEY, limit: 1 });
  const match = blobs.find((b) => b.pathname === BLOB_STATE_KEY) || blobs[0];
  if (!match) return null;
  const res = await fetch(`${match.url}?t=${Date.now()}`, { cache: "no-store" });
  if (!res.ok) return null;
  return res.json();
}

async function blobWriteJSON(data) {
  const { put } = getVercelBlob();
  await put(BLOB_STATE_KEY, JSON.stringify(data), {
    access: "public",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json",
    cacheControlMaxAge: 0,
  });
}

async function blobUploadImage(buffer, originalname, mimetype) {
  const { put } = getVercelBlob();
  const filename = makeFilename(originalname);
  const blob = await put(`uploads/${filename}`, buffer, {
    access: "public",
    addRandomSuffix: false,
    contentType: mimetype || "image/jpeg",
    cacheControlMaxAge: 31536000,
  });
  return blob.url;
}

async function blobDeleteImage(url) {
  if (!url || !url.includes("blob.vercel-storage.com")) return;
  try {
    const { del } = getVercelBlob();
    await del(url);
  } catch (err) {
    console.warn("Vercel Blob delete warning:", err.message);
  }
}

// ==========================================================================
// Driver 3: Local Filesystem (Default for Local Development)
// ==========================================================================

async function localReadJSON() {
  ensureLocalDirs();
  if (!fs.existsSync(DB_FILE)) return null;
  try {
    return JSON.parse(fs.readFileSync(DB_FILE, "utf8"));
  } catch {
    return null;
  }
}

async function localWriteJSON(data) {
  ensureLocalDirs();
  const tmpFile = `${DB_FILE}.tmp`;
  fs.writeFileSync(tmpFile, JSON.stringify(data, null, 2), "utf8");
  fs.renameSync(tmpFile, DB_FILE);
}

async function localUploadImage(buffer, originalname) {
  ensureLocalDirs();
  const filename = makeFilename(originalname);
  fs.writeFileSync(path.join(UPLOADS_DIR, filename), buffer);
  return `/uploads/${filename}`;
}

async function localDeleteImage(url) {
  if (!url || typeof url !== "string" || !url.startsWith("/uploads/")) return;
  const fullPath = path.join(UPLOADS_DIR, path.basename(url));
  if (fs.existsSync(fullPath)) {
    try {
      fs.unlinkSync(fullPath);
    } catch (err) {
      console.warn("Local delete warning:", err.message);
    }
  }
}

// ==========================================================================
// Unified Exported Interface
// ==========================================================================

async function readState() {
  const driver = getDriver();
  if (driver === "cloudinary") return cloudinaryReadJSON();
  if (driver === "vercel-blob") return blobReadJSON();
  return localReadJSON();
}

async function writeState(data) {
  const driver = getDriver();
  if (driver === "cloudinary") return cloudinaryWriteJSON(data);
  if (driver === "vercel-blob") return blobWriteJSON(data);
  return localWriteJSON(data);
}

async function saveImage(buffer, originalname, mimetype) {
  const driver = getDriver();
  if (driver === "cloudinary") return cloudinaryUploadImage(buffer);
  if (driver === "vercel-blob") return blobUploadImage(buffer, originalname, mimetype);
  return localUploadImage(buffer, originalname);
}

async function deleteImage(url) {
  if (!url) return;
  const driver = getDriver();
  if (driver === "cloudinary") return cloudinaryDeleteImage(url);
  if (driver === "vercel-blob") return blobDeleteImage(url);
  return localDeleteImage(url);
}

module.exports = {
  getDriver,
  UPLOADS_DIR,
  ensureLocalDirs,
  readState,
  writeState,
  saveImage,
  deleteImage,
};
