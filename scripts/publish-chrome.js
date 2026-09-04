const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

// Load .env (same pattern as publish.js) so local runs pick up credentials.
const envPath = path.join(__dirname, "..", ".env");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match && !process.env[match[1].trim()]) {
      process.env[match[1].trim()] = match[2].trim();
    }
  }
}

// chrome-webstore-upload-cli reads these env vars directly.
const required = ["EXTENSION_ID", "CLIENT_ID", "CLIENT_SECRET", "REFRESH_TOKEN"];
const missing = required.filter((k) => !process.env[k]);
if (missing.length) {
  console.error(`Missing Chrome Web Store credentials: ${missing.join(", ")}`);
  console.error("Set them in .env or the environment (see DEVELOPMENT.md).");
  process.exit(1);
}

const repoRoot = path.join(__dirname, "..");
const run = (cmd) => execSync(cmd, { stdio: "inherit", cwd: repoRoot, env: process.env });

// Unlike the Firefox flow, Chrome publishing does NOT bump the version, commit,
// tag, or create a GitHub release. Version + tag are owned by the Firefox flow
// (scripts/publish.js) so there is a single source of version truth; this
// script just ships the version currently in src/manifest.json to the Web
// Store. Run it after publish:firefox so both stores carry the same version.
const manifest = JSON.parse(
  fs.readFileSync(path.join(repoRoot, "src", "manifest.json"), "utf8")
);
const version = manifest.version;

// Build the artifact. web-ext build produces a plain .zip of src/, which is
// exactly what the Chrome Web Store wants — the same artifact as build:firefox.
run("npx web-ext build --source-dir src --artifacts-dir dist --overwrite-dest");

const distDir = path.join(repoRoot, "dist");
const zip = fs
  .readdirSync(distDir)
  .filter((f) => f.endsWith(".zip"))
  .find((f) => f.includes(version));

if (!zip) {
  console.error(`No .zip found in dist/ for version ${version}`);
  process.exit(1);
}

const zipPath = path.join(distDir, zip);

// Upload and submit for review. --auto-publish publishes once review passes;
// the item must already exist (created manually in the console for the first
// submission — the API cannot create a new item).
run(`npx chrome-webstore-upload upload --source "${zipPath}" --auto-publish`);
console.log(`Uploaded v${version} to the Chrome Web Store`);
