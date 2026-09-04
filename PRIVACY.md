# Privacy Policy

**Extension:** CBOR Decoder
**Last updated:** September 4, 2026

## Summary

CBOR Decoder does not collect, store, transmit, or sell any personal or user
data. All processing happens locally in your browser. Nothing leaves your
machine.

## What the extension does

CBOR Decoder is a Chrome DevTools panel that automatically decodes
CBOR-encoded network responses — specifically Smithy RPC v2 CBOR
(`application/cbor`) — and displays them as syntax-highlighted, human-readable
JSON. It exists to help developers inspect binary CBOR API traffic while
debugging a web page, the same way DevTools already shows JSON responses.

## Data collection

**We collect no data.** The extension does not:

- Collect, log, or store personally identifiable information.
- Track your browsing activity or history.
- Send any data to the developer or to any third party.
- Include analytics, telemetry, advertising, or crash reporting.
- Use cookies or any form of persistent user identifier.

## How your information is handled

To do its job, the extension reads network request and response data **only for
the page you are actively inspecting with DevTools**:

- It reads request and response **headers** (via the `webRequest` permission) to
  detect which requests are CBOR-encoded so it can show a loading state.
- It reads CBOR **response bodies** (via the DevTools network API) to decode and
  display them as JSON in the panel.

This data is processed **entirely within your browser**, held in memory only for
the lifetime of the open DevTools session, and displayed only to you. It is
never persisted to disk, never transmitted off your device, and never shared.
Closing the DevTools panel or the tab discards it.

## Permissions and why they are needed

- **`webRequest`** — to read request/response headers and identify CBOR traffic
  so the panel can reflect in-flight requests. It is not used to block, redirect,
  or modify any request.
- **Host access (`<all_urls>`)** — because CBOR APIs can be served from any
  domain, the extension must be able to observe traffic on whatever site you
  open DevTools on. It does not inject content scripts, and it does not read or
  modify page content.

## Remote code

The extension executes only the code packaged in its published release. It does
not load external scripts, use `eval`, or fetch and run code at runtime.

## Changes to this policy

If this policy changes, the updated version will be published in this
repository and the "Last updated" date above will be revised.

## Contact

Questions or concerns about privacy? Open an issue at
<https://github.com/jaredcnance/cbor-inspector/issues>.
