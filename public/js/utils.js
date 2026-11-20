export function esc(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function num(v) {
  const n = Number(String(v ?? "").replace(/,/g, "").trim());
  return Number.isFinite(n) ? n : 0;
}

export function grp(n) {
  return Math.round(num(n)).toLocaleString("en-IN");
}

export function money(n) {
  return "₹" + num(n).toLocaleString("en-IN", { maximumFractionDigits: 0 });
}

export function moneyDec(n) {
  return "₹" + num(n).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function dTotal(d) {
  return Object.values(d.qty || {}).reduce((a, b) => a + num(b), 0);
}

export function dSkus(d) {
  const liveSizes = Object.values(d.qty || {}).filter((v) => num(v) > 0).length;
  return liveSizes * Math.max(1, num(d.colours) || 1);
}

export function rollup(list) {
  let pieces = 0;
  let colourways = 0;
  let skus = 0;
  let retailValue = 0;
  for (const d of list || []) {
    const t = dTotal(d);
    pieces += t;
    colourways += Math.max(1, num(d.colours) || 1);
    skus += dSkus(d);
    if (num(d.mrp) > 0) retailValue += t * num(d.mrp);
  }
  return { designs: (list || []).length, pieces, colourways, skus, retailValue };
}

export function designFilled(d) {
  let score = 0;
  if (d.name && d.name.trim()) score++;
  if (d.fabric && d.fabric.trim()) score++;
  if (d.colour && d.colour.trim()) score++;
  if (d.mrp && num(d.mrp) > 0) score++;
  if (d.brief && d.brief.trim()) score++;
  if (d.shots && Object.keys(d.shots).length > 0) score++;
  return score;
}

export function completion(designs) {
  const total = (designs || []).length * 6;
  if (!total) return 0;
  const done = designs.reduce((a, d) => a + designFilled(d), 0);
  return Math.round((done / total) * 100);
}

export function catKind(cat) {
  return (
    {
      Shoes: "shoe",
      Bags: "bag",
      "Shades / Sunglasses": "eyewear",
      "Caps / Hats": "headwear",
    }[cat] || "apparel"
  );
}

export function CATFIELDS(d) {
  const k = catKind(d.cat);
  if (k === "bag") {
    return [
      ["Bag type", "fabric", "Backpack / sling / duffle"],
      ["Main material", "comp", "Canvas, nylon, leather trim"],
      ["Lining", "width", "Polyester twill"],
      ["Dimensions", "gsm", "H x W x D cm"],
      ["Compartments", "fit", "Main + laptop + front"],
      ["Hardware / zips", "wash", "YKK, matte gunmetal"],
      ["Strap", "finish", "Padded, adjustable"],
      ["Laptop fit", "print", "Up to 15 inch"],
    ];
  }
  if (k === "shoe") {
    return [
      ["Shoe type", "fabric", "Sneaker / loafer / sandal"],
      ["Upper", "comp", "Full-grain leather, canvas"],
      ["Lining", "width", "Leather / mesh"],
      ["Sole", "gsm", "Vulcanised rubber, EVA"],
      ["Construction", "fit", "Cupsole / stitchdown"],
      ["Finish", "wash", "Matte, burnished toe"],
      ["Branding", "finish", "Debossed heel tab"],
    ];
  }
  if (k === "eyewear") {
    return [
      ["Frame shape", "fabric", "Square / aviator / round"],
      ["Frame material", "comp", "Acetate, metal"],
      ["Lens colour", "width", "Smoke, amber, green"],
      ["Lens type", "gsm", "Polarised / UV400 / gradient"],
      ["Dimensions", "fit", "Lens x bridge x temple"],
      ["Hinges / hardware", "wash", "Flex hinge"],
      ["Branding", "finish", "Temple etch"],
    ];
  }
  if (k === "headwear") {
    return [
      ["Shape", "fabric", "5-panel / 6-panel / bucket"],
      ["Material", "comp", "Cotton twill, ripstop"],
      ["Closure", "width", "Strapback / snapback"],
      ["Fit", "gsm", "Free size, adjustable"],
      ["Graphic / embroidery", "fit", "Flat embroidery, tonal"],
      ["Branding", "wash", "Woven tab"],
    ];
  }
  return [
    ["Fabric direction", "fabric", "e.g. Cotton Oxford, linen blend"],
    ["Composition", "comp", "100% cotton"],
    ["Weight / GSM", "gsm", "140"],
    ["Fabric width", "width", "58 inch"],
    ["Fit", "fit", "Regular / relaxed"],
    ["Wash / finish", "wash", "Enzyme wash, garment dyed"],
    ["Surface / print", "finish", "Solid / tonal embroidery"],
  ];
}

// Factory Landing Cost Engine
export function ensureCost(d) {
  d.cost = d.cost || {};
  const c = d.cost;
  c.fab = c.fab || { cons: "", unit: "m", rate: "", waste: "", shrink: "" };
  c.trims = c.trims || {};
  c.proc = c.proc || {};
  c.cut = c.cut || { marker: "", labour: "", bundle: "" };
  c.stitch = c.stitch || { mode: "sam", sam: "", rate: "", eff: "", flat: "" };
  c.fin = c.fin || { trim: "", iron: "", button: "", insp: "", fold: "" };
  c.qc = c.qc || { inline: "", endline: "", final: "", reject: "", rework: "" };
  c.pack = c.pack || { poly: "", sticker: "", tissue: "", carton: "" };
  c.oh = c.oh || { mode: "perpiece", perpiece: "", monthly: "", output: "" };
  return c;
}

const sumObj = (o) => Object.values(o || {}).reduce((a, b) => a + num(b), 0);

export function costOf(d) {
  const c = ensureCost(d);
  const cons = num(c.fab.cons);
  const rate = num(c.fab.rate);
  const fabric = cons * (1 + num(c.fab.waste) / 100) * (1 + num(c.fab.shrink) / 100) * rate;
  const trims = Object.values(c.trims).reduce((a, t) => a + num(t?.qty) * num(t?.rate), 0);
  const proc = Object.values(c.proc).reduce((a, p) => a + num(p), 0);
  const cut = sumObj(c.cut);
  const st = c.stitch;
  const stitch =
    st.mode === "flat"
      ? num(st.flat)
      : num(st.eff) > 0
      ? (num(st.sam) / (num(st.eff) / 100)) * num(st.rate)
      : 0;
  const fin = sumObj(c.fin);
  const qcCost = num(c.qc.inline) + num(c.qc.endline) + num(c.qc.final) + num(c.qc.rework);
  const pack = sumObj(c.pack);
  const oh =
    c.oh.mode === "perpiece"
      ? num(c.oh.perpiece)
      : num(c.oh.output) > 0
      ? num(c.oh.monthly) / num(c.oh.output)
      : 0;
  const sub = fabric + trims + proc + cut + stitch + fin + qcCost + pack + oh;
  const rej = Math.min(40, num(c.qc.reject)) / 100;
  const landing = rej < 1 ? sub / (1 - rej) : sub;
  return {
    fabric,
    trims,
    proc,
    cut,
    stitch,
    fin,
    qc: qcCost,
    pack,
    oh,
    sub,
    rejAdd: landing - sub,
    landing,
    filled: [fabric, trims, proc, cut, stitch, fin, qcCost, pack, oh].some((v) => v > 0),
  };
}

export function fabricNeed(d) {
  const c = ensureCost(d);
  const cons = num(c.fab.cons);
  if (!cons) return 0;
  return cons * (1 + num(c.fab.waste) / 100) * dTotal(d);
}

export function projectCost(list) {
  let total = 0;
  let costed = 0;
  let costedPieces = 0;
  let pieces = 0;
  let fabMetres = 0;
  let lo = null;
  let hi = null;

  for (const d of list || []) {
    const r = costOf(d);
    const q = dTotal(d);
    pieces += q;
    fabMetres += fabricNeed(d);
    if (r.filled) {
      costed++;
      costedPieces += q;
      total += r.landing * q;
      if (lo === null || r.landing < lo.v) lo = { v: r.landing, d };
      if (hi === null || r.landing > hi.v) hi = { v: r.landing, d };
    }
  }
  return {
    total,
    costed,
    designs: (list || []).length,
    pieces,
    fabMetres,
    lo,
    hi,
    avg: costedPieces ? total / costedPieces : 0,
  };
}

export function blk(title, right = "") {
  return `<div class="blk"><h2>${esc(title)}</h2><span class="ln"></span>${
    right ? `<span class="r">${esc(right)}</span>` : ""
  }</div>`;
}

export function fld(label, val, attr = "", ph = "") {
  return `<label class="fld"><span>${esc(label)}</span><input class="inp" value="${esc(val ?? "")}" placeholder="${esc(
    ph
  )}" ${attr} /></label>`;
}

export function sel(label, val, opts, attr = "") {
  return `<label class="fld"><span>${esc(label)}</span><select class="inp" ${attr}>${opts
    .map((o) => `<option value="${esc(o)}" ${o === val ? "selected" : ""}>${esc(o)}</option>`)
    .join("")}</select></label>`;
}

export function MARK(size = 24) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 64 64" fill="none" aria-hidden="true">
    <text x="32" y="42" text-anchor="middle" font-family="Georgia, serif" font-size="28" font-weight="400" letter-spacing="1" fill="#f5f5f7">SB</text>
    <line x1="16" y1="50" x2="48" y2="50" stroke="#d4af37" stroke-width="2.5"/>
  </svg>`;
}

let toastTimer = null;
export function toast(msg) {
  const el = document.getElementById("toast");
  if (!el) return;
  el.textContent = msg;
  el.classList.add("on");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("on"), 2600);
}
