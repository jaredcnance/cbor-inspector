const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const distDir = path.join(__dirname, "..", "dist");
const updatesPath = path.join(__dirname, "..", "updates.json");
const manifestPath = path.join(__dirname, "..", "src", "manifest.json");

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

const repoRoot = path.join(__dirname, "..");
const run = (cmd) => execSync(cmd, { stdio: "inherit", cwd: repoRoot });
const capture = (cmd) => execSync(cmd, { cwd: repoRoot }).toString().trim();
const ok = (cmd) => {
  try { execSync(cmd, { cwd: repoRoot, stdio: "ignore" }); return true; }
  catch { return false; }
};

const lastTag = execSync("git describe --tags --abbrev=0 2>/dev/null || echo", { cwd: repoRoot }).toString().trim();
// No tags yet (first release): whole history rather than a fixed HEAD~N that
// fails on repos with fewer than N commits.
const logRange = lastTag ? `${lastTag}..HEAD` : "HEAD";
const rawLog = capture(`git log ${logRange} --oneline --no-decorate`);
const changelog = rawLog.split("\n")
  .filter(line => /^[a-f0-9]+ (feat|fix)[:(]/.test(line))
  .map(line => line.replace(/^[a-f0-9]+ /, ""))
  .join("\n");
const notes = changelog || `CBOR Inspector v${version}`;

const notesFile = path.join(distDir, "release-notes.txt");
fs.writeFileSync(notesFile, notes);

// Every step below is idempotent so a re-run can finish an interrupted release.

// Commit the bump + updates.json only if there's something staged to commit.
run(`git add updates.json src/manifest.json`);
if (capture(`git diff --cached --name-only`)) {
  run(`git commit -m "chore: Publish v${version}"`);
} else {
  console.log(`No changes to commit (already committed)`);
}
run(`git push origin main`);

// Tag if missing, then push the tag.
if (!ok(`git rev-parse -q --verify "refs/tags/v${version}"`)) {
  run(`git tag v${version}`);
}
run(`git push origin "v${version}"`);

// Create the GitHub release only if it doesn't already exist.
if (ok(`gh release view v${version} --repo jaredcnance/cbor-inspector`)) {
  console.log(`GitHub release v${version} already exists — skipping`);
} else {
  run(`gh release create v${version} "${xpiPath}" --repo jaredcnance/cbor-inspector --title "v${version}" --notes-file "${notesFile}"`);
  console.log(`Released v${version} on GitHub`);
}
