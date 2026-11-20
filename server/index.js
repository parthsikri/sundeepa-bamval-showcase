const express = require("express");
const path = require("path");
const compression = require("compression");
const { ensureDirs, loadDB, UPLOADS_DIR } = require("./db");
const { ADMIN_PASSWORD } = require("./auth");
const apiRouter = require("./routes/api");

const app = express();
const PORT = process.env.PORT || 3000;

ensureDirs();
loadDB();

app.use(compression());
app.use(express.json({ limit: "15mb" }));

// Static assets & uploaded images
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
    console.log(`  Admin Password:                     ${ADMIN_PASSWORD}\n`);
  });
}

module.exports = app;
