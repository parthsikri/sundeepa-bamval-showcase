const express = require("express");
const multer = require("multer");
const { loadDB, saveDB, resetDB, uploadImage, deleteUploadedFile, getStorageDriver } = require("../db");
const { verifyPassword, issueToken, verifyToken, extractToken, requireAdmin } = require("../auth");
const {
  SIZE_SETS,
  SETNAME,
  SIZE_CURVE,
  SHOTS,
  SAMPLE_ST,
  TIERS,
  TRIM_ROWS,
  PROC_ROWS,
  uid,
  codeFor,
  buildQtyForCurve,
  emptyCost,
  nameFromFilename,
} = require("../seedData");

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024, files: 100 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype && file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Only image files are allowed"));
    }
  },
});

const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

function num(v) {
  const n = Number(String(v ?? "").replace(/,/g, "").trim());
  return Number.isFinite(n) ? n : 0;
}

function dTotal(d) {
  return Object.values(d.qty || {}).reduce((a, b) => a + num(b), 0);
}

function dSkus(d) {
  const liveSizes = Object.values(d.qty || {}).filter((v) => num(v) > 0).length;
  return liveSizes * Math.max(1, num(d.colours) || 1);
}

function csvEscape(val) {
  const s = String(val ?? "");
  if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function deepMerge(target, source) {
  if (!source || typeof source !== "object" || Array.isArray(source)) return source;
  const out = { ...(target && typeof target === "object" ? target : {}) };
  for (const [k, v] of Object.entries(source)) {
    if (v && typeof v === "object" && !Array.isArray(v)) {
      out[k] = deepMerge(out[k], v);
    } else {
      out[k] = v;
    }
  }
  return out;
}

function ensureCategory(db, catName, sizeSet = "top") {
  const clean = String(catName || "").trim();
  if (!clean) return "";
  db.categories = db.categories || [];
  let found = db.categories.find((c) => c.name.toLowerCase() === clean.toLowerCase());
  if (!found) {
    found = {
      id: uid("cat"),
      name: clean,
      sizeSet: SIZE_SETS[sizeSet] ? sizeSet : "top",
      role: "",
    };
    db.categories.push(found);
  }
  return found.name;
}

function buildDesignRecord(db, body = {}, imageUrl = "") {
  const catName = ensureCategory(db, body.cat || "", body.sizeSet || "top");
  const catObj = (db.categories || []).find((c) => c.name === catName);
  const existingInCat = db.designs.filter((d) => (d.cat || "") === catName).length;
  const sizeSet = SIZE_SETS[body.sizeSet] ? body.sizeSet : catObj?.sizeSet || "top";
  const defaultPieces = num(body.pieces) > 0 ? num(body.pieces) : 0;

  const shots = {};
  if (imageUrl) shots["Reference"] = imageUrl;

  return {
    id: uid("d"),
    code: (body.code && String(body.code).trim()) || codeFor(catName || "SB", existingInCat + 1),
    name: body.name || "",
    cat: catName,
    sub: body.sub || "",
    sizeSet,
    phase: body.phase || "",
    tier: body.tier || "",
    role: body.role || catObj?.role || "",
    colour: body.colour || "",
    colours: num(body.colours) || 1,
    fabric: body.fabric || "",
    comp: body.comp || "",
    gsm: body.gsm || "",
    width: body.width || "",
    fit: body.fit || "",
    wash: body.wash || "",
    finish: body.finish || "",
    print: body.print || "",
    mrp: body.mrp || "",
    sampleStatus: body.sampleStatus || "Not started",
    brief: body.brief || "",
    notes: body.notes || "",
    qty: body.qty || buildQtyForCurve(sizeSet, defaultPieces),
    shots,
    cost: emptyCost(),
    updatedAt: new Date().toISOString(),
  };
}

// ==========================================================================
// Authentication Routes (for /admin)
// ==========================================================================

router.post("/auth/login", (req, res) => {
  const { password } = req.body || {};
  if (!verifyPassword(password)) {
    return res.status(401).json({ error: "Incorrect admin password" });
  }
  const token = issueToken();
  res.json({ ok: true, token });
});

router.get("/auth/check", (req, res) => {
  const token = extractToken(req);
  res.json({ authenticated: verifyToken(token) });
});

// ==========================================================================
// Public Read Routes
// ==========================================================================

router.get(
  "/health",
  wrap(async (_req, res) => {
    const db = await loadDB();
    res.json({
      ok: true,
      storage: getStorageDriver(),
      brand: db.brand?.name || "Sundeepa Bamval",
      styles: (db.designs || []).length,
      categories: (db.categories || []).length,
      collections: (db.phases || []).length,
      updated: db.meta?.updated,
    });
  })
);

router.get(
  "/state",
  wrap(async (req, res) => {
    const db = await loadDB();
    db.categories = db.categories || [];
    db.phases = db.phases || [];
    db.designs = db.designs || [];
    db.inquiries = db.inquiries || [];

    const isAdmin = verifyToken(extractToken(req));
    const safeDb = isAdmin ? db : { ...db, inquiries: undefined };

    res.json({
      db: safeDb,
      storage: getStorageDriver(),
      constants: {
        SIZE_SETS,
        SETNAME,
        SIZE_CURVE,
        SHOTS,
        SAMPLE_ST,
        TIERS,
        TRIM_ROWS,
        PROC_ROWS,
      },
    });
  })
);

router.get(
  "/export/csv",
  wrap(async (_req, res) => {
    const db = await loadDB();
    const headers = [
      "Code",
      "Title",
      "Category",
      "Subcategory",
      "Collection / Drop",
      "Tier",
      "Colourways",
      "Colour Direction",
      "Fabric",
      "Composition",
      "GSM",
      "Fit",
      "Size System",
      "Total Pieces",
      "SKUs",
      "Target MRP (INR)",
      "Status",
      "Design Direction",
      "Notes",
    ];

    const rows = [headers.map(csvEscape).join(",")];
    for (const d of db.designs || []) {
      const ph = (db.phases || []).find((p) => p.id === d.phase);
      rows.push(
        [
          d.code,
          d.name,
          d.cat,
          d.sub,
          ph ? ph.name : "",
          d.tier || "",
          d.colours || 1,
          d.colour || "",
          d.fabric || "",
          d.comp || "",
          d.gsm || "",
          d.fit || "",
          SETNAME[d.sizeSet] || d.sizeSet,
          dTotal(d),
          dSkus(d),
          d.mrp || "",
          d.sampleStatus || "",
          d.brief || "",
          d.notes || "",
        ]
          .map(csvEscape)
          .join(",")
      );
    }

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="sundeepa-bamval-collection-${Date.now()}.csv"`);
    res.send(rows.join("\r\n"));
  })
);

// ==========================================================================
// Public Client Inquiry Submission & Admin Inquiries Inbox
// ==========================================================================

router.post(
  "/inquiries",
  wrap(async (req, res) => {
    const body = req.body || {};
    const name = String(body.name || "").trim();
    const email = String(body.email || "").trim();
    const message = String(body.message || "").trim();

    if (!name || !email || !message) {
      return res.status(400).json({ error: "Name, email, and message are required." });
    }

    const db = await loadDB(true);
    db.inquiries = db.inquiries || [];
    const inquiry = {
      id: uid("inq"),
      name,
      company: String(body.company || "").trim(),
      email,
      phone: String(body.phone || "").trim(),
      message,
      designId: String(body.designId || "").trim(),
      designCode: String(body.designCode || "").trim(),
      designName: String(body.designName || "").trim(),
      status: "New",
      createdAt: new Date().toISOString(),
    };

    db.inquiries.unshift(inquiry);
    await saveDB(db);
    res.status(201).json({ ok: true, inquiry: { id: inquiry.id } });
  })
);

router.get(
  "/inquiries",
  requireAdmin,
  wrap(async (_req, res) => {
    const db = await loadDB(true);
    res.json({ inquiries: db.inquiries || [] });
  })
);

router.patch(
  "/inquiries/:id",
  requireAdmin,
  wrap(async (req, res) => {
    const db = await loadDB(true);
    const inq = (db.inquiries || []).find((x) => x.id === req.params.id);
    if (!inq) return res.status(404).json({ error: "Inquiry not found" });
    if (req.body.status) inq.status = String(req.body.status);
    await saveDB(db);
    res.json({ inquiry: inq });
  })
);

router.delete(
  "/inquiries/:id",
  requireAdmin,
  wrap(async (req, res) => {
    const db = await loadDB(true);
    const idx = (db.inquiries || []).findIndex((x) => x.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: "Inquiry not found" });
    const [removed] = db.inquiries.splice(idx, 1);
    await saveDB(db);
    res.json({ deleted: removed.id });
  })
);

// ==========================================================================
// Admin-Protected Category & Collection Management
// ==========================================================================

router.post(
  "/categories",
  requireAdmin,
  wrap(async (req, res) => {
    const db = await loadDB(true);
    const name = String(req.body?.name || "").trim();
    if (!name) return res.status(400).json({ error: "Category name is required" });
    db.categories = db.categories || [];
    if (db.categories.some((c) => c.name.toLowerCase() === name.toLowerCase())) {
      return res.status(400).json({ error: "Category already exists" });
    }
    const category = {
      id: uid("cat"),
      name,
      sizeSet: SIZE_SETS[req.body.sizeSet] ? req.body.sizeSet : "top",
      role: String(req.body.role || "").trim(),
    };
    db.categories.push(category);
    await saveDB(db);
    res.status(201).json({ category });
  })
);

router.patch(
  "/categories/:id",
  requireAdmin,
  wrap(async (req, res) => {
    const db = await loadDB(true);
    const cat = (db.categories || []).find((c) => c.id === req.params.id);
    if (!cat) return res.status(404).json({ error: "Category not found" });
    const oldName = cat.name;
    if (req.body.name && String(req.body.name).trim()) {
      const newName = String(req.body.name).trim();
      cat.name = newName;
      (db.designs || []).forEach((d) => {
        if (d.cat === oldName) d.cat = newName;
      });
    }
    if (req.body.sizeSet && SIZE_SETS[req.body.sizeSet]) cat.sizeSet = req.body.sizeSet;
    if (req.body.role !== undefined) cat.role = String(req.body.role);
    await saveDB(db);
    res.json({ category: cat });
  })
);

router.delete(
  "/categories/:id",
  requireAdmin,
  wrap(async (req, res) => {
    const db = await loadDB(true);
    const idx = (db.categories || []).findIndex((c) => c.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: "Category not found" });
    const [removed] = db.categories.splice(idx, 1);
    await saveDB(db);
    res.json({ deleted: removed.id });
  })
);

router.post(
  "/phases",
  requireAdmin,
  wrap(async (req, res) => {
    const db = await loadDB(true);
    const name = String(req.body?.name || "").trim();
    if (!name) return res.status(400).json({ error: "Collection / Drop name is required" });
    db.phases = db.phases || [];
    const phase = {
      id: uid("p"),
      no: String(req.body.no || String(db.phases.length + 1).padStart(2, "0")),
      name,
      obj: String(req.body.obj || "").trim(),
    };
    db.phases.push(phase);
    await saveDB(db);
    res.status(201).json({ phase });
  })
);

router.patch(
  "/phases/:id",
  requireAdmin,
  wrap(async (req, res) => {
    const db = await loadDB(true);
    const phase = (db.phases || []).find((p) => p.id === req.params.id);
    if (!phase) return res.status(404).json({ error: "Collection not found" });
    if (req.body.name !== undefined) phase.name = String(req.body.name).trim();
    if (req.body.no !== undefined) phase.no = String(req.body.no).trim();
    if (req.body.obj !== undefined) phase.obj = String(req.body.obj).trim();
    await saveDB(db);
    res.json({ phase });
  })
);

router.delete(
  "/phases/:id",
  requireAdmin,
  wrap(async (req, res) => {
    const db = await loadDB(true);
    const idx = (db.phases || []).findIndex((p) => p.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: "Collection not found" });
    const [removed] = db.phases.splice(idx, 1);
    (db.designs || []).forEach((d) => {
      if (d.phase === removed.id) d.phase = "";
    });
    await saveDB(db);
    res.json({ deleted: removed.id });
  })
);

// ==========================================================================
// Admin-Protected Brand Presence
// ==========================================================================

router.patch(
  "/brand",
  requireAdmin,
  wrap(async (req, res) => {
    const db = await loadDB(true);
    const incoming = req.body || {};
    db.brand = db.brand || {};

    const scalarKeys = ["name", "subtitle", "tagline", "heroTitle", "manifesto", "about"];
    for (const k of scalarKeys) {
      if (incoming[k] !== undefined) db.brand[k] = String(incoming[k]);
    }
    if (Array.isArray(incoming.pillars)) db.brand.pillars = incoming.pillars;
    if (Array.isArray(incoming.palette)) db.brand.palette = incoming.palette;
    if (incoming.contact && typeof incoming.contact === "object") {
      db.brand.contact = { ...(db.brand.contact || {}), ...incoming.contact };
    }

    await saveDB(db);
    res.json({ brand: db.brand });
  })
);

router.post(
  "/brand/cover",
  requireAdmin,
  upload.single("image"),
  wrap(async (req, res) => {
    const db = await loadDB(true);
    if (!req.file) return res.status(400).json({ error: "No cover image provided" });
    db.brand = db.brand || {};
    if (db.brand.coverImage) await deleteUploadedFile(db.brand.coverImage);
    db.brand.coverImage = await uploadImage(req.file);
    await saveDB(db);
    res.json({ coverImage: db.brand.coverImage });
  })
);

router.delete(
  "/brand/cover",
  requireAdmin,
  wrap(async (_req, res) => {
    const db = await loadDB(true);
    db.brand = db.brand || {};
    if (db.brand.coverImage) {
      await deleteUploadedFile(db.brand.coverImage);
      db.brand.coverImage = "";
      await saveDB(db);
    }
    res.json({ coverImage: "" });
  })
);

// ==========================================================================
// Admin-Protected Designs & Image Uploads
// ==========================================================================

router.post(
  "/designs",
  requireAdmin,
  upload.single("image"),
  wrap(async (req, res) => {
    const db = await loadDB(true);
    const body = req.body || {};
    const imageUrl = req.file ? await uploadImage(req.file) : "";
    if (!body.name && req.file) {
      body.name = nameFromFilename(req.file.originalname);
    }
    const design = buildDesignRecord(db, body, imageUrl);
    db.designs.unshift(design);
    await saveDB(db);
    res.status(201).json({ design, categories: db.categories });
  })
);

router.post(
  "/designs/bulk",
  requireAdmin,
  upload.array("images", 100),
  wrap(async (req, res) => {
    const files = req.files || [];
    if (!files.length) {
      return res.status(400).json({ error: "No images provided for bulk upload" });
    }

    const db = await loadDB(true);
    const defaultCat = String(req.body.cat || "").trim();
    const defaultPhase = String(req.body.phase || "").trim();
    const defaultColours = num(req.body.colours) || 1;
    const defaultMrp = req.body.mrp || "";

    let perItemMeta = [];
    if (req.body.items) {
      try {
        perItemMeta = JSON.parse(req.body.items);
      } catch {
        perItemMeta = [];
      }
    }

    const uploadedUrls = await Promise.all(files.map((file) => uploadImage(file)));
    const created = [];

    files.forEach((file, i) => {
      const item = Array.isArray(perItemMeta) ? perItemMeta[i] || {} : {};
      const imageUrl = uploadedUrls[i];
      const styleName = (item.name && String(item.name).trim()) || nameFromFilename(file.originalname);
      const cat = item.cat !== undefined ? String(item.cat).trim() : defaultCat;
      const phase = item.phase !== undefined ? String(item.phase).trim() : defaultPhase;
      const mrp = item.mrp !== undefined ? item.mrp : defaultMrp;
      const colours = item.colours || defaultColours;

      const design = buildDesignRecord(
        db,
        {
          name: styleName,
          cat,
          sub: item.sub || "",
          phase,
          mrp,
          colours,
          fabric: item.fabric || "",
          colour: item.colour || "",
        },
        imageUrl
      );
      db.designs.unshift(design);
      created.push(design);
    });

    await saveDB(db);
    res.status(201).json({ count: created.length, designs: created, categories: db.categories });
  })
);

router.patch(
  "/designs/:id",
  requireAdmin,
  wrap(async (req, res) => {
    const db = await loadDB(true);
    const idx = db.designs.findIndex((d) => d.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: "Style not found" });

    const current = db.designs[idx];
    const patch = req.body || {};

    if (patch.cat !== undefined) {
      current.cat = ensureCategory(db, patch.cat, current.sizeSet || "top");
    }

    if (patch.sizeSet && patch.sizeSet !== current.sizeSet && SIZE_SETS[patch.sizeSet]) {
      const prevTotal = dTotal(current);
      current.sizeSet = patch.sizeSet;
      current.qty = buildQtyForCurve(patch.sizeSet, prevTotal);
    }

    const allowedFields = [
      "code",
      "name",
      "sub",
      "phase",
      "tier",
      "role",
      "colour",
      "colours",
      "fabric",
      "comp",
      "gsm",
      "width",
      "fit",
      "wash",
      "finish",
      "print",
      "mrp",
      "sampleStatus",
      "brief",
      "notes",
    ];
    for (const field of allowedFields) {
      if (patch[field] !== undefined) current[field] = patch[field];
    }

    if (patch.qty && typeof patch.qty === "object") {
      current.qty = { ...(current.qty || {}) };
      for (const [sz, val] of Object.entries(patch.qty)) {
        current.qty[sz] = Math.max(0, Math.round(num(val)));
      }
    }

    if (patch.cost && typeof patch.cost === "object") {
      current.cost = deepMerge(current.cost || emptyCost(), patch.cost);
    }

    current.updatedAt = new Date().toISOString();
    await saveDB(db);
    res.json({ design: current, categories: db.categories });
  })
);

router.post(
  "/designs/:id/duplicate",
  requireAdmin,
  wrap(async (req, res) => {
    const db = await loadDB(true);
    const idx = db.designs.findIndex((d) => d.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: "Style not found" });

    const orig = db.designs[idx];
    const copy = JSON.parse(JSON.stringify(orig));
    copy.id = uid("d");
    copy.code = `${orig.code}-COPY`;
    copy.name = orig.name ? `${orig.name} (Copy)` : "";
    copy.shots = {};
    copy.updatedAt = new Date().toISOString();

    db.designs.splice(idx + 1, 0, copy);
    await saveDB(db);
    res.status(201).json({ design: copy });
  })
);

router.delete(
  "/designs/:id",
  requireAdmin,
  wrap(async (req, res) => {
    const db = await loadDB(true);
    const idx = db.designs.findIndex((d) => d.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: "Style not found" });

    const [removed] = db.designs.splice(idx, 1);
    if (removed.shots) {
      await Promise.all(Object.values(removed.shots).map((url) => deleteUploadedFile(url)));
    }
    await saveDB(db);
    res.json({ deleted: removed.id });
  })
);

router.post(
  "/designs/:id/shots/:slot",
  requireAdmin,
  upload.single("image"),
  wrap(async (req, res) => {
    const db = await loadDB(true);
    const design = db.designs.find((d) => d.id === req.params.id);
    if (!design) return res.status(404).json({ error: "Style not found" });
    if (!req.file) return res.status(400).json({ error: "No image file provided" });

    const slot = decodeURIComponent(req.params.slot);
    design.shots = design.shots || {};
    if (design.shots[slot]) await deleteUploadedFile(design.shots[slot]);

    const imageUrl = await uploadImage(req.file);
    design.shots[slot] = imageUrl;
    design.updatedAt = new Date().toISOString();
    await saveDB(db);

    res.json({ slot, url: imageUrl, design });
  })
);

router.delete(
  "/designs/:id/shots/:slot",
  requireAdmin,
  wrap(async (req, res) => {
    const db = await loadDB(true);
    const design = db.designs.find((d) => d.id === req.params.id);
    if (!design) return res.status(404).json({ error: "Style not found" });

    const slot = decodeURIComponent(req.params.slot);
    if (design.shots && design.shots[slot]) {
      await deleteUploadedFile(design.shots[slot]);
      delete design.shots[slot];
      design.updatedAt = new Date().toISOString();
      await saveDB(db);
    }
    res.json({ design });
  })
);

router.post(
  "/logo",
  requireAdmin,
  upload.single("image"),
  wrap(async (req, res) => {
    const db = await loadDB(true);
    if (!req.file) return res.status(400).json({ error: "No logo image provided" });
    if (db.logo) await deleteUploadedFile(db.logo);
    db.logo = await uploadImage(req.file);
    await saveDB(db);
    res.json({ logo: db.logo });
  })
);

router.delete(
  "/logo",
  requireAdmin,
  wrap(async (_req, res) => {
    const db = await loadDB(true);
    if (db.logo) {
      await deleteUploadedFile(db.logo);
      db.logo = "";
      await saveDB(db);
    }
    res.json({ logo: "" });
  })
);

router.get(
  "/backup",
  requireAdmin,
  wrap(async (_req, res) => {
    const db = await loadDB(true);
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="sundeepa-bamval-backup-${Date.now()}.json"`);
    res.send(JSON.stringify(db, null, 2));
  })
);

router.post(
  "/restore",
  requireAdmin,
  wrap(async (req, res) => {
    const incoming = req.body;
    if (!incoming || !Array.isArray(incoming.designs)) {
      return res.status(400).json({ error: "Invalid backup file format." });
    }
    incoming.categories = Array.isArray(incoming.categories) ? incoming.categories : [];
    incoming.phases = Array.isArray(incoming.phases) ? incoming.phases : [];
    await saveDB(incoming);
    res.json({ ok: true, db: incoming });
  })
);

router.post(
  "/reset",
  requireAdmin,
  wrap(async (_req, res) => {
    const db = await loadDB(true);
    const urls = [];
    for (const d of db.designs || []) {
      if (d.shots) urls.push(...Object.values(d.shots));
    }
    if (db.logo) urls.push(db.logo);
    if (db.brand?.coverImage) urls.push(db.brand.coverImage);
    await Promise.all(urls.map((url) => deleteUploadedFile(url)));
    const fresh = await resetDB();
    res.json({ ok: true, db: fresh });
  })
);

router.use((err, _req, res, _next) => {
  console.error("API Error:", err.message);
  res.status(400).json({ error: err.message || "Request failed" });
});

module.exports = router;
