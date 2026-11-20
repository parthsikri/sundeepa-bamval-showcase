import { esc, blk } from "../utils.js";

const STATUS_OPTS = ["New", "Reviewed", "Replied"];

export function renderInquiries(state) {
  const { db, isAdmin } = state;
  if (!isAdmin) {
    return `<div class="ph"><h1>Inquiries</h1><p class="sub">Admin access required.</p></div>`;
  }

  const list = db.inquiries || [];
  const newCount = list.filter((x) => x.status === "New").length;

  return `
  <div class="ph">
    <div class="ph-eyebrow">Client Relations</div>
    <h1>Inquiries Inbox</h1>
    <p class="sub">
      Consultation requests and design inquiries submitted by brands and visitors from your public showcase.
    </p>
  </div>

  <div class="kpis" style="margin-bottom:1.35rem">
    <div class="kpi"><div class="kv">${list.length}</div><div class="kl">Total Inquiries</div></div>
    <div class="kpi"><div class="kv" style="color:var(--accent)">${newCount}</div><div class="kl">New / Unread</div></div>
    <div class="kpi"><div class="kv">${list.filter((x) => x.status === "Replied").length}</div><div class="kl">Replied</div></div>
  </div>

  ${blk("Incoming Messages", list.length ? `${list.length} total` : "Inbox empty")}

  ${
    !list.length
      ? `<div class="panel"><div class="p-body" style="text-align:center;padding:3.5rem 1.5rem">
           <div style="font-family:var(--font-serif);font-size:1.35rem;margin-bottom:0.35rem">No inquiries yet</div>
           <p class="t-lab muted" style="margin:0">When visitors click "Inquire / Book" or inquire about a look on the public site, their messages will appear here.</p>
         </div></div>`
      : `<div class="stack">
           ${list
             .map((inq) => {
               const dateStr = inq.createdAt
                 ? new Date(inq.createdAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })
                 : "";
               return `
               <div class="panel">
                 <div class="p-head">
                   <div class="row wrap" style="gap:0.65rem">
                     <span class="semi" style="font-size:0.95rem">${esc(inq.name)}</span>
                     ${inq.company ? `<span class="t-micro muted">· ${esc(inq.company)}</span>` : ""}
                     ${
                       inq.designCode
                         ? `<button type="button" class="tagP" style="border:none;cursor:pointer" data-jump-style="${esc(
                             inq.designId
                           )}">Look: ${esc(inq.designCode)}${inq.designName ? ` — ${esc(inq.designName)}` : ""}</button>`
                         : ""
                     }
                   </div>
                   <div class="row" style="gap:0.5rem">
                     <select class="inp" style="width:auto;padding:0.26rem 0.6rem;font-size:0.76rem;border-radius:999px" data-inq-status="${esc(
                       inq.id
                     )}">
                       ${STATUS_OPTS.map(
                         (s) => `<option value="${s}" ${inq.status === s ? "selected" : ""}>${s}</option>`
                       ).join("")}
                     </select>
                     <button type="button" class="btn btn-sm btn-danger" data-inq-del="${esc(inq.id)}">Delete</button>
                   </div>
                 </div>
                 <div class="p-body">
                   <p style="margin:0 0 0.85rem;white-space:pre-line;line-height:1.55;color:var(--ink)">${esc(
                     inq.message
                   )}</p>
                   <div class="row wrap t-micro muted" style="gap:1.1rem;padding-top:0.7rem;border-top:1px solid var(--line-soft)">
                     <span>Email: <a href="mailto:${esc(inq.email)}" style="color:var(--accent);text-decoration:none">${esc(
                 inq.email
               )}</a></span>
                     ${inq.phone ? `<span>Phone: <b>${esc(inq.phone)}</b></span>` : ""}
                     <span class="spacer"></span>
                     <span class="faint">${esc(dateStr)}</span>
                   </div>
                 </div>
               </div>`;
             })
             .join("")}
         </div>`
  }
  `;
}
