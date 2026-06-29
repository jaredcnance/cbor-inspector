# CBOR Debugger

DevTools extension that auto-decodes Smithy RPC v2 CBOR (`application/cbor`) responses. Works in both Firefox and Chrome.

## Features

- Adds a **CBOR** tab to DevTools
- Auto-captures requests with CBOR content-type as they happen
- Decodes and displays response bodies as syntax-highlighted JSON
- Collapsible request/response headers view
- Handles indefinite-length maps/arrays (Smithy RPC v2 style)
- Zero dependencies — self-contained CBOR decoder

## Installation

### Firefox

1. Navigate to `about:debugging#/runtime/this-firefox`
2. Click **Load Temporary Add-on...**
3. Select the `manifest.json` file from this directory

### Chrome

1. Navigate to `chrome://extensions`
2. Enable **Developer mode** (toggle in top-right)
3. Click **Load unpacked**
4. Select this directory

## Usage

1. Open DevTools (F12)
2. Click the **CBOR** tab
3. Make requests — any response with `content-type: application/cbor` is automatically captured
4. Click an entry in the left pane to view decoded JSON and headers

## Files

- `manifest.json` — Extension manifest
- `devtools.js` — Registers the DevTools panel
- `panel.html` / `panel.js` — Panel UI and logic
- `cbor.js` — Minimal CBOR decoder supporting indefinite-length encoding
- `icon.svg` — Panel tab icon
