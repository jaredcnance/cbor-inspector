// Pure formatting / detection helpers shared by the panel.
// No DOM dependencies — safe to unit-test under Node (test/format.test.js).
const Format = (() => {
  // In the browser cbor.js runs first and defines a global `CBOR`; under Node we require it.
  const _CBOR = (typeof module !== "undefined" && typeof require !== "undefined")
    ? require("./cbor.js")
    : CBOR;

  // Escape HTML-significant characters. All text placed into innerHTML must pass
  // through this (directly, or via syntaxHighlight which escapes internally).
  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  // True if the response looks like CBOR based on its Content-Type header.
  function isCborResponse(entry) {
    if (!entry.response || !entry.response.headers) return false;
    return entry.response.headers.some(
      h => h.name.toLowerCase() === "content-type" &&
           (h.value.includes("cbor") || h.value.includes("application/vnd.amazon"))
    );
  }

  // Escape then wrap JSON tokens in highlight spans. Escaping first guarantees any
  // string value (e.g. "<img onerror=...>") is inert before it reaches innerHTML.
  function syntaxHighlight(json) {
    const escaped = escapeHtml(json);
    return escaped.replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g, (match) => {
      let cls = "json-number";
      if (/^"/.test(match)) {
        cls = /:$/.test(match) ? "json-key" : "json-string";
      } else if (/true|false/.test(match)) {
        cls = "json-bool";
      } else if (/null/.test(match)) {
        cls = "json-null";
      }
      return `<span class="${cls}">${match}</span>`;
    });
  }

  // Last non-empty path segment (the RPC operation name), or the whole path.
  function getResourceName(pathname) {
    const segments = pathname.split("/").filter(Boolean);
    return segments.length > 0 ? segments[segments.length - 1] : pathname;
  }

  function statusClass(status) {
    if (status >= 400) return "status-err";
    if (status >= 200 && status < 400) return "status-ok";
    return "";
  }

  function stringToBytes(str) {
    const buffer = new Uint8Array(str.length);
    for (let i = 0; i < str.length; i++) buffer[i] = str.charCodeAt(i) & 0xff;
    return buffer;
  }

  // Decode a raw response/request body (base64 or binary string) to pretty JSON.
  // Returns null if it isn't decodable CBOR.
  function decodeCborBody(raw) {
    if (!raw) return null;
    try {
      let buffer;
      const looksBase64 = /^[A-Za-z0-9+/\s]+=*\s*$/.test(raw) && raw.length > 4;
      if (looksBase64) {
        const clean = raw.replace(/\s/g, "");
        buffer = stringToBytes(atob(clean));
      } else {
        buffer = stringToBytes(raw);
      }
      const decoded = _CBOR.decode(buffer.buffer);
      return JSON.stringify(decoded, (key, val) => {
        if (val instanceof ArrayBuffer) return `<binary ${val.byteLength} bytes>`;
        return val;
      }, 2);
    } catch (e) {
      return null;
    }
  }

  // Extract name/value pairs from Cookie request headers.
  function parseCookies(headers) {
    if (!headers) return [];
    const cookies = [];
    for (const h of headers) {
      if (h.name.toLowerCase() === "cookie") {
        for (const pair of h.value.split(";")) {
          const eq = pair.indexOf("=");
          if (eq > 0) {
            cookies.push({ name: pair.slice(0, eq).trim(), value: pair.slice(eq + 1).trim() });
          }
        }
      }
    }
    return cookies;
  }

  return {
    escapeHtml,
    isCborResponse,
    syntaxHighlight,
    getResourceName,
    statusClass,
    decodeCborBody,
    parseCookies,
  };
})();

if (typeof module !== "undefined") module.exports = Format;
