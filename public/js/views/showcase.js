import { esc, grp, num, dTotal, rollup } from "../utils.js";
import { renderSheet } from "./sheet.js";
import { renderUploadModal } from "./uploadModal.js";

export function getFilteredDesigns(state) {
  const { db, sc } = state;
  let list = [...(db.designs || [])];

  if (sc.cat !== "all") list = list.filter((d) => (d.cat || "") === sc.cat);
  if (sc.phase !== "all") list = list.filter((d) => (d.phase || "") === sc.phase);

  if (sc.query && sc.query.trim()) {
    const q = sc.query.trim().toLowerCase();
    list = list.filter((d) =>
      [d.code, d.name, d.cat, d.sub, d.fabric, d.colour, d.brief, d.notes, d.sampleStatus]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }

  if (sc.sort === "pieces_desc") {
    list.sort((a, b) => dTotal(b) - dTotal(a));
  } else if (sc.sort === "pieces_asc") {
    list.sort((a, b) => dTotal(a) - dTotal(b));
  } else if (sc.sort === "status") {
    list.sort((a, b) => String(a.sampleStatus || "").localeCompare(String(b.sampleStatus || "")));
  } else if (sc.sort === "images") {
    list.sort((a, b) => Object.keys(b.shots || {}).length - Object.keys(a.shots || {}).length);
  }

  return list;
}

export function renderShowcase(state) {
  const { db, sc, isAdmin } = state;
  const designs = db.designs || [];
  const categories = db.categories || [];
  const phases = db.phases || [];
  const brand = db.brand || {};
  const palette = Array.isArray(brand.palette) ? brand.palette : [];
  const list = getFilteredDesigns(state);
  const r = rollup(list);

  const catNames = [...new Set([...categories.map((c) => c.name), ...designs.map((d) => d.cat).filter(Boolean)])];

  const chip = (active, attr, val, label, cls = "") =>
    `<button class="chip ${cls}" aria-pressed="${active}" data-${attr}="${esc(val)}">${esc(label)}</button>`;

  const hasAnyDesigns = designs.length > 0;
  const brandName = brand.name || "Sundeepa Bamval";
  const viewMode = sc.view || "editorial"; // "editorial" | "archive"

  // Pick a cover image: explicit brand cover, or fallback to first uploaded design image
  const heroCover =
    brand.coverImage ||
    (() => {
      for (const d of designs) {
        const shots = d.shots || {};
        const img = shots["Reference"] || shots["Front"] || Object.values(shots)[0];
        if (img) return img;
      }
      return "";
    })();

  return `
  ${
    !isAdmin
      ? `
      <!-- Public Editorial Designer Masthead Hero -->
      <section class="atelier-hero">
        <div class="atelier-hero-copy">
          <div class="eyebrow">${esc(brand.tagline || "FASHION DESIGN ATELIER")}</div>
          <h1 class="atelier-hero-title">${esc(brandName)}</h1>
          <div class="atelier-hero-sub">${esc(brand.subtitle || "Curated Silhouettes & Collection Direction")}</div>
          ${
            brand.manifesto
              ? `<p class="atelier-hero-desc">${esc(brand.manifesto)}</p>`
              : ""
          }
          <div class="row wrap" style="margin-top:1.5rem;gap:0.7rem">
            ${
              hasAnyDesigns
                ? `<a href="#lookbookGrid" class="btn btn-gold-outline" style="text-decoration:none">Explore Lookbook ↓</a>`
                : ""
            }
            <button type="button" class="btn btn-primary" data-open-inquiry="1">Inquire / Book</button>
          </div>
        </div>
        <div class="atelier-hero-media">
          ${
            heroCover
              ? `<img src="${esc(heroCover)}" alt="${esc(brandName)} Atelier" />`
              : `<div class="atelier-hero-placeholder">
                   <div class="atelier-monogram">SB</div>
                   <div class="t-micro" style="letter-spacing:0.18em;text-transform:uppercase;color:var(--gold)">Atelier Showcase</div>
                 </div>`
          }
        </div>
      </section>
      `
      : `
      <!-- Admin Studio Header -->
      <div class="row-between wrap" style="margin-bottom:1.25rem;align-items:flex-end">
        <div class="ph" style="margin-bottom:0">
          <div class="ph-eyebrow">${esc(brandName)} · Admin Studio</div>
          <h1>The Showcase</h1>
          <p class="sub">
            Upload single designs or bulk-import batches of images (automatically named from each image filename). Everything publishes live to the public lookbook.
          </p>
        </div>

        <div class="row wrap" style="gap:0.55rem">
          <button class="btn btn-primary" data-open-upload="single">↑ Upload Design</button>
          <button class="btn" style="background:var(--dark);border-color:var(--dark);color:var(--gold)" data-open-upload="bulk">↑↑ Bulk Upload</button>
          <button class="btn btn-sm" data-addstyle="1">+ Blank Entry</button>
        </div>
      </div>
      `
  }

  <!-- Filter & Seasonal Colour Story Ribbon -->
  <div id="lookbookGrid" class="ribbon-bar">
    <div class="ribbon-filters">
      ${
        catNames.length > 0
          ? `<div class="chiprow" style="margin-bottom:0" role="group" aria-label="Filter by category">
               ${chip(sc.cat === "all", "scc", "all", `All (${designs.length})`)}
               ${catNames
                 .map((c) => chip(sc.cat === c, "scc", c, `${c} (${designs.filter((d) => d.cat === c).length})`))
                 .join("")}
             </div>`
          : `<span class="caps" style="color:var(--ink-2)">Lookbook Archive</span>`
      }
    </div>

    <div class="row wrap" style="gap:0.85rem">
      ${
        palette.length > 0
          ? `<div class="swatch-ribbon" title="Seasonal Colour Story">
               <span class="t-micro faint" style="margin-right:0.25rem">Palette</span>
               ${palette
                 .slice(0, 6)
                 .map(
                   (sw) =>
                     `<button type="button" class="swatch-dot" style="background:${esc(sw.hex)}" title="${esc(
                       sw.name || sw.hex
                     )} — Click to copy" data-copy="${esc(sw.hex)}"></button>`
                 )
                 .join("")}
             </div>`
          : ""
      }

      ${
        hasAnyDesigns
          ? `<div class="view-toggle" role="group" aria-label="Layout density">
               <button type="button" class="vt-btn" aria-pressed="${viewMode === "editorial"}" data-view="editorial">Editorial</button>
               <button type="button" class="vt-btn" aria-pressed="${viewMode === "archive"}" data-view="archive">Archive</button>
             </div>`
          : ""
      }
    </div>
  </div>

  ${
    phases.length > 0
      ? `<div class="chiprow" style="margin-top:0.65rem" role="group" aria-label="Filter by collection">
           ${chip(sc.phase === "all", "scp", "all", "All collections", "chip-gold")}
           ${phases.map((p) => chip(sc.phase === p.id, "scp", p.id, p.name, "chip-gold")).join("")}
         </div>`
      : ""
  }

  ${
    hasAnyDesigns && (isAdmin || designs.length >= 6)
      ? `<div class="toolbar">
           <div class="search-wrap">
             <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
               <circle cx="11" cy="11" r="8"></circle><path d="m21 21-4.3-4.3"></path>
             </svg>
             <input
               id="showcaseSearch"
               class="search-inp"
               type="search"
               value="${esc(sc.query)}"
               placeholder="Search looks by title, fabric, colour, code… (Press /)"
               data-search="1"
             />
           </div>

           ${
             isAdmin
               ? `<div class="rollup-metrics">
                    ${[
                      ["Designs", r.designs],
                      ...(r.pieces > 0 ? [["Pieces", r.pieces]] : []),
                      ["Colourways", r.colourways],
                    ]
                      .map(
                        ([k, v]) =>
                          `<div class="row" style="gap:0.4rem"><span class="caps">${k}</span><span class="fig semi">${grp(v)}</span></div>`
                      )
                      .join("")}
                  </div>`
               : `<span class="t-micro muted">${list.length} ${list.length === 1 ? "look" : "looks"}</span>`
           }

           <select class="inp" style="width:auto;padding:0.4rem 0.75rem;border-radius:999px;font-size:0.78rem" data-sort="1" aria-label="Sort designs">
             <option value="default" ${sc.sort === "default" ? "selected" : ""}>Sort: Curated order</option>
             <option value="images" ${sc.sort === "images" ? "selected" : ""}>With imagery first</option>
             ${isAdmin ? `<option value="pieces_desc" ${sc.sort === "pieces_desc" ? "selected" : ""}>Pieces: High → Low</option>` : ""}
             ${isAdmin ? `<option value="status" ${sc.sort === "status" ? "selected" : ""}>Status</option>` : ""}
           </select>
         </div>`
      : ""
  }

  ${
    !hasAnyDesigns
      ? `<div class="panel" style="margin-top:1.25rem"><div class="p-body" style="text-align:center;padding:4.5rem 1.5rem">
           <div class="ph-eyebrow" style="margin-bottom:0.45rem">${esc(brandName)}</div>
           <div style="font-family:var(--font-serif);font-size:1.65rem;color:var(--ink);margin-bottom:0.45rem">
             No looks published yet
           </div>
           <p class="t-lab muted" style="max-width:52ch;margin:0 auto 1.4rem">
             ${
               isAdmin
                 ? "Start curating your showcase by uploading a single design or bulk-importing a folder of lookbook images. Each image filename automatically becomes the design title."
                 : "The lookbook is currently being curated. New collections and designs will appear here shortly."
             }
           </p>
           ${
             isAdmin
               ? `<div class="row wrap" style="justify-content:center;gap:0.65rem">
                    <button class="btn btn-primary" data-open-upload="single">↑ Upload Single Design</button>
                    <button class="btn" style="background:var(--dark);border-color:var(--dark);color:var(--gold)" data-open-upload="bulk">↑↑ Bulk Upload Images</button>
                    <button class="btn" data-go="brand">Customize Atelier Brand</button>
                  </div>`
               : `<button type="button" class="btn btn-primary" data-open-inquiry="1">Inquire / Book Consultation</button>`
           }
         </div></div>`
      : list.length === 0
      ? `<div class="panel" style="margin-top:1.25rem"><div class="p-body" style="text-align:center;padding:3rem 1.5rem">
           <div class="semi" style="margin-bottom:0.35rem">No looks match this filter</div>
           <p class="t-lab muted" style="margin:0 0 1rem">Try clearing your search or switching filters.</p>
           <button class="btn btn-sm" data-clearfilters="1">Reset filters</button>
         </div></div>`
      : `<div class="look-grid ${viewMode === "archive" ? "archive" : "editorial"}" style="margin-top:1.15rem">
          ${list
            .map((d, i) => {
              const t = dTotal(d);
              const ph = phases.find((p) => p.id === d.phase);
              const shots = d.shots || {};
              const shotUrls = Object.values(shots).filter(Boolean);
              const primaryImg = shots["Reference"] || shots["Front"] || shotUrls[0] || "";
              const hoverImg = shotUrls.find((u) => u !== primaryImg) || "";
              const lookNo = String(i + 1).padStart(2, "0");
              const captionParts = [d.fabric, ph ? ph.name : d.cat].filter(Boolean);

              return `
              <button class="look-card" data-open="${esc(d.id)}">
                <div class="look-img${hoverImg ? " has-hover" : ""}">
                  ${
                    primaryImg
                      ? `<img class="img-primary" src="${esc(primaryImg)}" alt="${esc(d.name || d.code)}" loading="lazy" />
                         ${hoverImg ? `<img class="img-secondary" src="${esc(hoverImg)}" alt="" loading="lazy" />` : ""}`
                      : `<div class="ph2">
                           <div class="ph2-plus">${isAdmin ? "+" : "◇"}</div>
                           <span class="t-micro" style="font-weight:500;color:var(--ink-2)">${isAdmin ? "Upload look image" : "Awaiting imagery"}</span>
                           <span class="t-micro faint">${esc(d.code)}</span>
                         </div>`
                  }
                  <span class="card-badge-drop">LOOK ${lookNo}</span>
                  ${
                    isAdmin && d.sampleStatus && d.sampleStatus !== "Not started"
                      ? `<span class="card-badge-status">${esc(d.sampleStatus)}</span>`
                      : ""
                  }
                </div>
                <div class="look-body">
                  <div class="row-between">
                    <span class="card-code">${esc(d.code)}</span>
                    ${num(d.mrp) > 0 ? `<span class="t-micro fig muted">₹${grp(d.mrp)}</span>` : ""}
                  </div>
                  <div class="look-title">${esc(d.name || d.cat || "Untitled Look")}</div>
                  <div class="look-caption">${esc(captionParts.join(" · ") || "Atelier Piece")}</div>
                  ${
                    isAdmin && t > 0
                      ? `<div class="qtyline">
                           <span class="qtybig fig">${grp(t)}</span>
                           <span class="t-micro faint">pcs · ${Math.max(1, num(d.colours) || 1)} CW</span>
                         </div>`
                      : ""
                  }
                </div>
              </button>`;
            })
            .join("")}
        </div>`
  }

  ${sc.open ? renderSheet(state, list) : ""}
  ${isAdmin ? renderUploadModal(state) : ""}
  `;
}
