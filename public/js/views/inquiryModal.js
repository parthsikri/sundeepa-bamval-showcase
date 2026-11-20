import { esc } from "../utils.js";

export function renderInquiryModal(state) {
  const { inquiryModal, db } = state;
  if (!inquiryModal || !inquiryModal.open) return "";

  const brandName = db.brand?.name || "Sundeepa Bamval";
  const linked = inquiryModal.design || null;
  const sent = Boolean(inquiryModal.sent);
  const busy = Boolean(inquiryModal.busy);

  return `<div class="modal-backdrop" id="inquiryModalBackdrop" role="dialog" aria-modal="true" aria-label="Inquire or Book Consultation">
    <div class="modal-card">
      <div class="modal-head">
        <div>
          <div class="caps" style="color:var(--gold-ink)">${esc(brandName)} · Atelier</div>
          <h2 style="font-family:var(--font-serif);font-weight:400;font-size:1.4rem;margin-top:2px">
            ${linked ? "Inquire About This Design" : "Inquire / Book Consultation"}
          </h2>
        </div>
        <button type="button" class="btn btn-sm btn-icon" data-inq-close="1" ${busy ? "disabled" : ""}>✕</button>
      </div>

      ${
        sent
          ? `<div class="modal-body" style="text-align:center;padding:3rem 1.75rem">
               <div style="width:48px;height:48px;border-radius:50%;background:var(--pos-bg);color:var(--pos);border:1px solid var(--pos-line);display:grid;place-items:center;margin:0 auto 1rem;font-size:1.25rem">✓</div>
               <h3 style="font-family:var(--font-serif);font-weight:400;font-size:1.45rem;margin-bottom:0.45rem">Inquiry Received</h3>
               <p class="t-lab muted" style="max-width:42ch;margin:0 auto 1.4rem">
                 Thank you for reaching out to ${esc(brandName)}. Your message has been logged with the studio and we will respond shortly.
               </p>
               <button type="button" class="btn btn-primary" data-inq-close="1">Return to Showcase</button>
             </div>`
          : `<form id="inquiryForm">
               <div class="modal-body stack">
                 ${
                   linked
                     ? `<div class="inq-linked">
                          <span class="caps" style="color:var(--gold-ink)">Selected Look</span>
                          <div class="semi" style="margin-top:2px">
                            <span class="fig" style="color:var(--accent)">${esc(linked.code)}</span>
                            <span class="faint"> · </span>
                            <span>${esc(linked.name || linked.cat || "Design")}</span>
                          </div>
                        </div>`
                     : ""
                 }

                 <div class="g2" style="gap:0.75rem">
                   <label class="fld">
                     <span>Your Name *</span>
                     <input class="inp" name="name" required placeholder="Full name" />
                   </label>
                   <label class="fld">
                     <span>Brand / Company</span>
                     <input class="inp" name="company" placeholder="Optional" />
                   </label>
                 </div>

                 <div class="g2" style="gap:0.75rem">
                   <label class="fld">
                     <span>Email Address *</span>
                     <input class="inp" type="email" name="email" required placeholder="you@brand.com" />
                   </label>
                   <label class="fld">
                     <span>Phone / WhatsApp</span>
                     <input class="inp" name="phone" placeholder="+91 ..." />
                   </label>
                 </div>

                 <label class="fld">
                   <span>Message / Project Brief *</span>
                   <textarea class="inp" name="message" rows="4" required placeholder="${
                     linked
                       ? "Share your interest in this silhouette, fabric sourcing, customisation, or sampling timeline…"
                       : "Tell us about your brand, collection timeline, or design consultation needs…"
                   }"></textarea>
                 </label>
               </div>

               <div class="modal-foot">
                 <button type="button" class="btn btn-sm" data-inq-close="1" ${busy ? "disabled" : ""}>Cancel</button>
                 <button type="submit" class="btn btn-primary" ${busy ? "disabled" : ""}>
                   ${busy ? "Sending…" : "Send Inquiry →"}
                 </button>
               </div>
             </form>`
      }
    </div>
  </div>`;
}
