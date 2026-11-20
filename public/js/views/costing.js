import { esc, grp, num, dTotal, ensureCost, costOf, projectCost, money, moneyDec, blk, fld } from "../utils.js";

export function renderCosting(state) {
  const { db, constants, costStyleId } = state;
  const { TRIM_ROWS, PROC_ROWS } = constants;

  const pc = projectCost(db.designs);
  const activeId = costStyleId && db.designs.some((d) => d.id === costStyleId) ? costStyleId : db.designs[0]?.id;
  const d = db.designs.find((x) => x.id === activeId);

  if (!d) {
    return `<div class="ph">
      <div class="ph-eyebrow">Factory Landing Cost Engine</div>
      <h1>Product Costing</h1>
      <p class="sub">${
        state.isAdmin
          ? "Upload styles in The Showcase first to calculate factory landing costs."
          : "No styles have been published to the collection yet."
      }</p>
    </div>`;
  }

  const ro = state.isAdmin ? "" : "disabled";

  const c = ensureCost(d);
  const res = costOf(d);
  const qty = dTotal(d);
  const mrpVal = num(d.mrp);
  const marginPct = res.filled && mrpVal > 0 ? (((mrpVal - res.landing) / mrpVal) * 100).toFixed(1) : null;
  const markup = res.filled && res.landing > 0 && mrpVal > 0 ? (mrpVal / res.landing).toFixed(2) : null;

  return `
  <div class="ph">
    <div class="ph-eyebrow">Factory Landing Cost Engine</div>
    <h1>Product Costing</h1>
    <p class="sub">
      Build bottom-up factory landing cost per style from fabric consumption through stitching, finishing, QC rejection, and factory overhead.
    </p>
  </div>

  <div class="kpis" style="margin-bottom:1.25rem">
    ${[
      [`${pc.costed} / ${pc.designs}`, "Styles Costed"],
      [pc.avg > 0 ? money(pc.avg) : "—", "Weighted Avg Landing Cost"],
      [pc.total > 0 ? money(pc.total) : "—", "Total Production Exposure"],
      [pc.fabMetres > 0 ? `${grp(pc.fabMetres)} m` : "—", "Est. Fabric Requirement"],
    ]
      .map(([v, l]) => `<div class="kpi"><div class="kv">${v}</div><div class="kl">${l}</div></div>`)
      .join("")}
  </div>

  <div class="toolbar">
    <span class="caps">Select Style</span>
    <select class="inp" style="flex:1;max-width:440px" data-cost-select="1">
      ${db.designs
        .map((x) => {
          const xc = costOf(x);
          return `<option value="${esc(x.id)}" ${x.id === d.id ? "selected" : ""}>${esc(x.code)} — ${esc(
            x.name || x.cat
          )} (${grp(dTotal(x))} pcs)${xc.filled ? ` · ${money(xc.landing)}` : ""}</option>`;
        })
        .join("")}
    </select>
    <span class="spacer"></span>
    <button class="btn btn-sm" data-jump-style="${esc(d.id)}">Open Style Brief →</button>
  </div>

  <!-- Live Landing Cost Summary Banner -->
  <div class="hero-dark" style="margin-bottom:1.5rem">
    <div class="p-body" style="padding:1.5rem 1.75rem">
      <div class="row-between wrap" style="gap:1rem">
        <div>
          <div class="eyebrow">${esc(d.code)} · ${esc(d.cat)}</div>
          <h2 style="font-family:var(--font-serif);font-weight:400;font-size:1.55rem;color:#fff;margin-top:0.25rem">
            ${esc(d.name || d.cat)}
          </h2>
          <div class="t-micro" style="color:rgba(245,245,247,0.7);margin-top:0.3rem">
            Order Qty: <span class="fig">${grp(qty)} pcs</span> · Target MRP: <span class="fig">${
    mrpVal > 0 ? money(mrpVal) : "Not set"
  }</span>
          </div>
        </div>
        <div class="row wrap" style="gap:1.75rem">
          <div>
            <div class="caps" style="color:var(--gold)">Factory Landing / pc</div>
            <div class="fig" style="font-size:1.85rem;font-weight:600;color:#fff">${moneyDec(res.landing)}</div>
          </div>
          <div>
            <div class="caps" style="color:rgba(245,245,247,0.6)">Style Total (${grp(qty)} pcs)</div>
            <div class="fig" style="font-size:1.35rem;font-weight:500;color:#fff">${money(res.landing * qty)}</div>
          </div>
          ${
            marginPct !== null
              ? `<div>
                   <div class="caps" style="color:rgba(245,245,247,0.6)">Gross Margin / Markup</div>
                   <div class="fig" style="font-size:1.35rem;font-weight:600;color:var(--gold)">${marginPct}% · ${markup}×</div>
                 </div>`
              : ""
          }
        </div>
      </div>
    </div>
  </div>

  <div class="g2" style="align-items:start">
    <!-- A. Fabric -->
    <div class="panel">
      <div class="p-head">
        <h3>A · Fabric</h3>
        <span class="fig semi">${moneyDec(res.fabric)}</span>
      </div>
      <div class="p-body">
        <div class="g2" style="gap:0.75rem">
          ${fld("Consumption (m or kg)", c.fab.cons, `data-cost="${esc(d.id)}:fab.cons" inputmode="decimal"`, "1.85")}
          ${fld("Rate per unit (₹)", c.fab.rate, `data-cost="${esc(d.id)}:fab.rate" inputmode="decimal"`, "240")}
          ${fld("Wastage (%)", c.fab.waste, `data-cost="${esc(d.id)}:fab.waste" inputmode="decimal"`, "5")}
          ${fld("Shrinkage (%)", c.fab.shrink, `data-cost="${esc(d.id)}:fab.shrink" inputmode="decimal"`, "3")}
        </div>
      </div>
    </div>

    <!-- D. Cutting & E. Stitching -->
    <div class="stack">
      <div class="panel">
        <div class="p-head">
          <h3>D · Cutting</h3>
          <span class="fig semi">${moneyDec(res.cut)}</span>
        </div>
        <div class="p-body">
          <div class="g3" style="gap:0.65rem">
            ${fld("Marker / CAD (₹)", c.cut.marker, `data-cost="${esc(d.id)}:cut.marker" inputmode="decimal"`, "0")}
            ${fld("Cutting Labour (₹)", c.cut.labour, `data-cost="${esc(d.id)}:cut.labour" inputmode="decimal"`, "0")}
            ${fld("Bundling (₹)", c.cut.bundle, `data-cost="${esc(d.id)}:cut.bundle" inputmode="decimal"`, "0")}
          </div>
        </div>
      </div>

      <div class="panel">
        <div class="p-head">
          <h3>E · Stitching</h3>
          <span class="fig semi">${moneyDec(res.stitch)}</span>
        </div>
        <div class="p-body">
          <div class="chiprow" style="margin-bottom:0.75rem">
            <button class="chip" aria-pressed="${c.stitch.mode !== "flat"}" data-cost-mode="${esc(d.id)}:stitch:sam">SAM × Rate / Eff%</button>
            <button class="chip" aria-pressed="${c.stitch.mode === "flat"}" data-cost-mode="${esc(d.id)}:stitch:flat">Flat CMT Rate</button>
          </div>
          ${
            c.stitch.mode === "flat"
              ? fld("Flat Stitching Rate (₹/pc)", c.stitch.flat, `data-cost="${esc(d.id)}:stitch.flat" inputmode="decimal"`, "145")
              : `<div class="g3" style="gap:0.65rem">
                   ${fld("SAM (mins)", c.stitch.sam, `data-cost="${esc(d.id)}:stitch.sam" inputmode="decimal"`, "24")}
                   ${fld("Minute Rate (₹)", c.stitch.rate, `data-cost="${esc(d.id)}:stitch.rate" inputmode="decimal"`, "4.5")}
                   ${fld("Line Eff (%)", c.stitch.eff, `data-cost="${esc(d.id)}:stitch.eff" inputmode="decimal"`, "65")}
                 </div>`
          }
        </div>
      </div>
    </div>

    <!-- B. Trims -->
    <div class="panel">
      <div class="p-head">
        <h3>B · Trims</h3>
        <span class="fig semi">${moneyDec(res.trims)}</span>
      </div>
      <div class="p-body flush">
        <table class="t">
          <thead><tr><th>Trim Item</th><th data-n>Qty</th><th data-n>Rate (₹)</th><th data-n>Amount</th></tr></thead>
          <tbody>
            ${TRIM_ROWS.map((row) => {
              const t = c.trims[row] || { qty: "", rate: "" };
              const amt = num(t.qty) * num(t.rate);
              return `<tr>
                <td class="t-micro">${esc(row)}</td>
                <td data-n><input class="inp" style="width:68px;padding:0.28rem 0.4rem;text-align:right" value="${esc(
                  t.qty
                )}" data-trim="${esc(d.id)}:${esc(row)}:qty" inputmode="decimal" placeholder="0" /></td>
                <td data-n><input class="inp" style="width:76px;padding:0.28rem 0.4rem;text-align:right" value="${esc(
                  t.rate
                )}" data-trim="${esc(d.id)}:${esc(row)}:rate" inputmode="decimal" placeholder="0" /></td>
                <td data-n class="t-micro">${amt > 0 ? moneyDec(amt) : "—"}</td>
              </tr>`;
            }).join("")}
          </tbody>
        </table>
      </div>
    </div>

    <!-- C. Processing + F/G/H/I -->
    <div class="stack">
      <div class="panel">
        <div class="p-head">
          <h3>C · Processing &amp; Washes</h3>
          <span class="fig semi">${moneyDec(res.proc)}</span>
        </div>
        <div class="p-body">
          <div class="g3" style="gap:0.65rem">
            ${PROC_ROWS.map((p) =>
              fld(p, c.proc[p] || "", `data-proc="${esc(d.id)}:${esc(p)}" inputmode="decimal"`, "₹0")
            ).join("")}
          </div>
        </div>
      </div>

      <div class="panel">
        <div class="p-head">
          <h3>F · Finishing &amp; H · Packing</h3>
          <span class="fig semi">${moneyDec(res.fin + res.pack)}</span>
        </div>
        <div class="p-body">
          <div class="g3" style="gap:0.65rem">
            ${fld("Thread trim (₹)", c.fin.trim, `data-cost="${esc(d.id)}:fin.trim" inputmode="decimal"`, "0")}
            ${fld("Steam / Iron (₹)", c.fin.iron, `data-cost="${esc(d.id)}:fin.iron" inputmode="decimal"`, "0")}
            ${fld("Button / Fold (₹)", c.fin.fold, `data-cost="${esc(d.id)}:fin.fold" inputmode="decimal"`, "0")}
            ${fld("Polybag (₹)", c.pack.poly, `data-cost="${esc(d.id)}:pack.poly" inputmode="decimal"`, "0")}
            ${fld("Tissue / Sticker (₹)", c.pack.tissue, `data-cost="${esc(d.id)}:pack.tissue" inputmode="decimal"`, "0")}
            ${fld("Carton share (₹)", c.pack.carton, `data-cost="${esc(d.id)}:pack.carton" inputmode="decimal"`, "0")}
          </div>
        </div>
      </div>

      <div class="panel">
        <div class="p-head">
          <h3>G · Quality Control &amp; I · Overhead</h3>
          <span class="fig semi">${moneyDec(res.qc + res.oh + res.rejAdd)}</span>
        </div>
        <div class="p-body">
          <div class="g3" style="gap:0.65rem">
            ${fld("QC Inspection (₹)", c.qc.final, `data-cost="${esc(d.id)}:qc.final" inputmode="decimal"`, "0")}
            ${fld("Rejection Buffer (%)", c.qc.reject, `data-cost="${esc(d.id)}:qc.reject" inputmode="decimal"`, "2")}
            ${fld("Factory Overhead (₹)", c.oh.perpiece, `data-cost="${esc(d.id)}:oh.perpiece" inputmode="decimal"`, "0")}
          </div>
        </div>
      </div>
    </div>
  </div>
  `;
}
