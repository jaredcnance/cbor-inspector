import { describe, it, expect } from "vitest";

const Format = require("../src/format.js");

describe("escapeHtml", () => {
  it("escapes HTML-significant characters", () => {
    expect(Format.escapeHtml('<img src=x onerror=alert(1)>')).toBe(
      "&lt;img src=x onerror=alert(1)&gt;"
    );
    expect(Format.escapeHtml("a & b")).toBe("a &amp; b");
    expect(Format.escapeHtml("plain")).toBe("plain");
  });

  it("escapes ampersands before angle brackets (no double-escape)", () => {
    expect(Format.escapeHtml("&lt;")).toBe("&amp;lt;");
  });

  it("coerces non-strings", () => {
    expect(Format.escapeHtml(42)).toBe("42");
  });
});

describe("syntaxHighlight", () => {
  it("wraps JSON tokens in highlight spans", () => {
    const html = Format.syntaxHighlight('{\n  "a": 1\n}');
    expect(html).toContain('<span class="json-key">"a":</span>');
    expect(html).toContain('<span class="json-number">1</span>');
  });

  it("escapes markup inside string values before highlighting", () => {
    const html = Format.syntaxHighlight('{\n  "x": "<script>"\n}');
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });
});

describe("isCborResponse", () => {
  const withContentType = (value) => ({
    response: { headers: [{ name: "Content-Type", value }] },
  });

  it("matches cbor content types", () => {
    expect(Format.isCborResponse(withContentType("application/cbor"))).toBe(true);
    expect(Format.isCborResponse(withContentType("application/vnd.amazon.eventstream"))).toBe(true);
  });

  it("rejects non-cbor and missing responses", () => {
    expect(Format.isCborResponse(withContentType("application/json"))).toBe(false);
    expect(Format.isCborResponse({})).toBe(false);
    expect(Format.isCborResponse({ response: {} })).toBe(false);
  });
});

describe("getResourceName", () => {
  it("returns the last non-empty path segment", () => {
    expect(Format.getResourceName("/service/Operation")).toBe("Operation");
    expect(Format.getResourceName("/a/b/c/")).toBe("c");
  });

  it("falls back to the whole path when there are no segments", () => {
    expect(Format.getResourceName("/")).toBe("/");
  });
});

describe("statusClass", () => {
  it("classifies status codes", () => {
    expect(Format.statusClass(200)).toBe("status-ok");
    expect(Format.statusClass(301)).toBe("status-ok");
    expect(Format.statusClass(404)).toBe("status-err");
    expect(Format.statusClass(500)).toBe("status-err");
    expect(Format.statusClass(0)).toBe("");
  });
});

describe("parseCookies", () => {
  it("parses name=value pairs from Cookie headers", () => {
    const headers = [{ name: "Cookie", value: "a=1; b=2; c=hello=world" }];
    expect(Format.parseCookies(headers)).toEqual([
      { name: "a", value: "1" },
      { name: "b", value: "2" },
      { name: "c", value: "hello=world" },
    ]);
  });

  it("ignores non-cookie headers and pairs with no '='", () => {
    const headers = [
      { name: "Authorization", value: "Bearer x" },
      { name: "cookie", value: "valid=1;noeq" },
    ];
    expect(Format.parseCookies(headers)).toEqual([{ name: "valid", value: "1" }]);
  });

  it("returns empty for missing headers", () => {
    expect(Format.parseCookies(null)).toEqual([]);
    expect(Format.parseCookies([])).toEqual([]);
  });
});

describe("decodeCborBody", () => {
  // {"a": 1, "b": 2} in CBOR = a2 6161 01 6162 02, base64 of those bytes.
  const cborBase64 = Buffer.from([0xa2, 0x61, 0x61, 0x01, 0x61, 0x62, 0x02]).toString("base64");

  it("decodes base64-encoded CBOR to pretty JSON", () => {
    const out = Format.decodeCborBody(cborBase64);
    expect(JSON.parse(out)).toEqual({ a: 1, b: 2 });
  });

  it("returns null for empty or undecodable input", () => {
    expect(Format.decodeCborBody("")).toBe(null);
    expect(Format.decodeCborBody(null)).toBe(null);
  });

  it("renders binary byte strings as a placeholder", () => {
    // byte string of length 4: 44 01 02 03 04 (base64 > 4 chars so the base64 path is taken)
    const b64 = Buffer.from([0x44, 0x01, 0x02, 0x03, 0x04]).toString("base64");
    expect(Format.decodeCborBody(b64)).toContain("<binary 4 bytes>");
  });
});
