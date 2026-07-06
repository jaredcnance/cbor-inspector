# CBOR Inspector

DevTools extension that auto-decodes Smithy RPC v2 CBOR (`application/cbor`) responses. Works in both Firefox and Chrome.

## Features

- Adds a **CBOR** tab to DevTools
- Auto-captures requests with CBOR content-type as they happen
- Decodes and displays response bodies as syntax-highlighted JSON
- Collapsible request/response headers and request body
- Copy-to-clipboard buttons on decoded JSON
- Handles indefinite-length maps/arrays (Smithy RPC v2 style)
- Zero dependencies — self-contained CBOR decoder

## Installation

### Firefox

Install the latest signed extension from [GitHub Releases](https://github.com/jaredcnance/cbor-inspector/releases/latest). Download the `.xpi` file and Firefox will prompt you to install it. Updates are delivered automatically.

### Chrome

Chrome installation currently requires loading the extension manually in developer mode (see Development section below).

## Usage

1. Open DevTools (F12)
2. Click the **CBOR** tab
3. Make requests — any response with `content-type: application/cbor` is automatically captured
4. Click an entry in the left pane to view decoded JSON and headers

## Development

### Local installation

#### Firefox

1. Navigate to `about:debugging#/runtime/this-firefox`
2. Click **Load Temporary Add-on...**
3. Select the `manifest.json` file from this directory

#### Chrome

1. Navigate to `chrome://extensions`
2. Enable **Developer mode** (toggle in top-right)
3. Click **Load unpacked**
4. Select this directory

### Running tests

```bash
npm install
npm test
```

### Pre-commit hook

A pre-commit hook runs the test suite before each commit. It's configured automatically when you run `npm install` (via the `prepare` script).

### Publishing

```bash
npm run publish:firefox
```

This bumps the patch version, signs with Mozilla, updates `updates.json`, commits, pushes to both remotes, and creates a GitHub Release.

## License

MIT
