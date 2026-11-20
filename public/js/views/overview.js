import { esc, grp, num, dTotal, rollup, blk } from "../utils.js";

export function renderOverview(state) {
  const { db, isAdmin } = state;
  const designs = db.designs || [];
  const phases = db.phases || [];
  const brand = db.brand || {};

  const r = rollup(designs);
  const catNames = [...new Set([...(db.categories || []).map((c) => c.name), ...designs.map((d) => d.cat).filter(Boolean)])];
  const mrps = designs.map((d) => num(d.mrp)).filter((v) => v > 0);
  const mrpSpan = mrps.length ? `₹${grp(Math.min(...mrps))}–₹${grp(Math.max(...mrps))}` : "—";

  return `
  <div class="hero-dark" style="margin-bottom:1.75rem">
    <div class="p-body" style="padding:2.25rem 2rem">
      <div class="eyebrow">${esc(brand.tagline || brand.name || "SUNDEEPA BAMVAL")}</div>
      <h1>${esc(brand.heroTitle || `${brand.name || "Sundeepa Bamval"} — ${brand.subtitle || "Design Showcase"}`)}</h1>
      <p>
        ${esc(
          brand.manifesto ||
            "Curated showcase of brand presence, signature designs, collections, and production architecture."
        )}
      </p>
      <div class="row wrap" style="margin-top:1.4rem;gap:0.75rem">
        <button class="btn btn-primary" data-go="showcase">Explore The Showcase →</button>
        <button class="btn" style="background:rgba(255,255,255,0.08);border-color:rgba(255,255,255,0.2);color:#fff" data-go="brand">Brand Presence</button>
        ${
          isAdmin
            ? `<button class="btn" style="background:rgba(212,175,55,0.16);border-color:rgba(212,175,55,0.45);color:var(--gold)" data-go="settings">Studio Setup</button>`
            : ""
        }
      </div>
    </div>
  </div>

  ${blk("Collection at a glance", "Live metrics from published designs")}
  <div class="kpis">
    ${[
      [catNames.length, "Categories"],
      [r.designs, "Designs"],
      [grp(r.pieces), "Total Pieces"],
      [grp(r.colourways), "Colourways"],
      [phases.length, "Collections / Drops"],
      [mrpSpan, "Retail Span"],
    ]
      .map(([v, l]) => `<div class="kpi"><div class="kv">${v}</div><div class="kl">${l}</div></div>`)
      .join("")}
  </div>

  ${
    catNames.length > 0
      ? `${blk("By category", "Live breakdown")}
         <div class="panel">
           <div class="p-body flush">
             <div class="table-scroll">
               <table class="t">
                 <thead>
                   <tr>
                     <th>Category</th>
                     <th data-n>Designs</th>
                     <th data-n>Pieces</th>
                     <th data-n>Share</th>
                   </tr>
                 </thead>
                 <tbody>
                   ${catNames
                     .map((c) => {
                       const list = designs.filter((d) => d.cat === c);
                       const pcs = list.reduce((a, d) => a + dTotal(d), 0);
                       const share = r.designs ? Math.round((list.length / r.designs) * 100) : 0;
                       return `<tr>
                         <td><b>${esc(c)}</b></td>
                         <td data-n>${list.length}</td>
                         <td data-n class="semi">${grp(pcs)}</td>
                         <td data-n>${share}%</td>
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
    phases.length > 0
      ? `${blk("Collections & Drops", "Click any collection to filter The Showcase")}
         <div class="g3">
           ${phases
             .map((p) => {
               const list = designs.filter((d) => d.phase === p.id);
               const pcs = list.reduce((a, d) => a + dTotal(d), 0);
               const cNames = [...new Set(list.map((d) => d.cat).filter(Boolean))];
               return `<div class="panel">
                 <div class="p-body">
                   <div class="row-between">
                     <span class="caps" style="color:var(--gold-ink)">${esc(p.no || "COLLECTION")}</span>
                     <button class="btn btn-sm" data-jump-drop="${esc(p.id)}">Open →</button>
                   </div>
                   <div class="semi" style="font-family:var(--font-serif);font-size:1.12rem;margin:0.4rem 0 0.7rem">${esc(
                     p.name
                   )}</div>
                   <div class="row" style="gap:1.4rem;margin-bottom:0.8rem">
                     <div><div class="kv" style="font-size:1.15rem">${list.length}</div><div class="kl">designs</div></div>
                     ${pcs > 0 ? `<div><div class="kv" style="font-size:1.15rem">${grp(pcs)}</div><div class="kl">pieces</div></div>` : ""}
                   </div>
                   ${p.obj ? `<p class="t-lab muted" style="margin:0;line-height:1.48">${esc(p.obj)}</p>` : ""}
                   ${
                     cNames.length
                       ? `<div class="t-micro faint" style="margin-top:0.75rem;padding-top:0.65rem;border-top:1px solid var(--line-soft)">${esc(
                           cNames.join(" · ")
                         )}</div>`
                       : ""
                   }
                 </div>
               </div>`;
             })
             .join("")}
         </div>`
      : ""
  }
  `;
}
