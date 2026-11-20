import * as api from "./api.js";
import { esc, num, ensureCost, toast } from "./utils.js";
import { renderPublicHeader, renderPublicFooter, renderSidebar, renderTopbar } from "./views/layout.js";
import { renderShowcase, getFilteredDesigns } from "./views/showcase.js";
import { renderOverview } from "./views/overview.js";
import { renderBrand } from "./views/brand.js";
import { renderInventory } from "./views/inventory.js";
import { renderCosting } from "./views/costing.js";
import { renderInquiries } from "./views/inquiries.js";
import { renderSettings } from "./views/settings.js";
import { renderAdminGate } from "./views/adminGate.js";
import { renderInquiryModal } from "./views/inquiryModal.js";
import { parseNameFromFilename } from "./views/uploadModal.js";

const PAGES = {
  showcase: renderShowcase,
  overview: renderOverview,
  brand: renderBrand,
  inventory: renderInventory,
  costing: renderCosting,
  inquiries: renderInquiries,
  settings: renderSettings,
};

const isAdminRoute = () => window.location.pathname.replace(/\/+$/, "").toLowerCase() === "/admin";

const state = {
  db: null,
  constants: null,
  isAdminRoute: isAdminRoute(),
  isAdmin: false,
  authError: "",
  page: "showcase",
  navOpen: false,
  costStyleId: null,
  sync: { status: "ok", text: "Synced" },
  sc: {
    cat: "all",
    phase: "all",
    query: "",
    sort: "default",
    view: "editorial",
    open: null,
    activeSlot: "",
  },
  uploadModal: {
    open: false,
    mode: "single",
    cat: "",
    phase: "",
    colours: "1",
    mrp: "",
    items: [],
    busy: false,
  },
  inquiryModal: {
    open: false,
    design: null,
    busy: false,
    sent: false,
  },
};

api.onSyncChange((status, text) => {
  state.sync = { status, text };
  const pill = document.getElementById("syncPill");
  if (pill) {
    pill.className = `sync-pill ${status === "saving" ? "saving" : status === "error" ? "error" : ""}`;
    pill.innerHTML = `<span class="sync-dot"></span><span>${esc(text)}</span>`;
  }
});

// Debounced PATCH queue per design ID
const saveTimers = new Map();
const pendingPatches = new Map();

function queueDesignSave(designId, patch, rerenderAfter = false) {
  if (!state.isAdmin) return;
  const prev = pendingPatches.get(designId) || {};
  const merged = mergePatch(prev, patch);
  pendingPatches.set(designId, merged);

  clearTimeout(saveTimers.get(designId));
  saveTimers.set(
    designId,
    setTimeout(async () => {
      const payload = pendingPatches.get(designId);
      pendingPatches.delete(designId);
      saveTimers.delete(designId);
      if (!payload) return;
      try {
        const res = await api.patchDesign(designId, payload);
        const updated = res.design || res;
        const idx = state.db.designs.findIndex((d) => d.id === designId);
        if (idx !== -1) state.db.designs[idx] = updated;
        if (rerenderAfter) render();
      } catch (err) {
        toast(err.message || "Failed to save changes");
      }
    }, 320)
  );
}

// Debounced Brand Presence save
let brandTimer = null;
function queueBrandSave() {
  if (!state.isAdmin) return;
  clearTimeout(brandTimer);
  brandTimer = setTimeout(async () => {
    try {
      const saved = await api.patchBrand(state.db.brand);
      state.db.brand = saved;
      document.title = `${saved.name || "Sundeepa Bamval"} — ${saved.subtitle || "Design Showcase"}`;
    } catch (err) {
      toast(err.message || "Failed to save brand");
    }
  }, 380);
}

function mergePatch(a, b) {
  const out = { ...a };
  for (const [k, v] of Object.entries(b)) {
    if (v && typeof v === "object" && !Array.isArray(v) && out[k] && typeof out[k] === "object") {
      out[k] = mergePatch(out[k], v);
    } else {
      out[k] = v;
    }
  }
  return out;
}

