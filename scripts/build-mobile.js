#!/usr/bin/env node
// Build mobile: troca next.config.ts pelo mobile e desativa rotas incompatíveis
// com output:"export" (middleware.ts e src/app/api/).

const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const src  = path.join(root, "src", "app");

// Config swap
const cfgWeb    = path.join(root, "next.config.ts");
const cfgWebBak = path.join(root, "next.config.ts.web");
const cfgMob    = path.join(root, "next.config.mobile.ts");

// Middleware
const mwPaths = [path.join(root, "middleware.ts"), path.join(root, "src", "middleware.ts")];
const mwSrc   = mwPaths.find((p) => fs.existsSync(p));
const mwBak   = mwSrc ? mwSrc + ".disabled" : null;

// API routes (não suportadas em output:export)
const apiDir    = path.join(src, "api");
const apiDirBak = path.join(src, "_api_web");

let cfgSwapped = false;
let mwDisabled = false;
let apiMoved   = false;

function restore() {
  if (mwDisabled && fs.existsSync(mwBak)) {
    fs.renameSync(mwBak, mwSrc);
    console.log("▶  middleware.ts restaurado.");
  }
  if (apiMoved && fs.existsSync(apiDirBak)) {
    fs.renameSync(apiDirBak, apiDir);
    console.log("▶  src/app/api/ restaurado.");
  }
  if (cfgSwapped) {
    if (fs.existsSync(cfgWeb))    fs.renameSync(cfgWeb, cfgMob);
    if (fs.existsSync(cfgWebBak)) fs.renameSync(cfgWebBak, cfgWeb);
    console.log("⚙  next.config.ts restaurado (web).");
  }
}

try {
  if (!fs.existsSync(cfgMob)) throw new Error("next.config.mobile.ts não encontrado.");

  // 1. Trocar config
  fs.renameSync(cfgWeb, cfgWebBak);
  fs.renameSync(cfgMob, cfgWeb);
  cfgSwapped = true;
  console.log("⚙  Config → mobile (output:export, distDir:out-mobile)");

  // 2. Desativar middleware
  if (mwSrc) {
    fs.renameSync(mwSrc, mwBak);
    mwDisabled = true;
    console.log("⏸  middleware.ts desativado.");
  }

  // 3. Mover src/app/api/ (API routes não são compatíveis com static export)
  if (fs.existsSync(apiDir)) {
    fs.renameSync(apiDir, apiDirBak);
    apiMoved = true;
    console.log("⏸  src/app/api/ movido (incompatível com static export).");
  }

  // 4. Build
  execSync("npx next build", { stdio: "inherit", cwd: root });
  console.log("\n✅ Build mobile concluído → out-mobile/");
} catch (err) {
  console.error("\n❌ Build mobile falhou:", err.message);
  process.exitCode = 1;
} finally {
  restore();
}
