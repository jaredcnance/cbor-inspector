const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const repoRoot = path.join(__dirname, "..");
const manifestPath = path.join(repoRoot, "src", "manifest.json");
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));

function tagExists(version) {
  try {
    execSync(`git rev-parse -q --verify "refs/tags/v${version}"`, {
      cwd: repoRoot,
      stdio: "ignore",
    });
    return true;
  } catch {
    return false;
  }
}

const current = manifest.version;

// Resume-aware bump: only advance the version if the current one was already
// released (has a git tag). If the current version has no tag, a previous
// release attempt was interrupted after bumping — keep that version so we
// finish releasing it instead of skipping past it. This is what prevents the
// double-bump cascade when a publish fails after the version was bumped.
if (tagExists(current)) {
  const parts = current.split(".").map(Number);
  parts[2] = (parts[2] || 0) + 1;
  manifest.version = parts.join(".");
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
  console.log(`Bumped version to ${manifest.version}`);
} else {
  console.log(`Resuming release of v${current} (not yet tagged) — keeping version`);
}
