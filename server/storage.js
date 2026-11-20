const fs = require("fs");
const path = require("path");
const os = require("os");
const crypto = require("crypto");

const IS_VERCEL = Boolean(process.env.VERCEL);
const BASE_LOCAL = IS_VERCEL ? path.join(os.tmpdir(), "sundeepa-bamval-studio") : __dirname;
const DATA_DIR = path.join(BASE_LOCAL, "data");
const UPLOADS_DIR = path.join(BASE_LOCAL, "uploads");
const DB_FILE = path.join(DATA_DIR, "collection.json");

const STATE_KEY = "atelier-db/collection.json";

function hasR2Config() {
  return Boolean(
    process.env.R2_ACCOUNT_ID &&
      process.env.R2_ACCESS_KEY_ID &&
      process.env.R2_SECRET_ACCESS_KEY &&
      process.env.R2_BUCKET
  );
}

function getDriver() {
  if (hasR2Config()) return "cloudflare-r2";
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
// Driver 1: Cloudflare R2 (10 GB Free, Unlimited Egress, Never Pauses)
// ==========================================================================

let r2Client = null;
let s3Mod = null;

function getR2() {
  if (!s3Mod) s3Mod = require("@aws-sdk/client-s3");
  if (!r2Client) {
    const { S3Client } = s3Mod;
    r2Client = new S3Client({
      region: "auto",
      endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
      },
    });
  }
  return { client: r2Client, ...s3Mod };
}

function r2PublicBase() {
  return String(process.env.R2_PUBLIC_URL || "").replace(/\/+$/, "");
}

async function r2ReadJSON() {
  const { client, GetObjectCommand } = getR2();
  try {
    const res = await client.send(
      new GetObjectCommand({
        Bucket: process.env.R2_BUCKET,
        Key: STATE_KEY,
      })
    );
    const text = await res.Body.transformToString("utf8");
    return JSON.parse(text);
  } catch (err) {
    if (err?.name === "NoSuchKey" || err?.$metadata?.httpStatusCode === 404) {
      return null;
    }
    throw new Error(`Cloudflare R2 read error: ${err.message}`);
  }
}

async function r2WriteJSON(data) {
  const { client, PutObjectCommand } = getR2();
  await client.send(
    new PutObjectCommand({
      Bucket: process.env.R2_BUCKET,
      Key: STATE_KEY,
      Body: JSON.stringify(data),
      ContentType: "application/json; charset=utf-8",
      CacheControl: "no-store",
    })
  );
}

async function r2UploadImage(buffer, originalname, mimetype) {
  const { client, PutObjectCommand } = getR2();
  const filename = makeFilename(originalname);
  const key = `uploads/${filename}`;
  await client.send(
    new PutObjectCommand({
      Bucket: process.env.R2_BUCKET,
      Key: key,
      Body: buffer,
      ContentType: mimetype || "image/jpeg",
      CacheControl: "public, max-age=31536000, immutable",
    })
  );
  const pubBase = r2PublicBase();
  return pubBase ? `${pubBase}/${key}` : `/uploads/${filename}`;
}

async function r2ReadImage(filename) {
  const { client, GetObjectCommand } = getR2();
  const key = `uploads/${path.basename(filename)}`;
  const res = await client.send(
    new GetObjectCommand({
      Bucket: process.env.R2_BUCKET,
      Key: key,
    })
  );
  const bytes = await res.Body.transformToByteArray();
  return {
    buffer: Buffer.from(bytes),
    contentType: res.ContentType || "image/jpeg",
  };
}

async function r2DeleteImage(url) {
  if (!url) return;
  let key = "";
  const pubBase = r2PublicBase();
  if (pubBase && url.startsWith(`${pubBase}/`)) {
    key = url.slice(pubBase.length + 1);
  } else if (url.startsWith("/uploads/")) {
    key = `uploads/${path.basename(url)}`;
  }
  if (!key) return;
  try {
    const { client, DeleteObjectCommand } = getR2();
    await client.send(
      new DeleteObjectCommand({
        Bucket: process.env.R2_BUCKET,
        Key: key,
      })
    );
  } catch (err) {
    console.warn("Cloudflare R2 delete warning:", err.message);
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
  const { blobs } = await list({ prefix: STATE_KEY, limit: 1 });
  const match = blobs.find((b) => b.pathname === STATE_KEY) || blobs[0];
  if (!match) return null;
  const res = await fetch(`${match.url}?t=${Date.now()}`, { cache: "no-store" });
  if (!res.ok) return null;
  return res.json();
}

async function blobWriteJSON(data) {
  const { put } = getVercelBlob();
  await put(STATE_KEY, JSON.stringify(data), {
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
  if (driver === "cloudflare-r2") return r2ReadJSON();
  if (driver === "vercel-blob") return blobReadJSON();
  return localReadJSON();
}

async function writeState(data) {
  const driver = getDriver();
  if (driver === "cloudflare-r2") return r2WriteJSON(data);
  if (driver === "vercel-blob") return blobWriteJSON(data);
  return localWriteJSON(data);
}

async function saveImage(buffer, originalname, mimetype) {
  const driver = getDriver();
  if (driver === "cloudflare-r2") return r2UploadImage(buffer, originalname, mimetype);
  if (driver === "vercel-blob") return blobUploadImage(buffer, originalname, mimetype);
  return localUploadImage(buffer, originalname);
}

async function deleteImage(url) {
  if (!url) return;
  const driver = getDriver();
  if (driver === "cloudflare-r2") return r2DeleteImage(url);
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
  r2ReadImage,
};
