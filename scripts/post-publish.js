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

const xpiPath = path.join(distDir, xpi);
const releaseAsset = `cbor_decoder-${version}.xpi`;
const updateLink = `https://github.com/jaredcnance/cbor-inspector/releases/download/v${version}/${releaseAsset}`;

const updates = {
  addons: {
    "cbor-decoder@noreply": {
      updates: [{ version, update_link: updateLink }]
    }
  }
};

fs.writeFileSync(updatesPath, JSON.stringify(updates, null, 2) + "\n");
console.log(`Updated updates.json → v${version}`);

const run = (cmd) => execSync(cmd, { stdio: "inherit", cwd: path.join(__dirname, "..") });

run(`git add updates.json manifest.json`);
run(`git commit -m "Publish v${version}"`);
run(`git push`);
run(`gh release create v${version} "${xpiPath}#${releaseAsset}" --title "v${version}" --notes "CBOR Decoder v${version}"`);
console.log(`Released v${version} on GitHub`);
