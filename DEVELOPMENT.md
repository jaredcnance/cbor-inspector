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

## Manual testing in Firefox

1. Open `about:debugging` > This Firefox > Load Temporary Add-on
2. Select `manifest.json` from the project root
3. Open DevTools on any page — the "CBOR" panel appears
4. Visit a page that makes Smithy RPC v2 CBOR requests (content-type containing `cbor` or `application/vnd.amazon`)

After modifying `manifest.json`, you must remove and re-add the extension, then reopen DevTools.

## Manual testing in Chrome

1. Open `chrome://extensions` with Developer mode enabled
2. Click "Load unpacked" and select the project root
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
npx web-ext lint --source-dir . --self-hosted --ignore-files "test/" "node_modules/" "package.json" "package-lock.json" ".git" ".gitignore" ".githooks" "dist/" "updates.json" "scripts/" ".env" ".github/"
```

The `--self-hosted` flag is required because the manifest includes `update_url`.

## Publishing a release

### Automated (CI)

Trigger the **Publish** workflow manually from GitHub Actions. It will:
1. Run tests
2. Bump the patch version in `manifest.json`
3. Sign the extension with Mozilla (unlisted)
4. Update `updates.json` with the new download URL
5. Commit and push
6. Create a GitHub Release with the `.xpi` and auto-generated notes

### Local

Requires a `.env` file with Mozilla API credentials:

```
WEB_EXT_API_KEY=<JWT issuer from addons.mozilla.org>
WEB_EXT_API_SECRET=<JWT secret>
```

Then run:

```bash
npm run publish:firefox
```

This performs the same steps as CI locally. After completion, it pushes to both remotes and creates the GitHub Release.

### Handling rejected pushes

The CI publish workflow pushes version bump commits. If `git push` is rejected, rebase first:

```bash
git pull -r origin main
```

### Release notes

Release notes are auto-generated from `feat:` and `fix:` commits since the last git tag. If no qualifying commits exist, the release body defaults to "CBOR Decoder vX.Y.Z".
