# CLAUDE.md

## Project overview

Firefox/Chrome DevTools extension that auto-decodes CBOR (specifically Smithy RPC v2 CBOR) responses into syntax-highlighted JSON. Self-hosted via GitHub Releases with auto-updates for Firefox.

## Build & test

```bash
npm install     # also configures pre-commit hook via prepare script
npm test        # runs vitest
npm run build:firefox   # packages .zip for manual inspection
npm run publish:firefox # full release: bump → sign → commit → push → GitHub Release
```

## Key architecture decisions

- **Manifest V3** with `chrome.*` namespace (Firefox supports both `browser.*` and `chrome.*`)
- **No extra permissions needed** — `devtools.network` API works without `webRequest` or `<all_urls>` in MV3
- **innerHTML is intentional** — do NOT refactor to DOM APIs. MV3 CSP silently blocks some DOM patterns in DevTools panels without throwing errors. The innerHTML approach was validated as working; a full DOM refactor broke rendering with no visible errors.
- **Inline event handlers (onclick=) are blocked** by MV3 CSP. Always use `addEventListener` instead.
- **Self-hosted distribution** — signed by Mozilla as unlisted, hosted on GitHub Releases, auto-updates via `updates.json`

## Remotes

- `origin` → `ssh://git.amazon.com/pkg/CBorDebugger` (internal)
- `github` → `https://github.com/jaredcnance/cbor-inspector.git` (public)

Always push to both: `git push origin main && git push github main`

The GitHub Actions publish workflow also pushes commits, which can cause divergence. Use `git pull github main --no-rebase` to merge before pushing if rejected.

## Publishing

`npm run publish:firefox` does everything:
1. Bumps patch version in manifest.json
2. Signs with Mozilla (credentials from `.env`)
3. Updates `updates.json` with the GitHub Release download URL
4. Commits and pushes to both remotes
5. Creates a GitHub Release with the `.xpi` attached

### Credentials

`.env` file (gitignored):
```
WEB_EXT_API_KEY=<JWT issuer from addons.mozilla.org>
WEB_EXT_API_SECRET=<JWT secret>
```

### Quirks

- AMO sometimes rejects JWT with "exp is too long" — this is transient, just retry
- The `.xpi` filename prefix (`d49e88be5e334d0faee3`) is the stable AMO addon UUID, it doesn't change between versions
- `web-ext lint` must use `--self-hosted` flag to allow `update_url` in manifest

## Testing the extension locally

After modifying manifest.json or changing manifest_version, you MUST:
1. Remove the extension entirely from `about:debugging`
2. Re-add it fresh (Load Temporary Add-on)
3. Close and reopen DevTools

Simply reloading the extension is not sufficient for manifest changes.

## Linting

```bash
npx web-ext lint --source-dir . --self-hosted --ignore-files "test/" "node_modules/" "package.json" "package-lock.json" ".git" ".gitignore" ".githooks" "dist/" "updates.json" "scripts/" ".env" ".github/"
```

Remaining warnings (non-blocking):
- `MISSING_DATA_COLLECTION_PERMISSIONS` — informational, will be required in future Firefox versions
- `UNSAFE_VAR_ASSIGNMENT` (innerHTML) — safe in our context (DevTools panel, not content script)
