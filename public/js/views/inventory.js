import { esc, grp, num, dTotal, dSkus, rollup, money, blk } from "../utils.js";

export function renderInventory(state) {
  const { db, constants } = state;
  const { SIZE_SETS, SETNAME } = constants;

  const designs = db.designs || [];
  const phases = db.phases || [];
  const r = rollup(designs);
  const grand = r.pieces;

  if (!designs.length) {
    return `
    <div class="ph">
      <div class="ph-eyebrow">Assortment &amp; Depth Architecture</div>
      <h1>Inventory Plan</h1>
      <p class="sub">Live inventory rollups, size curves, and CSV export will populate automatically as designs are added.</p>
    </div>
    <div class="panel"><div class="p-body" style="text-align:center;padding:3.5rem 1.5rem">
      <div class="semi" style="margin-bottom:0.35rem">No designs in the inventory yet</div>
      <p class="t-lab muted" style="margin:0">Upload designs in The Showcase to see category rollups and size curves here.</p>
    </div></div>`;
  }

  const catNames = [...new Set(designs.map((d) => d.cat || "Uncategorized"))];
  const catRows = catNames.map((c) => {
    const list = designs.filter((d) => (d.cat || "Uncategorized") === c);
    const pieces = list.reduce((a, d) => a + dTotal(d), 0);
    const cw = list.reduce((a, d) => a + Math.max(1, num(d.colours) || 1), 0);
    return {
      c,
      designs: list.length,
      cw,
      perStyle: list.length ? Math.round(pieces / list.length) : 0,
      pieces,
    };
  });

  const bySet = {};
  for (const d of designs) {
    const set = d.sizeSet || "top";
    if (!bySet[set]) bySet[set] = {};
    for (const sz of SIZE_SETS[set] || []) {
      bySet[set][sz] = (bySet[set][sz] || 0) + num(d.qty?.[sz]);
    }
  }

  return `
  <div class="row-between wrap" style="margin-bottom:1.25rem;align-items:flex-end">
    <div class="ph" style="margin-bottom:0">
      <div class="ph-eyebrow">Assortment &amp; Depth Architecture</div>
      <h1>Inventory Plan</h1>
      <p class="sub">
        Live rollup across every published design, collection, and size curve. Click any row below to inspect its brief.
      </p>
    </div>
    <div class="row">
      <button class="btn btn-primary btn-sm" data-export="csv">Export Inventory CSV</button>
    </div>
  </div>

  <div class="kpis" style="margin-bottom:1.1rem">
    ${[
      [r.designs, "Total Designs"],
      [grp(r.pieces), "Planned Pieces"],
      [grp(r.colourways), "Colourways"],
      [grp(r.skus), "Active SKUs"],
      [r.retailValue > 0 ? money(r.retailValue) : "—", "Targeted Retail Value"],
    ]
      .map(([v, l]) => `<div class="kpi"><div class="kv">${v}</div><div class="kl">${l}</div></div>`)
      .join("")}
  </div>

  ${blk("By category")}
  <div class="panel">
    <div class="p-body flush">
      <div class="table-scroll">
        <table class="t">
          <thead>
            <tr>
              <th>Category</th>
              <th data-n>Designs</th>
              <th data-n>CW</th>
              <th data-n>Pcs / Design</th>
              <th data-n>Pieces</th>
              <th data-n>Share</th>
            </tr>
          </thead>
          <tbody>
            ${catRows
              .map(
                (x) => `
              <tr>
                <td><b>${esc(x.c)}</b></td>
                <td data-n>${x.designs}</td>
                <td data-n>${x.cw}</td>
                <td data-n>${grp(x.perStyle)}</td>
                <td data-n class="semi">${grp(x.pieces)}</td>
                <td data-n>${grand ? Math.round((x.pieces / grand) * 100) : 0}%</td>
              </tr>`
              )
              .join("")}
            <tr class="tot">
              <td><b>Total</b></td>
              <td data-n><b>${r.designs}</b></td>
              <td data-n><b>${grp(r.colourways)}</b></td>
              <td data-n>—</td>
              <td data-n><b>${grp(grand)}</b></td>
              <td data-n><b>${grand ? "100%" : "—"}</b></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>

  ${
    phases.length > 0
      ? `${blk("By collection / drop")}
         <div class="panel">
           <div class="p-body flush">
             <div class="table-scroll">
               <table class="t">
                 <thead>
                   <tr>
                     <th>Collection</th>
                     <th data-n>Designs</th>
                     <th data-n>Pieces</th>
                     <th>Notes</th>
                   </tr>
                 </thead>
                 <tbody>
                   ${phases
                     .map((p) => {
                       const l = designs.filter((d) => d.phase === p.id);
                       return `<tr>
                         <td><b>${esc(p.name)}</b></td>
                         <td data-n>${l.length}</td>
                         <td data-n class="semi">${grp(l.reduce((a, d) => a + dTotal(d), 0))}</td>
                         <td class="t-micro muted">${esc(p.obj || "—")}</td>
                       </tr>`;
                     })
                     .join("")}
                 </tbody>
               </table>
             </div>
           </div>
         </div>`
      : ""
  }

  ${
    grand > 0
      ? `${blk("Size curves")}
         <div class="stack-s">
           ${Object.keys(bySet)
             .map((k) => {
               const rowsTot = Object.values(bySet[k]).reduce((a, b) => a + b, 0);
               if (!rowsTot) return "";
               const keys = SIZE_SETS[k] || [];
               return `<div class="panel">
                 <div class="p-body">
                   <div class="row-between" style="margin-bottom:0.6rem">
                     <span class="semi">${esc(SETNAME[k] || k)}</span>
                     <span class="t-micro fig muted">${grp(rowsTot)} pieces</span>
                   </div>
                   <div class="sizemx">
                     <table>
                       <thead>
                         <tr>
                           <th style="text-align:left">Size</th>
                           ${keys.map((sz) => `<th>${esc(sz)}</th>`).join("")}
                           <th>Total</th>
                         </tr>
                       </thead>
                       <tbody>
                         <tr>
                           <td class="t-lab muted" style="text-align:left">Pieces</td>
                           ${keys.map((sz) => `<td class="totcol">${grp(bySet[k][sz] || 0)}</td>`).join("")}
                           <td class="totcol semi">${grp(rowsTot)}</td>
                         </tr>
                         <tr>
                           <td class="t-lab muted" style="text-align:left">Mix</td>
                           ${keys
                             .map(
                               (sz) =>
                                 `<td class="totcol t-micro faint">${Math.round(((bySet[k][sz] || 0) / rowsTot) * 100)}%</td>`
                             )
                             .join("")}
                           <td class="totcol t-micro faint">100%</td>
                         </tr>
                       </tbody>
                     </table>
                   </div>
                 </div>
               </div>`;
             })
             .join("")}
         </div>`
      : ""
  }

  ${blk("All designs", "Click any row to open its full brief")}
  <div class="panel">
    <div class="p-body flush">
      <div class="table-scroll">
        <table class="t">
          <thead>
            <tr>
              <th>Code</th>
              <th>Title</th>
              <th>Category</th>
              <th>Collection</th>
              <th data-n>CW</th>
              <th data-n>Pieces</th>
              <th data-n>SKUs</th>
              <th data-n>Target MRP</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            ${designs
              .map((d) => {
                const p = phases.find((x) => x.id === d.phase);
                return `<tr class="clickable" data-jump-style="${esc(d.id)}">
                  <td class="fig" style="color:var(--accent);font-weight:500">${esc(d.code)}</td>
                  <td class="semi">${esc(d.name || "—")}</td>
                  <td>${esc(d.cat || "—")}</td>
                  <td class="t-micro">${p ? esc(p.name) : "—"}</td>
                  <td data-n>${Math.max(1, num(d.colours) || 1)}</td>
                  <td data-n class="semi">${grp(dTotal(d))}</td>
                  <td data-n>${grp(dSkus(d))}</td>
                  <td data-n>${num(d.mrp) > 0 ? `₹${grp(d.mrp)}` : "—"}</td>
                  <td class="t-micro muted">${esc(d.sampleStatus || "Not started")}</td>
                </tr>`;
              })
              .join("")}
          </tbody>
        </table>
      </div>
    </div>
  </div>
  `;
}
