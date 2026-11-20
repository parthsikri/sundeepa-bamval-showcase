import { esc, blk, fld } from "../utils.js";

export function renderBrand(state) {
  const { db, isAdmin } = state;
  const b = db.brand || {};
  const pillars = Array.isArray(b.pillars) ? b.pillars : [];
  const palette = Array.isArray(b.palette) ? b.palette : [];
  const contact = b.contact || {};

  const hasContact = Object.values(contact).some((v) => String(v || "").trim().length > 0);

  return `
  <div class="hero-dark" style="margin-bottom:1.75rem">
    <div class="p-body" style="padding:2.2rem 2rem">
      ${b.tagline ? `<div class="eyebrow">${esc(b.tagline)}</div>` : `<div class="eyebrow">BRAND PRESENCE</div>`}
      <h1>${esc(b.name || "Sundeepa Bamval")}</h1>
      ${
        b.manifesto
          ? `<p>${esc(b.manifesto)}</p>`
          : isAdmin
          ? `<p style="opacity:0.65">Add your brand story and manifesto below to shape the public Brand Presence page.</p>`
          : ""
      }
    </div>
  </div>

  ${
    isAdmin
      ? `
  ${blk("Edit Brand Identity", "Auto-saved live to public showcase")}
  <div class="panel">
    <div class="p-body">
      <div class="g2" style="gap:0.85rem">
        ${fld("Brand / Designer Name", b.name || "Sundeepa Bamval", `data-brand="name"`, "Sundeepa Bamval")}
        ${fld("Subtitle", b.subtitle || "", `data-brand="subtitle"`, "Design Showcase / Fashion Design Studio")}
        ${fld("Top Eyebrow / Tagline", b.tagline || "", `data-brand="tagline"`, "e.g. FASHION DESIGN & COLLECTION STUDIO")}
        ${fld("Overview Hero Headline", b.heroTitle || "", `data-brand="heroTitle"`, "Headline shown on the Overview page")}
      </div>
      <label class="fld" style="margin-top:0.85rem">
        <span>Brand Manifesto / Short Bio</span>
        <textarea class="inp" rows="3" data-brand="manifesto" placeholder="Describe the brand vision, design philosophy, and aesthetic…">${esc(
          b.manifesto || ""
        )}</textarea>
      </label>
      <label class="fld" style="margin-top:0.85rem">
        <span>Extended Brand Story / Credentials</span>
        <textarea class="inp" rows="3" data-brand="about" placeholder="Background, studio philosophy, craftsmanship approach…">${esc(
          b.about || ""
        )}</textarea>
      </label>

      <div class="row-between wrap" style="margin-top:1rem;padding-top:1rem;border-top:1px solid var(--line-soft);gap:0.85rem">
        <div class="row" style="gap:0.85rem">
          ${
            b.coverImage
              ? `<img src="${esc(b.coverImage)}" alt="Atelier cover" style="width:76px;height:52px;object-fit:cover;border-radius:8px;border:1px solid var(--line)" />`
              : `<div style="width:76px;height:52px;border-radius:8px;border:1px dashed var(--line-strong);display:grid;place-items:center;font-size:0.7rem;color:var(--ink-3)">No cover</div>`
          }
          <div>
            <div class="semi" style="font-size:0.86rem">Atelier Hero Cover Photograph</div>
            <div class="t-micro muted">Featured editorial photograph in the public Showcase hero banner.</div>
          </div>
        </div>
        <div class="row" style="gap:0.5rem">
          <label class="btn btn-sm" style="cursor:pointer">
            ↑ Upload Cover
            <input type="file" accept="image/*" data-cover-upload="1" hidden />
          </label>
          ${b.coverImage ? `<button type="button" class="btn btn-sm btn-danger" data-cover-del="1">Remove</button>` : ""}
        </div>
      </div>
    </div>
  </div>

  ${blk("Brand Pillars & Positioning Cards", "Add custom cards (positioning, design language, philosophy)")}
  <div class="stack-s">
    ${pillars
      .map(
        (p, idx) => `
      <div class="panel">
        <div class="p-body">
          <div class="row-between" style="margin-bottom:0.65rem">
            <span class="caps" style="color:var(--accent)">Pillar ${idx + 1}</span>
            <button type="button" class="btn btn-sm btn-danger" data-del-pillar="${idx}">Remove</button>
          </div>
          <div class="g2" style="gap:0.75rem;margin-bottom:0.65rem">
            ${fld("Eyebrow / Label", p.eyebrow || "", `data-pillar="${idx}:eyebrow"`, "e.g. POSITIONING")}
            ${fld("Heading", p.title || "", `data-pillar="${idx}:title"`, "e.g. Quiet Editorial Luxury")}
          </div>
          <label class="fld">
            <span>Description</span>
            <textarea class="inp" rows="2" data-pillar="${idx}:body" placeholder="Describe this brand pillar…">${esc(
          p.body || ""
        )}</textarea>
          </label>
        </div>
      </div>`
      )
      .join("")}
    <div>
      <button type="button" class="btn btn-primary btn-sm" data-add-pillar="1">+ Add Brand Pillar Card</button>
    </div>
  </div>

  ${blk("Brand Colour Palette", "Add custom colour swatches shown on the public Brand Presence page")}
  <div class="panel">
    <div class="p-body">
      ${
        palette.length
          ? `<div class="stack-s" style="margin-bottom:1rem">
               ${palette
                 .map(
                   (sw, idx) => `
                 <div class="row wrap" style="gap:0.6rem;padding:0.55rem;border:1px solid var(--line);border-radius:10px;background:var(--bg)">
                   <input type="color" value="${esc(sw.hex || "#1d1d1f")}" data-swatch="${idx}:hex" style="width:42px;height:36px;border:1px solid var(--line-strong);border-radius:8px;padding:2px;background:#fff;cursor:pointer" />
                   <input class="inp" style="flex:1;min-width:140px" value="${esc(sw.name || "")}" data-swatch="${idx}:name" placeholder="Swatch name" />
                   <input class="inp fig" style="width:110px" value="${esc(sw.hex || "")}" data-swatch="${idx}:hex" placeholder="#1D1D1F" />
                   <input class="inp" style="flex:1.4;min-width:160px" value="${esc(sw.role || "")}" data-swatch="${idx}:role" placeholder="Usage / role" />
                   <button type="button" class="btn btn-sm btn-icon btn-danger" data-del-swatch="${idx}">✕</button>
                 </div>`
                 )
                 .join("")}
             </div>`
          : `<p class="t-lab muted" style="margin:0 0 0.85rem">No colour swatches added yet.</p>`
      }
      <button type="button" class="btn btn-sm" data-add-swatch="1">+ Add Colour Swatch</button>
    </div>
  </div>

  ${blk("Studio & Contact Presence", "Shown publicly when filled in")}
  <div class="panel">
    <div class="p-body">
      <div class="g3" style="gap:0.75rem">
        ${fld("Email", contact.email || "", `data-contact="email"`, "studio@example.com")}
        ${fld("Phone / WhatsApp", contact.phone || "", `data-contact="phone"`, "+91 ...")}
        ${fld("Location", contact.location || "", `data-contact="location"`, "New Delhi, India")}
        ${fld("Website", contact.website || "", `data-contact="website"`, "https://...")}
        ${fld("Instagram", contact.instagram || "", `data-contact="instagram"`, "@handle or URL")}
        ${fld("LinkedIn", contact.linkedin || "", `data-contact="linkedin"`, "https://linkedin.com/in/...")}
      </div>
    </div>
  </div>
  `
      : `
  ${
    b.about
      ? `${blk("About the Studio")}
         <div class="panel"><div class="p-body"><p style="margin:0;max-width:76ch;line-height:1.65;color:var(--ink-2);white-space:pre-line">${esc(
           b.about
         )}</p></div></div>`
      : ""
  }

  ${
    pillars.length
      ? `${blk("Brand Pillars")}
         <div class="g2">
           ${pillars
             .map(
               (p) => `
             <div class="panel">
               <div class="p-body">
                 ${p.eyebrow ? `<div class="caps" style="color:var(--accent)">${esc(p.eyebrow)}</div>` : ""}
                 ${
                   p.title
                     ? `<div class="semi" style="font-family:var(--font-serif);font-size:1.12rem;margin-top:0.3rem">${esc(
                         p.title
                       )}</div>`
                     : ""
                 }
                 ${p.body ? `<p style="margin:0.45rem 0 0;line-height:1.55;font-size:0.92rem;color:var(--ink-2)">${esc(p.body)}</p>` : ""}
               </div>
             </div>`
             )
             .join("")}
         </div>`
      : ""
  }

  ${
    palette.length
      ? `${blk("Brand Colour Palette", "Click any swatch to copy hex code")}
         <div class="panel">
           <div class="p-body">
             <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:0.85rem">
               ${palette
                 .map(
                   (sw) => `
                 <button type="button" data-copy="${esc(sw.hex)}" style="border:1px solid var(--line);background:var(--surface);border-radius:10px;padding:0.55rem;text-align:left">
                   <div style="height:64px;border-radius:7px;background:${esc(sw.hex)};border:1px solid rgba(0,0,0,0.08)"></div>
                   <div class="semi" style="font-size:0.82rem;margin-top:0.55rem;color:var(--ink)">${esc(sw.name || sw.hex)}</div>
                   <div class="fig t-micro" style="color:var(--accent);margin-top:2px">${esc(sw.hex)}</div>
                   ${sw.role ? `<div class="t-micro faint" style="margin-top:3px;line-height:1.35">${esc(sw.role)}</div>` : ""}
                 </button>`
                 )
                 .join("")}
             </div>
           </div>
         </div>`
      : ""
  }

  ${
    hasContact
      ? `${blk("Studio Contact")}
         <div class="panel">
           <div class="p-body">
             <div class="g3" style="gap:0.85rem">
               ${[
                 ["Email", contact.email],
                 ["Phone", contact.phone],
                 ["Location", contact.location],
                 ["Website", contact.website],
                 ["Instagram", contact.instagram],
                 ["LinkedIn", contact.linkedin],
               ]
                 .filter(([, v]) => String(v || "").trim())
                 .map(
                   ([label, val]) => `
                   <div>
                     <div class="caps">${label}</div>
                     <div class="semi" style="margin-top:0.25rem;font-size:0.92rem;word-break:break-word">${esc(val)}</div>
                   </div>`
                 )
                 .join("")}
             </div>
           </div>
         </div>`
      : ""
  }

  ${
    !b.about && !pillars.length && !palette.length && !hasContact
      ? `<div class="panel"><div class="p-body" style="text-align:center;padding:3.2rem 1.5rem">
           <div style="font-family:var(--font-serif);font-size:1.35rem;margin-bottom:0.4rem">${esc(b.name || "Sundeepa Bamval")}</div>
           <p class="t-lab muted" style="margin:0">Brand presence details will appear here once published from the studio.</p>
         </div></div>`
      : ""
  }
  `
  }
  `;
}
