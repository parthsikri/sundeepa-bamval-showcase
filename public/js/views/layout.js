import { esc, grp, rollup, completion, MARK } from "../utils.js";

export const PUBLIC_NAV = [
  ["showcase", "The Showcase"],
  ["brand", "The Atelier"],
  ["overview", "Collections"],
];

export const ADMIN_NAV = [
  ["showcase", "The Showcase"],
  ["overview", "Overview"],
  ["brand", "Brand Presence"],
  ["inventory", "Inventory Plan"],
  ["costing", "Product Costing"],
  ["inquiries", "Inquiries"],
  ["settings", "Studio Setup"],
];

export function renderPublicHeader(state) {
  const { db, page } = state;
  const brandName = db.brand?.name || "Sundeepa Bamval";

  return `<header class="pub-header">
    <div class="pub-header-in">
      <button type="button" class="pub-brand" data-go="showcase">
        <span class="pub-mark">
          ${db.logo ? `<img src="${esc(db.logo)}" alt="${esc(brandName)}" />` : MARK(22)}
        </span>
        <span class="pub-wordmark">${esc(brandName)}</span>
      </button>

      <nav class="pub-nav" aria-label="Primary navigation">
        ${PUBLIC_NAV.map(
          ([key, label]) => `
          <button type="button" class="pub-link" data-go="${key}" aria-current="${page === key}">
            ${esc(label)}
          </button>`
        ).join("")}
      </nav>

      <div class="pub-actions">
        <button type="button" class="btn btn-primary btn-sm" data-open-inquiry="1">Inquire / Book</button>
      </div>
    </div>
  </header>`;
}

export function renderPublicFooter(state) {
  const { db } = state;
  const b = db.brand || {};
  const brandName = b.name || "Sundeepa Bamval";
  const loc = b.contact?.location || "";

  return `<footer class="pub-footer">
    <div class="pub-footer-in">
      <div>
        <div class="pub-footer-brand">${esc(brandName)}</div>
        <div class="t-micro muted">${esc(b.subtitle || "Fashion Design Atelier")}${loc ? ` · ${esc(loc)}` : ""}</div>
      </div>
      <div class="row wrap" style="gap:1rem">
        ${PUBLIC_NAV.map(
          ([key, label]) => `<button type="button" class="pub-foot-link" data-go="${key}">${esc(label)}</button>`
        ).join("")}
        <button type="button" class="pub-foot-link" style="color:var(--accent)" data-open-inquiry="1">Inquire / Book</button>
      </div>
    </div>
  </footer>`;
}

export function renderSidebar(state) {
  const { db, page } = state;
  const pct = completion(db.designs);
  const r = rollup(db.designs);
  const brandName = db.brand?.name || "Sundeepa Bamval";
  const unreadInq = (db.inquiries || []).filter((x) => x.status === "New").length;

  return `<aside class="sb">
    <div class="sb-brand">
      <div class="sb-mark">${MARK(22)}</div>
      <div style="min-width:0">
        <div class="sb-name" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(brandName)}</div>
        <div class="sb-sub">Admin Studio</div>
      </div>
    </div>

    <nav class="sb-nav" aria-label="Admin navigation">
      <div class="sb-section-label">Studio</div>
      ${ADMIN_NAV.map(
        ([key, label], i) => `
        <button class="s-link" data-go="${key}" aria-current="${page === key}">
          <span class="s-num">${String(i + 1).padStart(2, "0")}</span>
          <span class="s-txt">${esc(label)}</span>
          ${key === "showcase" ? `<span class="s-badge">${r.designs}</span>` : ""}
          ${key === "inquiries" && unreadInq > 0 ? `<span class="s-badge" style="background:var(--accent);color:#fff">${unreadInq}</span>` : ""}
        </button>`
      ).join("")}
    </nav>

    ${
      r.designs > 0
        ? `<div class="sb-progress">
             <div class="sb-progress-top">
               <span>Brief Completion</span>
               <span class="fig semi">${pct}%</span>
             </div>
             <div class="sb-progress-bar">
               <div class="sb-progress-fill" style="width:${pct}%"></div>
             </div>
           </div>`
        : ""
    }

    <div class="sb-foot">
      <button class="sb-fb" data-export="json" title="Download full JSON backup">Backup</button>
      <button class="sb-fb" data-import="1" title="Restore from JSON backup">Restore</button>
      <button class="sb-fb" data-print="1" title="Print current view">Print</button>
    </div>
  </aside>`;
}

export function renderTopbar(state) {
  const { db, page, sync } = state;
  const cur = ADMIN_NAV.find((n) => n[0] === page);
  const brandName = db.brand?.name || "Sundeepa Bamval";

  return `<header class="topbar">
    <div class="crumbs">
      <span>${esc(brandName)}</span>
      <span class="faint">/</span>
      <b>${esc(cur ? cur[1] : "The Showcase")}</b>
    </div>
    <span class="spacer"></span>

    <span class="tagP" style="letter-spacing:0.09em">ADMIN</span>
    <span class="sync-pill ${sync.status === "saving" ? "saving" : sync.status === "error" ? "error" : ""}" id="syncPill">
      <span class="sync-dot"></span>
      <span>${esc(sync.text)}</span>
    </span>
    <a href="/#showcase" class="btn btn-sm" style="text-decoration:none">Public View ↗</a>
    <button class="btn btn-sm" data-logout="1">Sign Out</button>

    <div class="logoslot">
      <label class="logobox${db.logo ? " filled" : ""}" title="Upload custom brand logo">
        ${
          db.logo
            ? `<img src="${esc(db.logo)}" alt="${esc(brandName)}" />`
            : `<span style="background:var(--dark);width:100%;height:100%;display:grid;place-items:center">${MARK(18)}</span>`
        }
        <input type="file" accept="image/*" data-logo="1" hidden />
      </label>
      ${db.logo ? `<button class="btn btn-sm btn-icon" data-logox="1" title="Remove logo">✕</button>` : ""}
    </div>
  </header>`;
}
