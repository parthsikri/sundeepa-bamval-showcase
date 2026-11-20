const crypto = require("crypto");

const SIZE_SETS = {
  top: ["XS", "S", "M", "L", "XL", "XXL", "3XL"],
  bottom: ["28", "30", "32", "34", "36", "38", "40"],
  alpha: ["S", "M", "L", "XL"],
  shoe: ["UK6", "UK7", "UK8", "UK9", "UK10", "UK11"],
  one: ["One size"],
  free: ["Free"],
};

const SETNAME = {
  top: "Tops (XS–3XL)",
  bottom: "Bottoms (28–40)",
  alpha: "Alpha (S–XL)",
  shoe: "Footwear (UK6–UK11)",
  one: "One size",
  free: "Free size",
};

const SIZE_CURVE = {
  top: { XS: 5, S: 15, M: 26, L: 30, XL: 16, XXL: 8, "3XL": 0 },
  bottom: { 28: 6, 30: 14, 32: 26, 34: 28, 36: 18, 38: 8, 40: 0 },
  alpha: { S: 20, M: 32, L: 30, XL: 18 },
  shoe: { UK6: 8, UK7: 18, UK8: 26, UK9: 24, UK10: 16, UK11: 8 },
  one: { "One size": 100 },
  free: { Free: 100 },
};

const SHOTS = ["Reference", "Front", "Back", "Detail", "Tech Sketch", "Fabric / Swatch"];

const SAMPLE_ST = [
  "Not started",
  "Concept",
  "Briefed",
  "Tech pack ready",
  "Proto requested",
  "Proto received",
  "Fit approved",
  "PP sample approved",
  "Production ready",
];

const TIERS = ["Core", "Elevated", "Trend", "Signature", "Statement", "Experimental"];

const TRIM_ROWS = [
  "Buttons",
  "Zipper",
  "Thread",
  "Elastic",
  "Interlining",
  "Main label",
  "Size label",
  "Wash-care label",
  "Hang tag",
  "Drawcord",
  "Eyelets",
  "Other trims",
];

const PROC_ROWS = [
  "Dyeing",
  "Washing",
  "Printing",
  "Embroidery",
  "Enzyme wash",
  "Silicon wash",
  "Garment dye",
  "Distressing",
  "Special finish",
];

function uid(prefix = "d") {
  return `${prefix}_${crypto.randomBytes(5).toString("hex")}`;
}

function codeFor(cat, idx) {
  const clean = String(cat || "SB")
    .replace(/[^a-zA-Z0-9]/g, "")
    .slice(0, 2)
    .toUpperCase() || "SB";
  return `SB-${clean}-${String(idx).padStart(2, "0")}`;
}

function buildQtyForCurve(set, totalPieces) {
  const keys = SIZE_SETS[set] || SIZE_SETS.top;
  const curve = SIZE_CURVE[set] || SIZE_CURVE.top;
  const qty = {};
  if (!totalPieces || totalPieces <= 0) {
    keys.forEach((s) => (qty[s] = 0));
    return qty;
  }
  let run = 0;
  keys.forEach((s) => {
    const v = Math.floor((totalPieces * (curve[s] || 0)) / 100);
    qty[s] = v;
    run += v;
  });
  const order = [...keys].sort((a, b) => (curve[b] || 0) - (curve[a] || 0));
  let k = 0;
  while (run < totalPieces) {
    qty[order[k % order.length]]++;
    run++;
    k++;
  }
  return qty;
}

function emptyCost() {
  return {
    fab: { cons: "", unit: "m", rate: "", waste: "", shrink: "" },
    trims: {},
    proc: {},
    cut: { marker: "", labour: "", bundle: "" },
    stitch: { mode: "sam", sam: "", rate: "", eff: "", flat: "" },
    fin: { trim: "", iron: "", button: "", insp: "", fold: "" },
    qc: { inline: "", endline: "", final: "", reject: "", rework: "" },
    pack: { poly: "", sticker: "", tissue: "", carton: "" },
    oh: { mode: "perpiece", perpiece: "", monthly: "", output: "" },
  };
}

function nameFromFilename(filename) {
  const base = String(filename || "")
    .replace(/\.[^/.]+$/, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!base) return "Untitled Design";
  return base.replace(/\b\w/g, (ch) => ch.toUpperCase());
}

function createEmptyDatabase() {
  return {
    meta: {
      created: new Date().toISOString(),
      updated: new Date().toISOString(),
      version: "3.0.0",
    },
    brand: {
      name: "Sundeepa Bamval",
      subtitle: "Curated Silhouettes & Collection Direction",
      tagline: "",
      heroTitle: "",
      manifesto: "",
      about: "",
      coverImage: "",
      pillars: [],
      palette: [],
      contact: {
        email: "",
        phone: "",
        location: "",
        website: "",
        instagram: "",
        linkedin: "",
      },
    },
    logo: "",
    categories: [],
    phases: [],
    designs: [],
    inquiries: [],
  };
}

module.exports = {
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
  createEmptyDatabase,
  createSeedDatabase: createEmptyDatabase,
};
