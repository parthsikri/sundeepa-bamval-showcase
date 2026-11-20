const express = require("express");
const path = require("path");
const compression = require("compression");
const { ensureDirs, UPLOADS_DIR, getStorageDriver } = require("./db");
const { r2ReadImage } = require("./storage");
const { ADMIN_PASSWORD } = require("./auth");
const apiRouter = require("./routes/api");

const app = express();
const PORT = process.env.PORT || 3000;

ensureDirs();

app.use(compression());
app.use(express.json({ limit: "15mb" }));

// Serve uploaded images: proxy from Cloudflare R2 if active without R2_PUBLIC_URL, else local disk
app.get("/uploads/:filename", async (req, res, next) => {
  if (getStorageDriver() === "cloudflare-r2") {
    try {
      const { buffer, contentType } = await r2ReadImage(req.params.filename);
      res.setHeader("Content-Type", contentType);
      res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
      return res.send(buffer);
    } catch {
      return res.status(404).end();
    }
  }
  next();
});
app.use("/uploads", express.static(UPLOADS_DIR, { maxAge: "7d" }));
app.use(express.static(path.join(__dirname, "..", "public"), { maxAge: 0 }));

// REST API
app.use("/api", apiRouter);

// SPA fallback for "/" and "/admin"
app.get("*", (_req, res) => {
  res.sendFile(path.join(__dirname, "..", "public", "index.html"));
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`\n  Sundeepa Bamval — Public Showcase:  http://localhost:${PORT}/#showcase`);
    console.log(`  Sundeepa Bamval — Admin Studio:     http://localhost:${PORT}/admin#showcase`);
    console.log(`  Admin Password:                     ${ADMIN_PASSWORD}`);
    console.log(`  Storage Driver:                     ${getStorageDriver()}\n`);
  });
}

module.exports = app;
