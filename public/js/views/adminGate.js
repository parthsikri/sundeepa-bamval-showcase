import { esc, MARK } from "../utils.js";

export function renderAdminGate(state) {
  const err = state.authError || "";
  return `<div class="auth-gate">
    <div class="auth-card">
      <div class="auth-mark">${MARK(28)}</div>
      <div class="ph-eyebrow" style="margin-top:0.85rem">Protected Studio Access</div>
      <h1 class="auth-title">Sundeepa Bamval Studio</h1>
      <p class="auth-sub">
        Sign in to upload designs, bulk-import lookbook imagery, customize brand presence, and manage categories &amp; collections.
      </p>

      <form id="adminLoginForm" class="stack" style="margin-top:1.4rem;text-align:left">
        <label class="fld">
          <span>Admin Password</span>
          <input
            id="adminPasswordInput"
            class="inp"
            type="password"
            autocomplete="current-password"
            placeholder="Enter studio password"
            required
            autofocus
          />
        </label>
        ${err ? `<div class="auth-err">${esc(err)}</div>` : ""}
        <button type="submit" class="btn btn-primary" style="width:100%;padding:0.68rem 1rem">
          Unlock Admin Studio →
        </button>
      </form>

      <div style="margin-top:1.25rem;padding-top:1rem;border-top:1px solid var(--line)">
        <a href="/#showcase" class="t-micro" style="color:var(--accent);text-decoration:none;font-weight:500">
          ← Return to Public Showcase
        </a>
      </div>
    </div>
  </div>`;
}