function getPageFromHash() {
  const raw = location.hash.replace(/^#/, "").trim().toLowerCase();
  return PAGES[raw] ? raw : "showcase";
}

function go(page) {
  if (!PAGES[page]) page = "showcase";
  if ((page === "settings" || page === "inquiries" || page === "inventory" || page === "costing") && !state.isAdmin) {
    page = "showcase";
  }
  state.page = page;
  state.navOpen = false;
  state.sc.open = null;
  state.sc.activeSlot = "";
  if (location.hash.slice(1) !== page) {
    history.replaceState(null, "", `${window.location.pathname}#${page}`);
  }
  render();
  window.scrollTo({ top: 0, behavior: "instant" });
}

function clearUploadModalPreviews() {
  for (const it of state.uploadModal.items || []) {
    if (it.previewUrl) URL.revokeObjectURL(it.previewUrl);
  }
  state.uploadModal.items = [];
}

function openUploadModal(mode) {
  clearUploadModalPreviews();
  const defaultCat = state.sc.cat !== "all" ? state.sc.cat : "";
  const defaultPhase = state.sc.phase !== "all" ? state.sc.phase : "";
  state.uploadModal = {
    open: true,
    mode,
    cat: defaultCat,
    phase: defaultPhase,
    colours: "1",
    mrp: "",
    items: [],
    busy: false,
  };
  render();
}

function closeUploadModal() {
  clearUploadModalPreviews();
  state.uploadModal.open = false;
  state.uploadModal.busy = false;
  render();
}

function addFilesToUploadModal(fileList) {
  const files = [...(fileList || [])].filter((f) => f.type && f.type.startsWith("image/"));
  if (!files.length) {
    toast("Please select image files");
    return;
  }
  const um = state.uploadModal;
  if (um.mode === "single") {
    clearUploadModalPreviews();
    const f = files[0];
    um.items = [
      {
        file: f,
        previewUrl: URL.createObjectURL(f),
        name: parseNameFromFilename(f.name),
        cat: um.cat,
        phase: um.phase,
        mrp: um.mrp,
        colours: um.colours,
      },
    ];
  } else {
    for (const f of files) {
      um.items.push({
        file: f,
        previewUrl: URL.createObjectURL(f),
        name: parseNameFromFilename(f.name),
        cat: um.cat,
        phase: um.phase,
        mrp: um.mrp,
        colours: um.colours,
      });
    }
  }
  render();
}

function openLightbox(src, caption = "") {
  const lb = document.getElementById("lightbox");
  if (!lb) return;
  lb.innerHTML = `
    <div class="lightbox-inner">
      <img src="${esc(src)}" alt="${esc(caption)}" />
      <div class="lightbox-cap">
        <span>${esc(caption)}</span>
        <button class="btn btn-sm" data-lb-close="1" style="background:rgba(255,255,255,0.14);border-color:rgba(255,255,255,0.28);color:#fff">Close (Esc)</button>
      </div>
    </div>`;
  lb.classList.add("on");
  lb.setAttribute("aria-hidden", "false");
}

function closeLightbox() {
  const lb = document.getElementById("lightbox");
  if (!lb) return;
  lb.classList.remove("on");
  lb.setAttribute("aria-hidden", "true");
  lb.innerHTML = "";
}

function render() {
  const root = document.getElementById("root");

  if (state.isAdminRoute && !state.isAdmin) {
    document.body.classList.add("is-public");
    root.innerHTML = renderAdminGate(state);
    document.body.classList.remove("nav-on");
    document.body.style.overflow = "";
    return;
  }

  if (!state.db) return;
  const b = state.db.brand || {};
  document.title = `${b.name || "Sundeepa Bamval"} — ${b.subtitle || "Design Showcase"}`;

  const pageFn = PAGES[state.page] || renderShowcase;

  if (state.isAdmin) {
    document.body.classList.remove("is-public");
    root.innerHTML = `${renderSidebar(state)}<div class="app">${renderTopbar(state)}<main>${pageFn(state)}</main></div>`;
  } else {
    document.body.classList.add("is-public");
    root.innerHTML = `<div class="pub-shell">${renderPublicHeader(state)}<main class="pub-main">${pageFn(
      state
    )}</main>${renderPublicFooter(state)}${renderInquiryModal(state)}</div>`;
  }

  document.body.classList.toggle("nav-on", state.navOpen);
  document.body.style.overflow = state.sc.open || state.uploadModal.open || state.inquiryModal.open ? "hidden" : "";
}

// ==========================================================================
// Form Submits (Admin Login, Add Category, Add Collection)
// ==========================================================================

document.addEventListener("submit", async (e) => {
  if (e.target.id === "adminLoginForm") {
    e.preventDefault();
    const input = document.getElementById("adminPasswordInput");
    const pw = input ? input.value : "";
    try {
      await api.loginAdmin(pw);
      state.isAdmin = true;
      state.authError = "";
      const data = await api.fetchState();
      state.db = data.db;
      state.constants = data.constants;
      render();
      toast("Admin Studio unlocked");
    } catch (err) {
      state.authError = err.message || "Incorrect password";
      render();
    }
    return;
  }

  if (e.target.id === "addCategoryForm" && state.isAdmin) {
    e.preventDefault();
    const name = document.getElementById("newCatName")?.value.trim();
    const sizeSet = document.getElementById("newCatSize")?.value || "top";
    if (!name) return;
    try {
      const cat = await api.createCategory({ name, sizeSet });
      state.db.categories.push(cat);
      render();
      toast(`Category "${cat.name}" added`);
    } catch (err) {
      toast(err.message);
    }
    return;
  }

  if (e.target.id === "inquiryForm") {
    e.preventDefault();
    const form = e.target;
    const fd = new FormData(form);
    const linked = state.inquiryModal.design;
    state.inquiryModal.busy = true;
    render();
    try {
      await api.submitInquiry({
        name: fd.get("name"),
        company: fd.get("company"),
        email: fd.get("email"),
        phone: fd.get("phone"),
        message: fd.get("message"),
        designId: linked?.id || "",
        designCode: linked?.code || "",
        designName: linked?.name || linked?.cat || "",
      });
      state.inquiryModal.busy = false;
      state.inquiryModal.sent = true;
      render();
      toast("Inquiry sent to studio");
    } catch (err) {
      state.inquiryModal.busy = false;
      render();
      toast(err.message || "Could not send inquiry");
    }
    return;
  }

  if (e.target.id === "addPhaseForm" && state.isAdmin) {
    e.preventDefault();
    const name = document.getElementById("newPhaseName")?.value.trim();
    const no = document.getElementById("newPhaseNo")?.value.trim();
    const obj = document.getElementById("newPhaseObj")?.value.trim();
    if (!name) return;
    try {
      const phase = await api.createPhase({ name, no, obj });
      state.db.phases.push(phase);
      render();
      toast(`Collection "${phase.name}" added`);
    } catch (err) {
      toast(err.message);
    }
  }
});

// ==========================================================================
// Click Delegation
// ==========================================================================

document.addEventListener("click", async (e) => {
  const t = e.target;

  if (t.closest("#navToggle")) {
    state.navOpen = !state.navOpen;
    document.body.classList.toggle("nav-on", state.navOpen);
    return;
  }
  if (t.closest("#navScrim")) {
    state.navOpen = false;
    document.body.classList.remove("nav-on");
    return;
  }

  if (t.closest("[data-logout]")) {
    api.clearToken();
    state.isAdmin = false;
    state.sc.open = null;
    closeUploadModal();
    render();
    toast("Signed out");
    return;
  }

  if (t.closest("[data-lb-close]") || (t.id === "lightbox" && t.classList.contains("on"))) {
    closeLightbox();
    return;
  }

  const zoomBtn = t.closest("[data-zoom]");
  if (zoomBtn) {
    e.preventDefault();
    e.stopPropagation();
    openLightbox(zoomBtn.dataset.zoom, zoomBtn.dataset.zoomCap || "");
    return;
  }

  // Open / Close Client Inquiry Modal
  const openInq = t.closest("[data-open-inquiry]");
  if (openInq) {
    const val = openInq.dataset.openInquiry;
    const linkedDesign = val && val !== "1" ? (state.db.designs || []).find((d) => d.id === val) : null;
    state.inquiryModal = { open: true, design: linkedDesign, busy: false, sent: false };
    render();
    return;
  }

  if (t.closest("[data-inq-close]") || (t.id === "inquiryModalBackdrop" && !state.inquiryModal.busy)) {
    state.inquiryModal = { open: false, design: null, busy: false, sent: false };
    render();
    return;
  }

  // Delete Inquiry (Admin)
  const delInq = t.closest("[data-inq-del]");
  if (delInq && state.isAdmin) {
    try {
      const id = delInq.dataset.inqDel;
      await api.deleteInquiry(id);
      state.db.inquiries = (state.db.inquiries || []).filter((x) => x.id !== id);
      render();
      toast("Inquiry deleted");
    } catch (err) {
      toast(err.message);
    }
    return;
  }

  // Editorial / Archive view toggle
  const viewBtn = t.closest("[data-view]");
  if (viewBtn) {
    state.sc.view = viewBtn.dataset.view;
    render();
    return;
  }

  // Public Look Sheet thumbnail switcher
  const slotPick = t.closest("[data-slot-pick]");
  if (slotPick) {
    state.sc.activeSlot = slotPick.dataset.slotPick;
    render();
    return;
  }

  // Delete Atelier Cover Photo (Admin)
  if (t.closest("[data-cover-del]") && state.isAdmin) {
    try {
      await api.deleteBrandCover();
      state.db.brand.coverImage = "";
      render();
      toast("Cover photograph removed");
    } catch (err) {
      toast(err.message);
    }
    return;
  }

  // Delete Category / Collection
  const delCat = t.closest("[data-del-cat]");
  if (delCat && state.isAdmin) {
    try {
      const id = delCat.dataset.delCat;
      await api.deleteCategory(id);
      state.db.categories = state.db.categories.filter((c) => c.id !== id);
      render();
      toast("Category removed");
    } catch (err) {
      toast(err.message);
    }
    return;
  }

  const delPhase = t.closest("[data-del-phase]");
  if (delPhase && state.isAdmin) {
    try {
      const id = delPhase.dataset.delPhase;
      await api.deletePhase(id);
      state.db.phases = state.db.phases.filter((p) => p.id !== id);
      state.db.designs.forEach((d) => {
        if (d.phase === id) d.phase = "";
      });
      render();
      toast("Collection removed");
    } catch (err) {
      toast(err.message);
    }
    return;
  }

  // Brand Pillars & Palette Swatches
  if (t.closest("[data-add-pillar]") && state.isAdmin) {
    state.db.brand.pillars = state.db.brand.pillars || [];
    state.db.brand.pillars.push({ eyebrow: "", title: "", body: "" });
    render();
    queueBrandSave();
    return;
  }

  const delPillar = t.closest("[data-del-pillar]");
  if (delPillar && state.isAdmin) {
    state.db.brand.pillars.splice(Number(delPillar.dataset.delPillar), 1);
    render();
    queueBrandSave();
    return;
  }

  if (t.closest("[data-add-swatch]") && state.isAdmin) {
    state.db.brand.palette = state.db.brand.palette || [];
    state.db.brand.palette.push({ name: "", hex: "#1D1D1F", role: "" });
    render();
    queueBrandSave();
    return;
  }

  const delSwatch = t.closest("[data-del-swatch]");
  if (delSwatch && state.isAdmin) {
    state.db.brand.palette.splice(Number(delSwatch.dataset.delSwatch), 1);
    render();
    queueBrandSave();
    return;
  }

  // Open Single / Bulk Upload Modal
  const openUm = t.closest("[data-open-upload]");
  if (openUm && state.isAdmin) {
    openUploadModal(openUm.dataset.openUpload);
    return;
  }

  if (t.closest("[data-modal-close]") || (t.id === "uploadModalBackdrop" && !state.uploadModal.busy)) {
    closeUploadModal();
    return;
  }

  const rmUm = t.closest("[data-um-remove]");
  if (rmUm) {
    const idx = Number(rmUm.dataset.umRemove);
    const removed = state.uploadModal.items.splice(idx, 1)[0];
    if (removed?.previewUrl) URL.revokeObjectURL(removed.previewUrl);
    render();
    return;
  }

  if (t.closest("[data-um-apply-defs]")) {
    const um = state.uploadModal;
    um.items.forEach((it) => {
      it.cat = um.cat;
      it.phase = um.phase;
      it.mrp = um.mrp;
      it.colours = um.colours;
    });
    render();
    toast("Applied defaults to all queued images");
    return;
  }

  if (t.closest("[data-um-submit]") && state.isAdmin) {
    const um = state.uploadModal;
    if (!um.items.length || um.busy) return;
    um.busy = true;
    render();
    try {
      if (um.mode === "single") {
        const it = um.items[0];
        await api.uploadSingleStyle(it.file, {
          name: it.name,
          cat: it.cat,
          phase: um.phase,
          colours: um.colours,
          mrp: um.mrp,
        });
        const fresh = await api.fetchState();
        state.db = fresh.db;
        closeUploadModal();
        toast(`Uploaded "${it.name}"`);
      } else {
        const res = await api.bulkUploadStyles(um.items, {
          cat: um.cat,
          phase: um.phase,
          colours: um.colours,
          mrp: um.mrp,
        });
        const fresh = await api.fetchState();
        state.db = fresh.db;
        closeUploadModal();
        toast(`Bulk uploaded ${res.count} designs!`);
      }
    } catch (err) {
      um.busy = false;
      render();
      toast(err.message || "Upload failed");
    }
    return;
  }

  const shotDel = t.closest("[data-shotx]");
  if (shotDel && state.isAdmin) {
    e.preventDefault();
    e.stopPropagation();
    const [id, ...slotParts] = shotDel.dataset.shotx.split(":");
    const slot = slotParts.join(":");
    try {
      const updated = await api.deleteShot(id, slot);
      const idx = state.db.designs.findIndex((d) => d.id === id);
      if (idx !== -1) state.db.designs[idx] = updated;
      render();
      toast(`Removed ${slot} image`);
    } catch (err) {
      toast(err.message);
    }
    return;
  }

  if (t.closest("[data-logox]") && state.isAdmin) {
    e.preventDefault();
    try {
      await api.deleteLogo();
      state.db.logo = "";
      render();
      toast("Brand logo removed");
    } catch (err) {
      toast(err.message);
    }
    return;
  }

  const navBtn = t.closest("[data-go]");
  if (navBtn) {
    go(navBtn.dataset.go);
    return;
  }

  const dropJump = t.closest("[data-jump-drop]");
  if (dropJump) {
    state.sc.cat = "all";
    state.sc.phase = dropJump.dataset.jumpDrop;
    go("showcase");
    return;
  }

  const styleJump = t.closest("[data-jump-style]");
  if (styleJump) {
    state.page = "showcase";
    history.replaceState(null, "", `${window.location.pathname}#showcase`);
    state.sc.open = styleJump.dataset.jumpStyle;
    render();
    return;
  }

  const openCostBtn = t.closest("[data-open-costing]");
  if (openCostBtn) {
    state.costStyleId = openCostBtn.dataset.openCosting;
    go("costing");
    return;
  }

  const catChip = t.closest("[data-scc]");
  if (catChip) {
    state.sc.cat = catChip.dataset.scc;
    render();
    return;
  }

  const phaseChip = t.closest("[data-scp]");
  if (phaseChip) {
    state.sc.phase = phaseChip.dataset.scp;
    render();
    return;
  }

  if (t.closest("[data-clearfilters]")) {
    state.sc.cat = "all";
    state.sc.phase = "all";
    state.sc.query = "";
    render();
    return;
  }

  if (t.closest("[data-addstyle]") && state.isAdmin) {
    try {
      const payload = {};
      if (state.sc.cat !== "all") payload.cat = state.sc.cat;
      if (state.sc.phase !== "all") payload.phase = state.sc.phase;
      const created = await api.createDesign(payload);
      state.db.designs.unshift(created);
      state.sc.open = created.id;
      render();
      toast(`Created ${created.code}`);
    } catch (err) {
      toast(err.message);
    }
    return;
  }

  const openCard = t.closest("[data-open]");
  if (openCard) {
    state.sc.open = openCard.dataset.open;
    state.sc.activeSlot = "";
    render();
    return;
  }

  if (t.closest("[data-close]")) {
    state.sc.open = null;
    render();
    return;
  }

  const navStep = t.closest("[data-nav]");
  if (navStep && state.sc.open) {
    const dir = Number(navStep.dataset.nav);
    const list = getFilteredDesigns(state);
    const idx = list.findIndex((d) => d.id === state.sc.open);
    if (idx !== -1 && list.length > 1) {
      const nextIdx = (idx + dir + list.length) % list.length;
      state.sc.open = list[nextIdx].id;
      render();
    }
    return;
  }

  const dupBtn = t.closest("[data-dup]");
  if (dupBtn && state.isAdmin) {
    try {
      const copy = await api.duplicateDesign(dupBtn.dataset.dup);
      const idx = state.db.designs.findIndex((d) => d.id === dupBtn.dataset.dup);
      state.db.designs.splice(idx + 1, 0, copy);
      state.sc.open = copy.id;
      render();
      toast(`Duplicated as ${copy.code}`);
    } catch (err) {
      toast(err.message);
    }
    return;
  }

  const delBtn = t.closest("[data-del]");
  if (delBtn && state.isAdmin) {
    const id = delBtn.dataset.del;
    const d = state.db.designs.find((x) => x.id === id);
    if (!d) return;
    if (!confirm(`Delete ${d.code} (${d.name || d.cat || "Design"}) permanently?`)) return;
    try {
      await api.deleteDesign(id);
      state.db.designs = state.db.designs.filter((x) => x.id !== id);
      state.sc.open = null;
      render();
      toast(`Deleted ${d.code}`);
    } catch (err) {
      toast(err.message);
    }
    return;
  }

  const ssBtn = t.closest("[data-sizeset]");
  if (ssBtn && state.isAdmin) {
    const [id, sizeSet] = ssBtn.dataset.sizeset.split(":");
    try {
      const updated = await api.patchDesign(id, { sizeSet });
      const idx = state.db.designs.findIndex((d) => d.id === id);
      if (idx !== -1) state.db.designs[idx] = updated;
      render();
      toast("Size curve updated");
    } catch (err) {
      toast(err.message);
    }
    return;
  }

  const modeBtn = t.closest("[data-cost-mode]");
  if (modeBtn && state.isAdmin) {
    const [id, section, mode] = modeBtn.dataset.costMode.split(":");
    const d = state.db.designs.find((x) => x.id === id);
    if (d) {
      const c = ensureCost(d);
      c[section].mode = mode;
      render();
      queueDesignSave(id, { cost: { [section]: { mode } } });
    }
    return;
  }

  const copyBtn = t.closest("[data-copy]");
  if (copyBtn) {
    const hex = copyBtn.dataset.copy;
    navigator.clipboard?.writeText(hex).catch(() => {});
    toast(`Copied ${hex}`);
    return;
  }

  const expBtn = t.closest("[data-export]");
  if (expBtn) {
    const kind = expBtn.dataset.export;
    if (kind === "json" && state.isAdmin) {
      try {
        await api.downloadBackup();
        toast("JSON backup downloaded");
      } catch (err) {
        toast(err.message);
      }
    } else if (kind === "csv") {
      window.location.href = "/api/export/csv";
      toast("Downloading Inventory CSV…");
    }
    return;
  }

  if (t.closest("[data-import]") && state.isAdmin) {
    document.getElementById("importer")?.click();
    return;
  }

  if (t.closest("[data-print]")) {
    window.print();
    return;
  }
});

// ==========================================================================
// Input & Change Handlers
// ==========================================================================

document.addEventListener("input", (e) => {
  const t = e.target;

  if (t.dataset.search) {
    const pos = t.selectionStart;
    state.sc.query = t.value;
    render();
    const el = document.getElementById("showcaseSearch");
    if (el) {
      el.focus();
      el.setSelectionRange(pos, pos);
    }
    return;
  }

  if (t.dataset.umDef) {
    state.uploadModal[t.dataset.umDef] = t.value;
    return;
  }

  if (t.dataset.umItem) {
    const [idxStr, field] = t.dataset.umItem.split(":");
    const item = state.uploadModal.items[Number(idxStr)];
    if (item) item[field] = t.value;
    return;
  }

  if (!state.isAdmin) return;

  // Brand Presence fields
  if (t.dataset.brand) {
    state.db.brand[t.dataset.brand] = t.value;
    queueBrandSave();
    return;
  }

  if (t.dataset.contact) {
    state.db.brand.contact = state.db.brand.contact || {};
    state.db.brand.contact[t.dataset.contact] = t.value;
    queueBrandSave();
    return;
  }

  if (t.dataset.pillar) {
    const [idxStr, field] = t.dataset.pillar.split(":");
    const p = state.db.brand.pillars?.[Number(idxStr)];
    if (p) {
      p[field] = t.value;
      queueBrandSave();
    }
    return;
  }

  if (t.dataset.swatch) {
    const [idxStr, field] = t.dataset.swatch.split(":");
    const sw = state.db.brand.palette?.[Number(idxStr)];
    if (sw) {
      sw[field] = t.value;
      queueBrandSave();
    }
    return;
  }

  // Design scalar field edit
  if (t.dataset.d && t.tagName !== "SELECT") {
    const [id, field] = t.dataset.d.split(":");
    const d = state.db.designs.find((x) => x.id === id);
    if (!d) return;
    d[field] = t.value;
    queueDesignSave(id, { [field]: t.value });
    return;
  }

  if (t.dataset.qty) {
    const [id, sz] = t.dataset.qty.split(":");
    const d = state.db.designs.find((x) => x.id === id);
    if (!d) return;
    const val = Math.max(0, Math.round(num(t.value)));
    d.qty = d.qty || {};
    d.qty[sz] = val;
    queueDesignSave(id, { qty: { [sz]: val } });
    return;
  }

  if (t.dataset.cost) {
    const [id, pathStr] = t.dataset.cost.split(":");
    const [sec, key] = pathStr.split(".");
    const d = state.db.designs.find((x) => x.id === id);
    if (!d) return;
    const c = ensureCost(d);
    c[sec][key] = t.value;
    queueDesignSave(id, { cost: { [sec]: { [key]: t.value } } });
    return;
  }

  if (t.dataset.trim) {
    const [id, row, key] = t.dataset.trim.split(":");
    const d = state.db.designs.find((x) => x.id === id);
    if (!d) return;
    const c = ensureCost(d);
    c.trims[row] = c.trims[row] || { qty: "", rate: "" };
    c.trims[row][key] = t.value;
    queueDesignSave(id, { cost: { trims: { [row]: { [key]: t.value } } } });
    return;
  }

  if (t.dataset.proc) {
    const [id, proc] = t.dataset.proc.split(":");
    const d = state.db.designs.find((x) => x.id === id);
    if (!d) return;
    const c = ensureCost(d);
    c.proc[proc] = t.value;
    queueDesignSave(id, { cost: { proc: { [proc]: t.value } } });
    return;
  }
});

document.addEventListener("change", async (e) => {
  const t = e.target;

  if (t.dataset.sort) {
    state.sc.sort = t.value;
    render();
    return;
  }

  if (t.dataset.costSelect) {
    state.costStyleId = t.value;
    render();
    return;
  }

  if (t.dataset.umFiles && t.files && t.files.length) {
    addFilesToUploadModal(t.files);
    t.value = "";
    return;
  }

  if (t.dataset.umDef) {
    state.uploadModal[t.dataset.umDef] = t.value;
    return;
  }

  if (!state.isAdmin) return;

  if (t.dataset.swatch && t.type === "color") {
    render();
    return;
  }

  if (t.dataset.d && t.tagName === "SELECT") {
    const [id, field] = t.dataset.d.split(":");
    try {
      const updated = await api.patchDesign(id, { [field]: t.value });
      const idx = state.db.designs.findIndex((d) => d.id === id);
      if (idx !== -1) state.db.designs[idx] = updated;
      render();
    } catch (err) {
      toast(err.message);
    }
    return;
  }

  if (t.dataset.dphase) {
    const id = t.dataset.dphase;
    try {
      const updated = await api.patchDesign(id, { phase: t.value });
      const idx = state.db.designs.findIndex((d) => d.id === id);
      if (idx !== -1) state.db.designs[idx] = updated;
      render();
    } catch (err) {
      toast(err.message);
    }
    return;
  }

  if (t.dataset.qty || t.dataset.cost || t.dataset.trim || t.dataset.proc) {
    render();
    return;
  }

  if (t.dataset.shot && t.files && t.files[0]) {
    const [id, ...slotParts] = t.dataset.shot.split(":");
    const slot = slotParts.join(":");
    const file = t.files[0];
    try {
      toast(`Uploading ${slot}…`);
      const data = await api.uploadShot(id, slot, file);
      const idx = state.db.designs.findIndex((d) => d.id === id);
      if (idx !== -1) state.db.designs[idx] = data.design;
      render();
      toast(`${slot} uploaded`);
    } catch (err) {
      toast(err.message || "Upload failed");
    }
    return;
  }

  if (t.dataset.logo && t.files && t.files[0]) {
    try {
      toast("Uploading logo…");
      const logoUrl = await api.uploadLogo(t.files[0]);
      state.db.logo = logoUrl;
      render();
      toast("Brand logo updated");
    } catch (err) {
      toast(err.message || "Logo upload failed");
    }
    return;
  }

  // Atelier Cover Photo upload (Admin)
  if (t.dataset.coverUpload && t.files && t.files[0]) {
    try {
      toast("Uploading cover photograph…");
      const coverUrl = await api.uploadBrandCover(t.files[0]);
      state.db.brand.coverImage = coverUrl;
      render();
      toast("Atelier cover updated");
    } catch (err) {
      toast(err.message || "Cover upload failed");
    }
    return;
  }

  // Inquiry status update (Admin)
  if (t.dataset.inqStatus) {
    try {
      const updated = await api.patchInquiry(t.dataset.inqStatus, { status: t.value });
      const idx = (state.db.inquiries || []).findIndex((x) => x.id === updated.id);
      if (idx !== -1) state.db.inquiries[idx] = updated;
      render();
      toast(`Marked as ${updated.status}`);
    } catch (err) {
      toast(err.message);
    }
    return;
  }

  if (t.id === "importer" && t.files && t.files[0]) {
    try {
      const text = await t.files[0].text();
      const parsed = JSON.parse(text);
      const restored = await api.restoreBackup(parsed);
      state.db = restored;
      state.sc.open = null;
      render();
      toast("Backup restored successfully");
    } catch (err) {
      toast(err.message || "Invalid JSON backup file");
    } finally {
      t.value = "";
    }
  }
});

// Drag-and-drop for Upload Modal & Shot Grid
document.addEventListener("dragover", (e) => {
  const bulkZone = e.target.closest("#bulkDropzone");
  if (bulkZone) {
    e.preventDefault();
    bulkZone.classList.add("dragover");
    return;
  }
  const shotZone = e.target.closest("[data-dropzone]");
  if (shotZone && state.isAdmin) {
    e.preventDefault();
    shotZone.classList.add("dragover");
  }
});

document.addEventListener("dragleave", (e) => {
  const bulkZone = e.target.closest("#bulkDropzone");
  if (bulkZone) bulkZone.classList.remove("dragover");
  const shotZone = e.target.closest("[data-dropzone]");
  if (shotZone) shotZone.classList.remove("dragover");
});

document.addEventListener("drop", async (e) => {
  const bulkZone = e.target.closest("#bulkDropzone");
  if (bulkZone) {
    e.preventDefault();
    bulkZone.classList.remove("dragover");
    addFilesToUploadModal(e.dataTransfer?.files);
    return;
  }

  const shotZone = e.target.closest("[data-dropzone]");
  if (shotZone && state.isAdmin) {
    e.preventDefault();
    shotZone.classList.remove("dragover");
    const file = e.dataTransfer?.files?.[0];
    if (!file || !file.type.startsWith("image/")) {
      toast("Please drop an image file");
      return;
    }
    const [id, ...slotParts] = shotZone.dataset.dropzone.split(":");
    const slot = slotParts.join(":");
    try {
      toast(`Uploading ${slot}…`);
      const data = await api.uploadShot(id, slot, file);
      const idx = state.db.designs.findIndex((d) => d.id === id);
      if (idx !== -1) state.db.designs[idx] = data.design;
      render();
      toast(`${slot} uploaded`);
    } catch (err) {
      toast(err.message || "Upload failed");
    }
  }
});

// Keyboard shortcuts
document.addEventListener("keydown", (e) => {
  const inField = ["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement?.tagName);

  if (e.key === "Escape") {
    const lb = document.getElementById("lightbox");
    if (lb && lb.classList.contains("on")) {
      closeLightbox();
      return;
    }
    if (state.inquiryModal.open && !state.inquiryModal.busy) {
      state.inquiryModal = { open: false, design: null, busy: false, sent: false };
      render();
      return;
    }
    if (state.uploadModal.open && !state.uploadModal.busy) {
      closeUploadModal();
      return;
    }
    if (state.sc.open) {
      state.sc.open = null;
      state.sc.activeSlot = "";
      render();
      return;
    }
  }

  if (inField) return;

  if (e.key === "/" && state.page === "showcase" && !state.sc.open && !state.uploadModal.open) {
    e.preventDefault();
    document.getElementById("showcaseSearch")?.focus();
    return;
  }

  if (state.sc.open && (e.key === "ArrowLeft" || e.key === "ArrowRight")) {
    const dir = e.key === "ArrowRight" ? 1 : -1;
    const list = getFilteredDesigns(state);
    const idx = list.findIndex((d) => d.id === state.sc.open);
    if (idx !== -1 && list.length > 1) {
      state.sc.open = list[(idx + dir + list.length) % list.length].id;
      render();
    }
  }
});

window.addEventListener("hashchange", () => {
  const next = getPageFromHash();
  if (next !== state.page) {
    state.page = next;
    state.sc.open = null;
    render();
  }
});

async function boot() {
  try {
    state.isAdminRoute = isAdminRoute();
    if (state.isAdminRoute) {
      state.isAdmin = await api.checkAdmin();
    } else {
      state.isAdmin = false;
    }

    const data = await api.fetchState();
    state.db = data.db;
    state.constants = data.constants;
    state.page = getPageFromHash();
    if (!location.hash) history.replaceState(null, "", `${window.location.pathname}#${state.page}`);
    render();
  } catch (err) {
    document.getElementById("root").innerHTML = `
      <div class="boot-loader">
        <div class="boot-mark">!</div>
        <div class="boot-txt">Could not connect to server: ${esc(err.message)}</div>
      </div>`;
  }
}

boot();
