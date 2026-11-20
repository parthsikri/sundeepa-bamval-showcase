# ATELIER — Summer Collection Showcase & Master Platform

A full-stack fashion collection showcase, design brief room, inventory planner, and factory landing cost engine — combining the complete functional workflow of a collection master platform with an editorial luxury color palette (`#f5f5f7`, `#ffffff`, `#1d1d1f`, `#161617`, `#0066cc`, `#d4af37`) and `Fraunces` + `Instrument Sans` + `IBM Plex Mono` typography.

## Features

- **The Showcase (`/#showcase`)**: Filterable gallery across 13 categories, subcategories, and 3 seasonal drops, with live search, sorting, live rollup metrics, and `+ Add Style`.
- **Full Style Detail Sheet**: 6-slot drag-and-drop & click image upload (`Reference`, `Front`, `Back`, `Detail`, `Tech Sketch`, `Fabric / Swatch`) persisted on the backend, Lightbox zoom viewer, category-aware technical fields, interactive size-wise quantity matrix, live brief auto-save, Duplicate, Delete, and keyboard navigation (`←` / `→` / `Esc`).
- **Executive Overview (`/#overview`)**: Live KPIs, priority tier depth table, three-drop breakdown with one-click jump to Showcase.
- **Brand Direction (`/#brand`)**: Positioning, operating model, audience personas, garment design language, and click-to-copy editorial color palette swatches.
- **Inventory Plan (`/#inventory`)**: Category rollup, drop rollup, separated size curves, clickable full production master table, and one-click RFC-4180 CSV export.
- **Product Costing (`/#costing`)**: Bottom-up A–I Factory Landing Cost Engine (Fabric, Trims, Processing, Cutting, Stitching SAM/Flat, Finishing, QC & Rejection %, Packing, Overhead) with live Gross Margin & Markup calculations.
- **Full-Stack Persistence**: Express REST API with atomic JSON database (`server/data/collection.json`), real multipart image storage (`server/uploads/`), custom brand logo upload, full JSON Backup & Restore, and Print stylesheet.

## Quick Start

```bash
npm install
npm start
```

Open [http://localhost:3000/#showcase](http://localhost:3000/#showcase).
