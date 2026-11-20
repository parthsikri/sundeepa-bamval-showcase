const fs = require("fs");
const path = require("path");
const os = require("os");
const crypto = require("crypto");

const IS_VERCEL = Boolean(process.env.VERCEL);
const BASE_LOCAL = IS_VERCEL ? path.join(os.tmpdir(), "sundeepa-bamval-studio") : __dirname;
const DATA_DIR = path.join(BASE_LOCAL, "data");
const UPLOADS_DIR = path.join(BASE_LOCAL, "uploads");
const DB_FILE = path.join(DATA_DIR, "collection.json");

const BLOB_STATE_PATH = "atelier-db/collection.json";
const SUPABASE_TABLE = "atelier_state";
const SUPABASE_BUCKET = process.env.SUPABASE_BUCKET || "atelier-uploads";

function getDriver() {
  if (process.env.BLOB_READ_WRITE_TOKEN) return "vercel-blob";
  if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) return "supabase";
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
// Driver 1: Vercel Blob (Recommended — Never Pauses, 1-Click in Vercel)
// ==========================================================================

let vercelBlobMod = null;
function getVercelBlob() {
  if (!vercelBlobMod) vercelBlobMod = require("@vercel/blob");
  return vercelBlobMod;
}

async function blobReadJSON() {
  const { list } = getVercelBlob();
  const { blobs } = await list({ prefix: BLOB_STATE_PATH, limit: 1 });
  const match = blobs.find((b) => b.pathname === BLOB_STATE_PATH) || blobs[0];
  if (!match) return null;
  const res = await fetch(`${match.url}?t=${Date.now()}`, { cache: "no-store" });
  if (!res.ok) return null;
  return res.json();
}

async function blobWriteJSON(data) {
  const { put } = getVercelBlob();
  await put(BLOB_STATE_PATH, JSON.stringify(data), {
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
// Driver 2: Supabase (Postgres + Storage Bucket)
// ==========================================================================

let supabaseClient = null;
function getSupabase() {
  if (!supabaseClient) {
    const { createClient } = require("@supabase/supabase-js");
    supabaseClient = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return supabaseClient;
}

async function supabaseReadJSON() {
  const sb = getSupabase();
  const { data, error } = await sb.from(SUPABASE_TABLE).select("data").eq("id", "main").maybeSingle();
  if (error) throw new Error(`Supabase read error: ${error.message}`);
  return data ? data.data : null;
}

async function supabaseWriteJSON(payload) {
  const sb = getSupabase();
  const { error } = await sb.from(SUPABASE_TABLE).upsert(
    {
      id: "main",
      data: payload,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" }
  );
  if (error) throw new Error(`Supabase write error: ${error.message}`);
}

async function supabaseUploadImage(buffer, originalname, mimetype) {
  const sb = getSupabase();
  const filename = makeFilename(originalname);
  const storagePath = `designs/${filename}`;
  const { error } = await sb.storage.from(SUPABASE_BUCKET).upload(storagePath, buffer, {
    contentType: mimetype || "image/jpeg",
    upsert: false,
  });
  if (error) throw new Error(`Supabase image upload failed: ${error.message}`);
  const { data } = sb.storage.from(SUPABASE_BUCKET).getPublicUrl(storagePath);
  return data.publicUrl;
}

async function supabaseDeleteImage(url) {
  if (!url || !url.includes(`/storage/v1/object/public/${SUPABASE_BUCKET}/`)) return;
  try {
    const sb = getSupabase();
    const marker = `/storage/v1/object/public/${SUPABASE_BUCKET}/`;
    const storagePath = decodeURIComponent(url.split(marker)[1] || "");
    if (storagePath) {
      await sb.storage.from(SUPABASE_BUCKET).remove([storagePath]);
    }
  } catch (err) {
    console.warn("Supabase image delete warning:", err.message);
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
  if (driver === "vercel-blob") return blobReadJSON();
  if (driver === "supabase") return supabaseReadJSON();
  return localReadJSON();
}

async function writeState(data) {
  const driver = getDriver();
  if (driver === "vercel-blob") return blobWriteJSON(data);
  if (driver === "supabase") return supabaseWriteJSON(data);
  return localWriteJSON(data);
}

async function saveImage(buffer, originalname, mimetype) {
  const driver = getDriver();
  if (driver === "vercel-blob") return blobUploadImage(buffer, originalname, mimetype);
  if (driver === "supabase") return supabaseUploadImage(buffer, originalname, mimetype);
  return localUploadImage(buffer, originalname);
}

async function deleteImage(url) {
  if (!url) return;
  const driver = getDriver();
  if (driver === "vercel-blob") return blobDeleteImage(url);
  if (driver === "supabase") return supabaseDeleteImage(url);
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
