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
const updateLink = `https://github.com/jaredcnance/cbor-inspector/releases/download/v${version}/${xpi}`;

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

const lastTag = execSync("git describe --tags --abbrev=0 2>/dev/null || echo", { cwd: path.join(__dirname, "..") }).toString().trim();
const logRange = lastTag ? `${lastTag}..HEAD` : "HEAD~10..HEAD";
const rawLog = execSync(`git log ${logRange} --oneline --no-decorate`, { cwd: path.join(__dirname, "..") }).toString().trim();
const changelog = rawLog.split("\n")
  .filter(line => /^[a-f0-9]+ (feat|fix)[:(]/.test(line))
  .map(line => line.replace(/^[a-f0-9]+ /, ""))
  .join("\n");
const notes = changelog || `CBOR Decoder v${version}`;

const notesFile = path.join(distDir, "release-notes.txt");
fs.writeFileSync(notesFile, notes);

run(`git add updates.json manifest.json`);
run(`git commit -m "chore: Publish v${version}"`);
run(`git push origin main`);
run(`gh release create v${version} "${xpiPath}" --repo jaredcnance/cbor-inspector --title "v${version}" --notes-file "${notesFile}"`);
console.log(`Released v${version} on GitHub`);
