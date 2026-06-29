const fs = require("fs");
const path = require("path");

const manifestPath = path.join(__dirname, "..", "manifest.json");
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));

const parts = manifest.version.split(".").map(Number);
parts[2] = (parts[2] || 0) + 1;
manifest.version = parts.join(".");

fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
console.log(`Bumped version to ${manifest.version}`);
