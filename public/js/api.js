const TOKEN_KEY = "atelier_admin_token";

let syncListener = null;
export function onSyncChange(fn) {
  syncListener = fn;
}

function setSync(status, text) {
  if (syncListener) syncListener(status, text);
}

export function getToken() {
  return sessionStorage.getItem(TOKEN_KEY) || "";
}

export function setToken(token) {
  if (token) sessionStorage.setItem(TOKEN_KEY, token);
  else sessionStorage.removeItem(TOKEN_KEY);
}

export function clearToken() {
  sessionStorage.removeItem(TOKEN_KEY);
}

async function req(url, options = {}) {
  const headers = { ...(options.headers || {}) };
  const token = getToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(url, { ...options, headers });
  const contentType = res.headers.get("content-type") || "";
  const data = contentType.includes("application/json") ? await res.json() : await res.text();
  if (!res.ok) {
    if (res.status === 401) clearToken();
    throw new Error((data && data.error) || `Request failed (${res.status})`);
  }
  return data;
}

export async function loginAdmin(password) {
  const data = await req("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password }),
  });
  if (data.token) setToken(data.token);
  return data;
}

export async function checkAdmin() {
  if (!getToken()) return false;
  try {
    const data = await req("/api/auth/check");
    if (!data.authenticated) clearToken();
    return Boolean(data.authenticated);
  } catch {
    return false;
  }
}

export async function fetchState() {
  return req("/api/state");
}

