# Development

## Prerequisites

- Node.js 20+
- Firefox or Chrome for manual testing

## Setup

```bash
npm install
```

This also sets up the pre-commit hook (runs `npm test` before each commit).

## Running tests

```bash
npm test              # Unit tests (vitest) — CBOR decoder
npm run test:e2e      # E2E panel UI tests (Playwright + Chromium)
npm run test:e2e:smoke  # Smoke test with real extension loaded in Chromium
npm run test:e2e:all  # All E2E suites
```

## Regenerating the README screenshot

The hero image in the README is generated from the panel with mocked data:

```bash
npm run screenshot    # writes docs/screenshot.png
```

Run this after UI changes that affect the panel's appearance, then commit
the updated `docs/screenshot.png`. It is a separate Playwright project
(`screenshot`), so it is not part of `npm run test:e2e` and never runs in CI.

## Manual testing in Firefox

1. Open `about:debugging` > This Firefox > Load Temporary Add-on
2. Select `src/manifest.json`
3. Open DevTools on any page — the "CBOR" panel appears
4. Visit a page that makes Smithy RPC v2 CBOR requests (content-type containing `cbor` or `application/vnd.amazon`)

After modifying `manifest.json`, you must remove and re-add the extension, then reopen DevTools.

## Manual testing in Chrome

1. Open `chrome://extensions` with Developer mode enabled
2. Click "Load unpacked" and select the `src/` directory
3. Open DevTools on any page — the "CBOR" panel appears

## Commit conventions

Use [Conventional Commits](https://www.conventionalcommits.org/) prefixes:

| Prefix | Purpose | In release notes? |
|--------|---------|:-:|
| `feat:` | New user-facing feature | Yes |
| `fix:` | Bug fix | Yes |
| `refactor:` | Code restructuring, no behavior change | No |
| `test:` | Adding or updating tests | No |
| `docs:` | Documentation | No |
| `chore:` | Tooling, deps, CI, publishing | No |

Only `feat:` and `fix:` commits appear in GitHub Release notes. Everything else is filtered out during publishing.

## Linting

```bash
npx web-ext lint --source-dir src --self-hosted
```

The `--self-hosted` flag is required because the manifest includes `update_url`. Because only the shipped extension lives in `src/`, no `--ignore-files` list is needed.

## Publishing a release

Both CI and local publishing run the same scripts (`scripts/publish.js` →
`bump-version.js`, `web-ext sign`, `post-publish.js`):
1. Run tests
2. Bump the patch version in `src/manifest.json`
3. Sign the extension with Mozilla (unlisted) — **the one irreversible step**
4. Update `updates.json` with the new download URL
5. Commit, push, tag `vX.Y.Z`
6. Create a GitHub Release with the `.xpi` and auto-generated notes

The bump is **resume-aware** (it only advances the version if the current one
is already tagged) and steps 4–6 are **idempotent**, so re-running after a
failure finishes the interrupted release rather than double-bumping.

### Automated (CI)

Trigger the **Publish** workflow manually from GitHub Actions.

### Local

Requires a `.env` file with Mozilla API credentials:

```
WEB_EXT_API_KEY=<JWT issuer from addons.mozilla.org>
WEB_EXT_API_SECRET=<JWT secret>
```

Then run `npm run publish:firefox`.

### Recovering a failed release

Signing (step 3) permanently claims a version on AMO. If a release fails
*after* signing but before the release is on GitHub, AMO has the version but
the repo doesn't — and re-running will hit `Conflict: Version X already exists`.
`publish.js` fails closed here with recovery instructions. To recover:

1. Download the signed `vX.Y.Z` `.xpi` from the AMO developer dashboard
2. Place it at `dist/cbor_inspector-X.Y.Z.xpi`
3. Run `node scripts/post-publish.js` — idempotent; it updates `updates.json`,
   commits/tags/pushes, and creates the GitHub Release, skipping anything
   already done.

Do **not** bump the version to work around the conflict unless the code
actually changed since that signing — otherwise `updates.json` would advertise
a version whose published `.xpi` contains different code.

## Publishing to Chrome

Chrome does not support Firefox-style self-hosted auto-updates for regular
users — self-hosted `.crx` + `update_url` only works under enterprise policy or
on Linux. The only path that gives end users frictionless install + automatic
background updates is the **Chrome Web Store**, published as **Unlisted** (not
searchable, reachable only via a direct link). The store handles all
auto-updates, so there is no Chrome equivalent of `updates.json` to maintain.

Chrome ships the exact same `src/` as Firefox; `browser_specific_settings.gecko`
and `background.scripts` are ignored by Chrome. Do **not** add a Chrome
`update_url` — the store manages updates and rejects items that carry one.

### One-time setup

1. In the [Chrome Web Store dev console](https://chrome.google.com/webstore/devconsole),
   upload a first `.zip` (`npm run build:chrome`) to **create the item**, set
   visibility to **Unlisted**, complete the listing, and submit for review. This
   assigns the permanent **extension ID**. The API cannot create an item — only
   this first upload can.
2. Create API credentials for automation: in Google Cloud Console create a
   project, enable the **Chrome Web Store API**, create an **OAuth 2.0 Client ID**
   (Desktop app) for `CLIENT_ID`/`CLIENT_SECRET`, then run the OAuth flow once to
   get a long-lived `REFRESH_TOKEN` (see the
   [chrome-webstore-upload-cli docs](https://github.com/fregante/chrome-webstore-upload-cli)).
3. Store `EXTENSION_ID`, `CLIENT_ID`, `CLIENT_SECRET`, `REFRESH_TOKEN` as GitHub
   Actions secrets (`CHROME_*`) and, for local publishing, in `.env`.

### Publishing a release

Unlike Firefox, `publish:chrome` does **not** bump the version, commit, tag, or
create a GitHub Release — the Firefox flow owns the version and tag. Run the
Firefox release first (bumps + tags `vX.Y.Z`), then ship the same version to
Chrome:

- **CI:** trigger the **Publish Chrome** workflow after the **Publish** workflow.
- **Local:** `npm run publish:chrome` (reads `CHROME_*` creds from `.env`).

`publish:chrome` builds the `.zip` from the current `src/manifest.json` version
and uploads with `--auto-publish` (goes live once review passes). Unlike AMO
signing, Chrome gates every submission behind a review, so a Chrome release is
not instant.

### Handling rejected pushes

The CI publish workflow pushes version bump commits. If `git push` is rejected, rebase first:

```bash
git pull -r origin main
```

### Release notes

Release notes are auto-generated from `feat:` and `fix:` commits since the last git tag. If no qualifying commits exist, the release body defaults to "CBOR Decoder vX.Y.Z".
