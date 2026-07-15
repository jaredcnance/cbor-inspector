import { describe, it, expect } from "vitest";

const CBOR = require("../src/cbor.js");

function fromHex(hex) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
  }
  return bytes.buffer;
}

describe("CBOR.decode", () => {
  it("decodes unsigned integers", () => {
    expect(CBOR.decode(fromHex("00"))).toBe(0);
    expect(CBOR.decode(fromHex("01"))).toBe(1);
    expect(CBOR.decode(fromHex("17"))).toBe(23);
    expect(CBOR.decode(fromHex("1818"))).toBe(24);
    expect(CBOR.decode(fromHex("1903e8"))).toBe(1000);
    expect(CBOR.decode(fromHex("1a000f4240"))).toBe(1000000);
  });

  it("decodes negative integers", () => {
    expect(CBOR.decode(fromHex("20"))).toBe(-1);
    expect(CBOR.decode(fromHex("29"))).toBe(-10);
    expect(CBOR.decode(fromHex("3863"))).toBe(-100);
  });

  it("decodes text strings", () => {
    expect(CBOR.decode(fromHex("60"))).toBe("");
    expect(CBOR.decode(fromHex("6161"))).toBe("a");
    expect(CBOR.decode(fromHex("6449455446"))).toBe("IETF");
    expect(CBOR.decode(fromHex("62c3bc"))).toBe("ü");
  });

  it("decodes byte strings", () => {
    const result = CBOR.decode(fromHex("4401020304"));
    expect(result).toBeInstanceOf(ArrayBuffer);
    expect(new Uint8Array(result)).toEqual(new Uint8Array([1, 2, 3, 4]));
  });

  it("decodes definite-length arrays", () => {
    expect(CBOR.decode(fromHex("80"))).toEqual([]);
    expect(CBOR.decode(fromHex("83010203"))).toEqual([1, 2, 3]);
  });

  it("decodes definite-length maps", () => {
    expect(CBOR.decode(fromHex("a0"))).toEqual({});
    expect(CBOR.decode(fromHex("a201020304"))).toEqual({ 1: 2, 3: 4 });
  });

  it("decodes maps with string keys", () => {
    // {"a": 1, "b": 2}
    expect(CBOR.decode(fromHex("a2616101616202"))).toEqual({ a: 1, b: 2 });
  });

  it("decodes indefinite-length arrays", () => {
    // [_ 1, 2, 3]
    expect(CBOR.decode(fromHex("9f010203ff"))).toEqual([1, 2, 3]);
  });

  it("decodes indefinite-length maps", () => {
    // {_ "a": 1, "b": 2}
    expect(CBOR.decode(fromHex("bf616101616202ff"))).toEqual({ a: 1, b: 2 });
  });

  it("decodes nested indefinite-length structures", () => {
    // {_ "results": {_ "agent-list": {_ "rows": [_ ]}}}
    const hex = "bf67726573756c7473bf6a6167656e742d6c697374bf64726f77739fffff ffff";
    const clean = hex.replace(/\s/g, "");
    expect(CBOR.decode(fromHex(clean))).toEqual({
      results: { "agent-list": { rows: [] } },
    });
  });

  it("decodes booleans and null", () => {
    expect(CBOR.decode(fromHex("f4"))).toBe(false);
    expect(CBOR.decode(fromHex("f5"))).toBe(true);
    expect(CBOR.decode(fromHex("f6"))).toBe(null);
  });

  it("decodes float64", () => {
    // 1.1 as float64
    const result = CBOR.decode(fromHex("fb3ff199999999999a"));
    expect(result).toBeCloseTo(1.1);
  });

  it("decodes a Smithy RPC v2 style response", () => {
    const b64 = "v2dyZXN1bHRzv2lpdGVtLWxpc3S/Z3F1ZXJ5SWR4JGFiYzEyMzQ1LWRlZjYtNzg5MC1hYmNkLWVmMTIzNDU2Nzg5MGRyb3dzn79paXRlbV9uYW1lbWFscGhhLXNlcnZpY2X/v2lpdGVtX25hbWVuYmV0YS1wcm9jZXNzb3L/v2lpdGVtX25hbWVsZ2FtbWEtd29ya2Vy//////8=";
    const bin = atob(b64);
    const buffer = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) buffer[i] = bin.charCodeAt(i);

    const result = CBOR.decode(buffer.buffer);
    expect(result.results["item-list"].queryId).toBe("abc12345-def6-7890-abcd-ef1234567890");
    expect(result.results["item-list"].rows).toHaveLength(3);
    expect(result.results["item-list"].rows[0].item_name).toBe("alpha-service");
    expect(result.results["item-list"].rows[2].item_name).toBe("gamma-worker");
  });

  it("decodes a stats response", () => {
    const b64 = "v2dyZXN1bHRzv2VzdGF0c79kcm93c5+/ZnA1MF9tc2UxNDIuNWZwOTlfbXNlODkyLjNudG90YWxfcmVxdWVzdHNlNTA0MzJrZXJyb3JfY291bnRlMTI3LjD//////w==";
    const bin = atob(b64);
    const buffer = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) buffer[i] = bin.charCodeAt(i);

    const result = CBOR.decode(buffer.buffer);
    const row = result.results.stats.rows[0];
    expect(row.total_requests).toBe("50432");
    expect(row.error_count).toBe("127.0");
    expect(row.p50_ms).toBe("142.5");
  });
});
