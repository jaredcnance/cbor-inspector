const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const envPath = path.join(__dirname, "..", ".env");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match && !process.env[match[1].trim()]) {
      process.env[match[1].trim()] = match[2].trim();
    }
  }
}

if (!process.env.WEB_EXT_API_KEY || !process.env.WEB_EXT_API_SECRET) {
  console.error("Missing WEB_EXT_API_KEY or WEB_EXT_API_SECRET in .env or environment");
  process.exit(1);
}

const run = (cmd) => execSync(cmd, { stdio: "inherit", env: process.env });

run("node scripts/bump-version.js");

// Sign on AMO. This is the one irreversible step (a version, once signed, is
// permanently claimed on AMO), so it gets special conflict handling below.
try {
  execSync("npx web-ext sign --source-dir src --artifacts-dir dist --channel unlisted", {
    stdio: "inherit",
    env: process.env,
  });
} catch (err) {
  // AMO rejects re-signing a version it already has. This happens when a prior
  // release signed successfully but failed before committing/tagging/releasing.
  // We deliberately do NOT auto-download the existing artifact: it was built
  // from whatever src/ was at original signing time, which may differ from the
  // current tree, and shipping that under a "new" release would be a silent
  // mismatch. Fail closed with the manual recovery steps instead.
  const bumped = require(`${path.join(__dirname, "..", "src", "manifest.json")}`).version;
  console.error(`\n\nweb-ext sign failed for v${bumped}.`);
  console.error(
    "\nIf the error above is a Conflict / \"Version already exists\", this version was\n" +
    "already signed on AMO by an interrupted release. Do NOT bump — recover it:\n" +
    `\n  1. Download the signed v${bumped} .xpi from the AMO developer dashboard\n` +
    `  2. Place it at dist/cbor_inspector-${bumped}.xpi\n` +
    "  3. Re-run: node scripts/post-publish.js   (idempotent — finishes the release)\n" +
    "\nOnly if the code changed since that signing: bump the version manually in\n" +
    "src/manifest.json and re-run npm run publish:firefox.\n"
  );
  process.exit(1);
}

run("node scripts/post-publish.js");
