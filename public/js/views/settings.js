import { esc, blk } from "../utils.js";

export function renderSettings(state) {
  const { db, constants, isAdmin } = state;
  if (!isAdmin) {
    return `<div class="ph"><h1>Studio Setup</h1><p class="sub">Admin access required.</p></div>`;
  }

  const { SETNAME } = constants;
  const categories = db.categories || [];
  const phases = db.phases || [];

  return `
  <div class="ph">
    <div class="ph-eyebrow">Admin Configuration</div>
    <h1>Studio Setup</h1>
    <p class="sub">
      Define your own categories, collections/drops, and manage studio backups. Nothing is hardcoded — everything here drives the live showcase.
    </p>
  </div>

  <div class="g2" style="align-items:start">
    <!-- Categories Manager -->
    <div class="panel">
      <div class="p-head">
        <h3>Categories</h3>
        <span class="tagM">${categories.length}</span>
      </div>
      <div class="p-body">
        <form id="addCategoryForm" class="stack-s" style="margin-bottom:1rem">
          <div class="g2" style="gap:0.55rem">
            <input class="inp" id="newCatName" placeholder="e.g. Resortwear, Festive, Prints" required />
            <select class="inp" id="newCatSize">
              ${Object.entries(SETNAME)
                .map(([k, label]) => `<option value="${esc(k)}">${esc(label)}</option>`)
                .join("")}
            </select>
          </div>
          <button type="submit" class="btn btn-primary btn-sm" style="align-self:flex-start">+ Add Category</button>
        </form>

        ${
          categories.length
            ? `<div class="stack-s">
                 ${categories
                   .map(
                     (c) => `
                   <div class="row-between" style="padding:0.55rem 0.75rem;border:1px solid var(--line);border-radius:9px;background:var(--bg)">
                     <div>
                       <div class="semi" style="font-size:0.86rem">${esc(c.name)}</div>
                       <div class="t-micro faint">${esc(SETNAME[c.sizeSet] || c.sizeSet)}</div>
                     </div>
                     <button type="button" class="btn btn-sm btn-danger" data-del-cat="${esc(c.id)}">Remove</button>
                   </div>`
                   )
                   .join("")}
               </div>`
            : `<p class="t-micro muted" style="margin:0">No categories yet. Add one above or type a category name directly while uploading designs.</p>`
        }
      </div>
    </div>

    <!-- Collections / Drops Manager -->
    <div class="panel">
      <div class="p-head">
        <h3>Collections / Drops</h3>
        <span class="tagP">${phases.length}</span>
      </div>
      <div class="p-body">
        <form id="addPhaseForm" class="stack-s" style="margin-bottom:1rem">
          <div class="g2" style="gap:0.55rem">
            <input class="inp" id="newPhaseName" placeholder="e.g. Resort '26, Festive Edit" required />
            <input class="inp" id="newPhaseNo" placeholder="Label / No (e.g. 01)" />
          </div>
          <input class="inp" id="newPhaseObj" placeholder="Short story or objective (optional)" />
          <button type="submit" class="btn btn-primary btn-sm" style="align-self:flex-start">+ Add Collection</button>
        </form>

        ${
          phases.length
            ? `<div class="stack-s">
                 ${phases
                   .map(
                     (p) => `
                   <div class="row-between" style="padding:0.55rem 0.75rem;border:1px solid var(--line);border-radius:9px;background:var(--bg)">
                     <div>
                       <div class="semi" style="font-size:0.86rem">${esc(p.name)}</div>
                       ${p.obj ? `<div class="t-micro faint">${esc(p.obj)}</div>` : ""}
                     </div>
                     <button type="button" class="btn btn-sm btn-danger" data-del-phase="${esc(p.id)}">Remove</button>
                   </div>`
                   )
                   .join("")}
               </div>`
            : `<p class="t-micro muted" style="margin:0">No collections created yet. Create seasonal drops or capsules above to organize your showcase.</p>`
        }
      </div>
    </div>
  </div>

  ${blk("Brand Presence & Data", "Quick actions")}
  <div class="panel">
    <div class="p-body row wrap" style="gap:0.75rem">
      <button class="btn btn-sm" data-go="brand">Edit Brand Presence →</button>
      <button class="btn btn-sm" data-export="json">Download JSON Backup</button>
      <button class="btn btn-sm" data-import="1">Restore JSON Backup</button>
      <button class="btn btn-sm" data-export="csv">Export Inventory CSV</button>
    </div>
  </div>
  `;
}
