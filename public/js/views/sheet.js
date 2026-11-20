import { esc, grp, num, dTotal, dSkus, CATFIELDS, costOf, money, blk, fld, sel } from "../utils.js";

const SIZE_LABELS = {
  top: "Tops XS–3XL",
  bottom: "Bottoms 28–40",
  alpha: "Alpha S–XL",
  shoe: "UK6–UK11",
  one: "One size",
  free: "Free",
};

export function renderSheet(state, filteredList) {
  const { db, constants, sc, isAdmin } = state;
  const { SIZE_SETS, SHOTS, SAMPLE_ST, TIERS } = constants;

  const d = (db.designs || []).find((x) => x.id === sc.open);
  if (!d) return "";

  const categories = (db.categories || []).map((c) => c.name);
  const phases = db.phases || [];
  const navList = filteredList && filteredList.length ? filteredList : db.designs;
  const idx = navList.findIndex((x) => x.id === d.id);
  const lookNo = idx >= 0 ? String(idx + 1).padStart(2, "0") : "01";
  const sizes = SIZE_SETS[d.sizeSet] || SIZE_SETS.top;
  const tot = dTotal(d);
  const ph = phases.find((p) => p.id === d.phase);
  const c = costOf(d);
  const mrpVal = num(d.mrp);
  const marginPct = c.filled && mrpVal > 0 ? Math.round(((mrpVal - c.landing) / mrpVal) * 100) : null;

  // ========================================================================
  // PUBLIC LUXURY LOOK SHEET (Vogue Runway / Atelier Presentation)
  // ========================================================================
  if (!isAdmin) {
    const uploadedSlots = SHOTS.filter((slot) => Boolean((d.shots || {})[slot]));
    const activeSlot = uploadedSlots.includes(sc.activeSlot) ? sc.activeSlot : uploadedSlots[0] || "";
    const heroImg = activeSlot ? d.shots[activeSlot] : "";

    const specs = [
      ["Category", [d.cat, d.sub].filter(Boolean).join(" · ")],
      ["Collection", ph ? ph.name : ""],
      ...CATFIELDS(d).map(([label, field]) => [label, d[field]]),
      ["Colourway Direction", d.colour],
      ["Colourways", num(d.colours) > 1 ? `${d.colours} colourways` : ""],
      ["Design Tier", d.tier],
      ["Capsule Role", d.role],
    ].filter(([, val]) => String(val || "").trim().length > 0);

    return `<div class="sheet" id="sheet" role="dialog" aria-modal="true" aria-label="Look ${lookNo} ${esc(d.name || d.code)}">
      <div class="sheet-bar">
        <button class="btn btn-sm" data-close="1">← Back to Lookbook</button>
        <span class="tagP fig">LOOK ${lookNo}</span>
        <span class="semi" style="font-family:var(--font-serif);font-size:1.05rem">${esc(d.name || d.cat || "Atelier Look")}</span>
        <span class="spacer"></span>
        <span class="t-micro muted fig">${idx >= 0 ? `${idx + 1} / ${navList.length}` : ""}</span>
        <button class="btn btn-sm btn-icon" data-nav="-1" title="Previous look (←)">←</button>
        <button class="btn btn-sm btn-icon" data-nav="1" title="Next look (→)">→</button>
      </div>

      <div class="sheet-in">
        <div class="look-sheet-grid">
          <!-- Left: Editorial Photo Stage + Thumbnail Strip -->
          <div>
            ${
              heroImg
                ? `<div class="look-stage" data-zoom="${esc(heroImg)}" data-zoom-cap="${esc(
                    `LOOK ${lookNo} · ${d.name || d.code} (${activeSlot})`
                  )}">
                     <img src="${esc(heroImg)}" alt="${esc(d.name || d.code)}" />
                     <span class="look-stage-hint">Click to zoom ⤢</span>
                   </div>`
                : `<div class="look-stage empty">
                     <div class="atelier-monogram" style="color:var(--ink-3)">SB</div>
                     <span class="t-micro muted">Imagery coming soon</span>
                   </div>`
            }

            ${
              uploadedSlots.length > 1
                ? `<div class="look-thumbs">
                     ${uploadedSlots
                       .map(
                         (slot) => `
                       <button type="button" class="look-thumb" aria-current="${slot === activeSlot}" data-slot-pick="${esc(
                           slot
                         )}">
                         <img src="${esc(d.shots[slot])}" alt="${esc(slot)}" />
                         <span>${esc(slot)}</span>
                       </button>`
                       )
                       .join("")}
                   </div>`
                : ""
            }
          </div>

          <!-- Right: Editorial Look Narrative & Specs -->
          <div class="look-sheet-info">
            <div class="row" style="gap:0.65rem;margin-bottom:0.5rem">
              <span class="caps" style="color:var(--gold-ink)">LOOK ${lookNo}</span>
              <span class="faint">·</span>
              <span class="fig t-micro" style="color:var(--accent)">${esc(d.code)}</span>
            </div>

            <h1 class="look-sheet-title">${esc(d.name || d.cat || "Atelier Look")}</h1>

            ${
              mrpVal > 0
                ? `<div class="fig" style="font-size:1.15rem;color:var(--ink);margin-top:0.55rem">₹${grp(mrpVal)}</div>`
                : ""
            }

            ${
              d.brief
                ? `<p class="look-sheet-story">${esc(d.brief)}</p>`
                : ""
            }

            ${
              specs.length > 0
                ? `<div class="look-specs">
                     ${specs
                       .map(
                         ([label, val]) => `
                       <div class="look-spec-row">
                         <span class="look-spec-k">${esc(label)}</span>
                         <span class="look-spec-v">${esc(val)}</span>
                       </div>`
                       )
                       .join("")}
                   </div>`
                : ""
            }

            ${
              d.notes
                ? `<div class="note" style="margin-top:1.25rem">
                     <b>Craft &amp; Construction Notes</b><br/>
                     ${esc(d.notes)}
                   </div>`
                : ""
            }

            <div class="look-sheet-cta">
              <button type="button" class="btn btn-primary" style="width:100%;padding:0.78rem 1.25rem" data-open-inquiry="${esc(
                d.id
              )}">
                Inquire About This Design →
              </button>
              <div class="t-micro faint" style="text-align:center;margin-top:0.55rem">
                Request customisation, fabric swatches, or collection consultation
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>`;
  }

  // ========================================================================
  // ADMIN EDITABLE STYLE SHEET
  // ========================================================================
  return `<div class="sheet" id="sheet" role="dialog" aria-modal="true" aria-label="Design brief ${esc(d.code)}">
    <datalist id="sheetCatList">
      ${categories.map((cat) => `<option value="${esc(cat)}"></option>`).join("")}
    </datalist>

    <div class="sheet-bar">
      <button class="btn btn-sm" data-close="1">← Back to Showcase</button>
      <span class="fig t-lab" style="color:var(--accent);font-weight:600">${esc(d.code)}</span>
      <span class="semi" style="font-family:var(--font-serif);font-size:1.05rem">${esc(d.name || d.cat || "Untitled Design")}</span>
      <span class="spacer"></span>
      <span class="t-micro muted fig">${idx >= 0 ? `${idx + 1} of ${navList.length}` : ""}</span>
      <button class="btn btn-sm btn-icon" data-nav="-1" title="Previous design (←)">←</button>
      <button class="btn btn-sm btn-icon" data-nav="1" title="Next design (→)">→</button>
      <button class="btn btn-sm" data-open-costing="${esc(d.id)}">Costing Sheet</button>
      <button class="btn btn-sm" data-dup="${esc(d.id)}">Duplicate</button>
      <button class="btn btn-sm btn-danger" data-del="${esc(d.id)}">Delete</button>
    </div>

    <div class="sheet-in">
      <div class="g2" style="gap:1.6rem;align-items:start">
        <div>
          <div class="shot-grid">
            ${SHOTS.map((slot) => {
              const img = (d.shots || {})[slot];
              return `<label class="shot${img ? " filled" : ""}" data-dropzone="${esc(d.id)}:${esc(slot)}">
                ${
                  img
                    ? `<img src="${esc(img)}" alt="${esc(slot)}" />
                       <span class="shot-tag">${esc(slot)}</span>
                       <div class="shot-actions">
                         <button type="button" class="shot-btn" data-zoom="${esc(img)}" data-zoom-cap="${esc(
                        `${d.code} · ${slot}`
                      )}" title="Inspect full size">⤢</button>
                         <button type="button" class="shot-btn del" data-shotx="${esc(d.id)}:${esc(
                        slot
                      )}" title="Remove image">✕</button>
                       </div>`
                    : `<span class="shot-label">${esc(slot)}</span>
                       <span class="shot-sub">Click or drop image</span>`
                }
                <input type="file" accept="image/*" data-shot="${esc(d.id)}:${esc(slot)}" hidden />
              </label>`;
            }).join("")}
          </div>
          <div class="note" style="margin-top:0.9rem">
            <b>Six editorial &amp; technical slots per design.</b> Drag &amp; drop or click any slot to upload directly to the server.
          </div>
        </div>

        <div class="stack">
          <div class="panel">
            <div class="p-head">
              <h3>Identity &amp; Technical Direction</h3>
              <span class="tagM">Design Brief</span>
            </div>
            <div class="p-body">
              <div class="g2" style="gap:0.75rem">
                ${fld("Design code", d.code, `data-d="${esc(d.id)}:code"`)}
                ${fld("Design title", d.name, `data-d="${esc(d.id)}:name"`, "e.g. Draped Silk Midi Dress")}
                ${fld("Category", d.cat, `list="sheetCatList" data-d="${esc(d.id)}:cat"`, "Type or pick category")}
                ${fld("Subcategory", d.sub, `data-d="${esc(d.id)}:sub"`, "Optional")}
                <label class="fld">
                  <span>Collection / Drop</span>
                  <select class="inp" data-dphase="${esc(d.id)}">
                    <option value="">None</option>
                    ${phases
                      .map((p) => `<option value="${esc(p.id)}" ${d.phase === p.id ? "selected" : ""}>${esc(p.name)}</option>`)
                      .join("")}
                  </select>
                </label>
                ${CATFIELDS(d)
                  .map(([label, field, placeholder]) =>
                    fld(label, d[field] || "", `data-d="${esc(d.id)}:${field}"`, placeholder)
                  )
                  .join("")}
                ${fld("Colourway direction", d.colour, `data-d="${esc(d.id)}:colour"`, "Ivory, obsidian, champagne")}
                ${fld("Number of colourways", d.colours, `data-d="${esc(d.id)}:colours" inputmode="numeric"`, "1")}
              </div>
            </div>
          </div>

          <div class="panel">
            <div class="p-head">
              <h3>Commercial &amp; Production</h3>
              <span class="tagP">Details</span>
            </div>
            <div class="p-body">
              <div class="g2" style="gap:0.75rem">
                ${fld("Target MRP (₹)", d.mrp, `data-d="${esc(d.id)}:mrp" inputmode="numeric"`, "Optional")}
                ${fld("Product role / Capsule note", d.role || "", `data-d="${esc(d.id)}:role"`, "e.g. Signature statement")}
                ${sel("Design tier", d.tier || "", ["", ...TIERS], `data-d="${esc(d.id)}:tier"`)}
                ${sel("Sample status", d.sampleStatus || "Not started", SAMPLE_ST, `data-d="${esc(d.id)}:sampleStatus"`)}
              </div>

              <div class="row-between" style="margin-top:0.85rem;padding-top:0.85rem;border-top:1px solid var(--line-soft)">
                <div>
                  <div class="caps">Factory Landing Cost</div>
                  <div class="fig semi" style="font-size:1.05rem;margin-top:2px">
                    ${c.filled ? money(c.landing) : "Not costed yet"}
                    ${marginPct !== null ? `<span class="tagG" style="margin-left:0.5rem">${marginPct}% gross margin</span>` : ""}
                  </div>
                </div>
                <button class="btn btn-sm" data-open-costing="${esc(d.id)}">Open Cost Builder →</button>
              </div>
            </div>
          </div>
        </div>
      </div>

      ${blk("Size-Wise Quantity Matrix", "Edit any cell — every roll-up updates live")}
      <div class="panel">
        <div class="p-body">
          <div class="chiprow" style="margin-bottom:0.9rem">
            ${Object.keys(SIZE_SETS)
              .map(
                (k) =>
                  `<button class="chip" aria-pressed="${d.sizeSet === k}" data-sizeset="${esc(d.id)}:${k}">${esc(
                    SIZE_LABELS[k] || k
                  )}</button>`
              )
              .join("")}
          </div>

          <div class="sizemx">
            <table>
              <thead>
                <tr>
                  <th style="text-align:left">Size</th>
                  ${sizes.map((s) => `<th>${esc(s)}</th>`).join("")}
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td class="t-lab muted" style="text-align:left;white-space:nowrap">Quantity</td>
                  ${sizes
                    .map(
                      (s) =>
                        `<td><input value="${esc(d.qty?.[s] ?? 0)}" data-qty="${esc(d.id)}:${esc(
                          s
                        )}" inputmode="numeric" /></td>`
                    )
                    .join("")}
                  <td class="totcol semi">${grp(tot)}</td>
                </tr>
                <tr>
                  <td class="t-lab muted" style="text-align:left">Mix</td>
                  ${sizes
                    .map(
                      (s) =>
                        `<td class="totcol t-micro faint">${tot ? Math.round((num(d.qty?.[s]) / tot) * 100) : 0}%</td>`
                    )
                    .join("")}
                  <td class="totcol t-micro faint">${tot ? "100%" : "—"}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div class="g4" style="margin-top:1rem;padding-top:1rem;border-top:1px solid var(--line-soft)">
            ${[
              ["Pieces, this design", grp(tot)],
              ["Per colourway", grp(Math.round(tot / Math.max(1, num(d.colours) || 1)))],
              ["Live sizes", sizes.filter((s) => num(d.qty?.[s]) > 0).length],
              ["Total SKUs", grp(dSkus(d))],
            ]
              .map(
                ([k, v]) =>
                  `<div><div class="caps">${k}</div><div class="fig semi" style="font-size:1.1rem;margin-top:0.2rem">${v}</div></div>`
              )
              .join("")}
          </div>
        </div>
      </div>

      ${blk("Design Story & Studio Notes", "Auto-saved to server")}
      <div class="panel">
        <div class="p-body">
          <label class="fld">
            <span>Design Direction &amp; Story</span>
            <textarea class="inp" rows="3" data-d="${esc(
              d.id
            )}:brief" placeholder="Silhouette, inspiration, mood, detailing, occasion">${esc(d.brief || "")}</textarea>
          </label>
          <label class="fld" style="margin-top:0.85rem">
            <span>Fabric &amp; Construction Notes</span>
            <textarea class="inp" rows="3" data-d="${esc(
              d.id
            )}:notes" placeholder="Mill references, wash trials, embroidery details, production notes">${esc(
    d.notes || ""
  )}</textarea>
          </label>
        </div>
      </div>
    </div>
  </div>`;
}
