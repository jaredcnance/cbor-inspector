const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const distDir = path.join(__dirname, "..", "dist");
const updatesPath = path.join(__dirname, "..", "updates.json");
const manifestPath = path.join(__dirname, "..", "manifest.json");

const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
const version = manifest.version;

const files = fs.readdirSync(distDir).filter(f => f.endsWith(".xpi"));
const xpi = files.find(f => f.includes(version));

if (!xpi) {
  console.error(`No .xpi found in dist/ for version ${version}`);
  process.exit(1);
}

const updateLink = `https://github.com/jaredcnance/cbor-inspector/releases/download/v${version}/cbor_decoder-${version}.xpi`;

const updates = {
  addons: {
    "cbor-decoder@noreply": {
      updates: [{ version, update_link: updateLink }]
    }
  }
};

fs.writeFileSync(updatesPath, JSON.stringify(updates, null, 2) + "\n");
console.log(`Updated updates.json → v${version} (${xpi})`);

execSync(`git add dist/${xpi} updates.json manifest.json`, { stdio: "inherit" });
execSync(`git commit -m "Publish v${version}"`, { stdio: "inherit" });
execSync(`git push`, { stdio: "inherit" });
console.log(`Pushed v${version} to remote`);
