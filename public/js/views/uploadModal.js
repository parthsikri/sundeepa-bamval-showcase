import { esc } from "../utils.js";

export function parseNameFromFilename(filename) {
  const base = String(filename || "")
    .replace(/\.[^/.]+$/, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!base) return "Untitled Design";
  return base.replace(/\b\w/g, (ch) => ch.toUpperCase());
}

export function renderUploadModal(state) {
  const { uploadModal, db } = state;
  if (!uploadModal || !uploadModal.open) return "";

  const categories = (db.categories || []).map((c) => c.name);
  const phases = db.phases || [];
  const isBulk = uploadModal.mode === "bulk";
  const items = uploadModal.items || [];
  const busy = Boolean(uploadModal.busy);

  return `<div class="modal-backdrop" id="uploadModalBackdrop" role="dialog" aria-modal="true" aria-label="${
    isBulk ? "Bulk Upload Designs" : "Upload Single Design"
  }">
    <div class="modal-card ${isBulk ? "modal-lg" : ""}">
      <div class="modal-head">
        <div>
          <div class="caps" style="color:var(--gold-ink)">${isBulk ? "Batch Studio Importer" : "Single Design Upload"}</div>
          <h2 style="font-family:var(--font-serif);font-weight:400;font-size:1.35rem;margin-top:2px">
            ${isBulk ? "Bulk Upload Images" : "Upload New Design"}
          </h2>
        </div>
        <button type="button" class="btn btn-sm btn-icon" data-modal-close="1" ${busy ? "disabled" : ""}>✕</button>
      </div>

      <div class="modal-body">
        <datalist id="uploadCatList">
          ${categories.map((c) => `<option value="${esc(c)}"></option>`).join("")}
        </datalist>

        <!-- Default Settings Row -->
        <div class="g4" style="gap:0.7rem;margin-bottom:1rem">
          <label class="fld">
            <span>${isBulk ? "Default Category" : "Category"}</span>
            <input
              class="inp"
              list="uploadCatList"
              value="${esc(uploadModal.cat)}"
              data-um-def="cat"
              placeholder="Type or select…"
            />
          </label>
          <label class="fld">
            <span>${isBulk ? "Default Collection" : "Collection"}</span>
            <select class="inp" data-um-def="phase">
              <option value="">None</option>
              ${phases
                .map((p) => `<option value="${esc(p.id)}" ${uploadModal.phase === p.id ? "selected" : ""}>${esc(p.name)}</option>`)
                .join("")}
            </select>
          </label>
          <label class="fld">
            <span>Colourways</span>
            <input class="inp" inputmode="numeric" value="${esc(uploadModal.colours)}" data-um-def="colours" placeholder="1" />
          </label>
          <label class="fld">
            <span>Target MRP (₹)</span>
            <input class="inp" inputmode="numeric" value="${esc(uploadModal.mrp)}" data-um-def="mrp" placeholder="Optional" />
          </label>
        </div>

        <!-- Dropzone -->
        <label class="bulk-dropzone" id="bulkDropzone">
          <div class="bulk-drop-icon">↑</div>
          <div class="semi" style="font-size:0.95rem;color:var(--ink)">
            ${isBulk ? "Drop multiple images here or click to browse" : "Drop an image here or click to browse"}
          </div>
          <div class="t-micro muted" style="margin-top:0.2rem">
            Design names are automatically taken from each image's filename (editable below before uploading).
          </div>
          <input
            type="file"
            accept="image/*"
            ${isBulk ? "multiple" : ""}
            data-um-files="1"
            hidden
          />
        </label>

        <!-- Preview Queue -->
        ${
          items.length > 0
            ? `<div style="margin-top:1.1rem">
                 <div class="row-between" style="margin-bottom:0.55rem">
                   <span class="caps">${items.length} ${items.length === 1 ? "image" : "images"} ready to upload</span>
                   ${
                     isBulk && items.length > 1
                       ? `<button type="button" class="btn btn-sm" data-um-apply-defs="1">Apply defaults to all rows</button>`
                       : ""
                   }
                 </div>
                 <div class="bulk-list">
                   ${items
                     .map(
                       (it, idx) => `
                     <div class="bulk-row">
                       <img class="bulk-thumb" src="${esc(it.previewUrl)}" alt="" />
                       <div class="bulk-fields">
                         <div class="t-micro faint" style="margin-bottom:0.25rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">
                           File: ${esc(it.file.name)}
                         </div>
                         <div class="g2" style="gap:0.5rem">
                           <input
                             class="inp"
                             style="padding:0.38rem 0.6rem;font-size:0.82rem"
                             value="${esc(it.name)}"
                             data-um-item="${idx}:name"
                             placeholder="Design name"
                           />
                           <input
                             class="inp"
                             list="uploadCatList"
                             style="padding:0.38rem 0.6rem;font-size:0.82rem"
                             value="${esc(it.cat)}"
                             data-um-item="${idx}:cat"
                             placeholder="Category (optional)"
                           />
                         </div>
                       </div>
                       <button type="button" class="btn btn-sm btn-icon btn-danger" data-um-remove="${idx}" title="Remove">✕</button>
                     </div>`
                     )
                     .join("")}
                 </div>
               </div>`
            : ""
        }
      </div>

      <div class="modal-foot">
        <button type="button" class="btn btn-sm" data-modal-close="1" ${busy ? "disabled" : ""}>Cancel</button>
        <button
          type="button"
          class="btn btn-primary"
          data-um-submit="1"
          ${items.length === 0 || busy ? "disabled" : ""}
        >
          ${busy ? "Uploading…" : isBulk ? `Upload & Create ${items.length} ${items.length === 1 ? "Design" : "Designs"}` : "Upload & Create Design"}
        </button>
      </div>
    </div>
  </div>`;
}