export async function createDesign(payload = {}) {
  setSync("saving", "Creating style…");
  try {
    const data = await req("/api/designs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setSync("ok", "Synced");
    return data.design;
  } catch (err) {
    setSync("error", "Sync error");
    throw err;
  }
}

export async function uploadSingleStyle(file, meta = {}) {
  setSync("saving", "Uploading style…");
  try {
    const fd = new FormData();
    if (file) fd.append("image", file);
    for (const [k, v] of Object.entries(meta)) {
      if (v !== undefined && v !== null) fd.append(k, String(v));
    }
    const data = await req("/api/designs", { method: "POST", body: fd });
    setSync("ok", "Synced");
    return data.design;
  } catch (err) {
    setSync("error", "Upload failed");
    throw err;
  }
}

export async function bulkUploadStyles(items, defaults = {}) {
  setSync("saving", `Uploading ${items.length} styles…`);
  try {
    const fd = new FormData();
    if (defaults.cat) fd.append("cat", defaults.cat);
    if (defaults.phase) fd.append("phase", defaults.phase);
    if (defaults.colours) fd.append("colours", String(defaults.colours));
    if (defaults.mrp) fd.append("mrp", String(defaults.mrp));

    const metaList = items.map((it) => ({
      name: it.name,
      cat: it.cat,
      phase: it.phase,
      mrp: it.mrp,
      colours: it.colours,
    }));
    fd.append("items", JSON.stringify(metaList));
    items.forEach((it) => fd.append("images", it.file));

    const data = await req("/api/designs/bulk", { method: "POST", body: fd });
    setSync("ok", "Synced");
    return data;
  } catch (err) {
    setSync("error", "Bulk upload failed");
    throw err;
  }
}

export async function patchDesign(id, patch) {
  setSync("saving", "Saving…");
  try {
    const data = await req(`/api/designs/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    setSync("ok", "Synced");
    return data.design;
  } catch (err) {
    setSync("error", "Sync error");
    throw err;
  }
}

export async function duplicateDesign(id) {
  setSync("saving", "Duplicating…");
  try {
    const data = await req(`/api/designs/${encodeURIComponent(id)}/duplicate`, { method: "POST" });
    setSync("ok", "Synced");
    return data.design;
  } catch (err) {
    setSync("error", "Sync error");
    throw err;
  }
}

export async function deleteDesign(id) {
  setSync("saving", "Deleting…");
  try {
    await req(`/api/designs/${encodeURIComponent(id)}`, { method: "DELETE" });
    setSync("ok", "Synced");
  } catch (err) {
    setSync("error", "Sync error");
    throw err;
  }
}

export async function uploadShot(designId, slot, file) {
  setSync("saving", "Uploading image…");
  try {
    const fd = new FormData();
    fd.append("image", file);
    const data = await req(`/api/designs/${encodeURIComponent(designId)}/shots/${encodeURIComponent(slot)}`, {
      method: "POST",
      body: fd,
    });
    setSync("ok", "Synced");
    return data;
  } catch (err) {
    setSync("error", "Upload failed");
    throw err;
  }
}

export async function deleteShot(designId, slot) {
  setSync("saving", "Removing image…");
  try {
    const data = await req(`/api/designs/${encodeURIComponent(designId)}/shots/${encodeURIComponent(slot)}`, {
      method: "DELETE",
    });
    setSync("ok", "Synced");
    return data.design;
  } catch (err) {
    setSync("error", "Sync error");
    throw err;
  }
}

export async function uploadLogo(file) {
  setSync("saving", "Uploading logo…");
  try {
    const fd = new FormData();
    fd.append("image", file);
    const data = await req("/api/logo", { method: "POST", body: fd });
    setSync("ok", "Synced");
    return data.logo;
  } catch (err) {
    setSync("error", "Upload failed");
    throw err;
  }
}

export async function deleteLogo() {
  setSync("saving", "Removing logo…");
  try {
    await req("/api/logo", { method: "DELETE" });
    setSync("ok", "Synced");
  } catch (err) {
    setSync("error", "Sync error");
    throw err;
  }
}

export async function downloadBackup() {
  const token = getToken();
  const res = await fetch("/api/backup", {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error("Failed to download backup");
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `atelier-collection-backup-${Date.now()}.json`;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(url);
    a.remove();
  }, 400);
}

export async function restoreBackup(jsonData) {
  setSync("saving", "Restoring backup…");
  try {
    const data = await req("/api/restore", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(jsonData),
    });
    setSync("ok", "Synced");
    return data.db;
  } catch (err) {
    setSync("error", "Restore failed");
    throw err;
  }
}

export async function patchBrand(patch) {
  setSync("saving", "Saving brand…");
  try {
    const data = await req("/api/brand", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    setSync("ok", "Synced");
    return data.brand;
  } catch (err) {
    setSync("error", "Sync error");
    throw err;
  }
}

export async function createCategory(payload) {
  setSync("saving", "Adding category…");
  try {
    const data = await req("/api/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setSync("ok", "Synced");
    return data.category;
  } catch (err) {
    setSync("error", "Sync error");
    throw err;
  }
}

export async function deleteCategory(id) {
  setSync("saving", "Deleting category…");
  try {
    await req(`/api/categories/${encodeURIComponent(id)}`, { method: "DELETE" });
    setSync("ok", "Synced");
  } catch (err) {
    setSync("error", "Sync error");
    throw err;
  }
}

export async function createPhase(payload) {
  setSync("saving", "Adding collection…");
  try {
    const data = await req("/api/phases", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setSync("ok", "Synced");
    return data.phase;
  } catch (err) {
    setSync("error", "Sync error");
    throw err;
  }
}

export async function deletePhase(id) {
  setSync("saving", "Deleting collection…");
  try {
    await req(`/api/phases/${encodeURIComponent(id)}`, { method: "DELETE" });
    setSync("ok", "Synced");
  } catch (err) {
    setSync("error", "Sync error");
    throw err;
  }
}

export async function uploadBrandCover(file) {
  setSync("saving", "Uploading cover…");
  try {
    const fd = new FormData();
    fd.append("image", file);
    const data = await req("/api/brand/cover", { method: "POST", body: fd });
    setSync("ok", "Synced");
    return data.coverImage;
  } catch (err) {
    setSync("error", "Upload failed");
    throw err;
  }
}

export async function deleteBrandCover() {
  setSync("saving", "Removing cover…");
  try {
    await req("/api/brand/cover", { method: "DELETE" });
    setSync("ok", "Synced");
  } catch (err) {
    setSync("error", "Sync error");
    throw err;
  }
}

export async function submitInquiry(payload) {
  return req("/api/inquiries", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function patchInquiry(id, patch) {
  setSync("saving", "Updating…");
  try {
    const data = await req(`/api/inquiries/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    setSync("ok", "Synced");
    return data.inquiry;
  } catch (err) {
    setSync("error", "Sync error");
    throw err;
  }
}

export async function deleteInquiry(id) {
  setSync("saving", "Deleting…");
  try {
    await req(`/api/inquiries/${encodeURIComponent(id)}`, { method: "DELETE" });
    setSync("ok", "Synced");
  } catch (err) {
    setSync("error", "Sync error");
    throw err;
  }
}
