import { describe, it, expect } from "vitest";

const CBOR = require("../cbor.js");

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
    // Base64 from the original test case (agent-list response)
    const b64 = "v2dyZXN1bHRzv2phZ2VudC1saXN0v2dxdWVyeUlkeCQ2NGUzZTRlOS1jMjE5LTQ2M2EtODk3Yy1lNjQ0MTU1NDhhMGNkcm93c5+/amFnZW50X25hbWVrYXJndXMtYWdlbnT/v2phZ2VudF9uYW1ld2FyZ3VzLXF1aWNrLXF1ZXJ5LWFnZW50/79qYWdlbnRfbmFtZXgYY2xvdWR3YXRjaC1ob3Jpem9uLWFnZW50/79qYWdlbnRfbmFtZXgdZGVsZWdhdGlvbi1jb25maXJtYXRpb24tYWdlbnT/v2phZ2VudF9uYW1leBhqb3VybmFsLXN1bW1hcml6ZXItYWdlbnT/v2phZ2VudF9uYW1lb3F1ZXJ5LWdlbi1hZ2VudP//////";
    const bin = atob(b64);
    const buffer = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) buffer[i] = bin.charCodeAt(i);

    const result = CBOR.decode(buffer.buffer);
    expect(result.results["agent-list"].queryId).toBe("64e3e4e9-c219-463a-897c-e64415548a0c");
    expect(result.results["agent-list"].rows).toHaveLength(6);
    expect(result.results["agent-list"].rows[0].agent_name).toBe("argus-agent");
    expect(result.results["agent-list"].rows[5].agent_name).toBe("query-gen-agent");
  });

  it("decodes a stats response", () => {
    const b64 = "v2dyZXN1bHRzv2VzdGF0c79kcm93c5+/ZnA1MF9uc3IxMTQzMDQxMzk4OC42NjM0MzFmcDk5X25zcTkyODkyNzE3NzA2LjIwNjc5bHRvdGFsX3RyYWNlc2UxMjY5OGZwOTBfbnNxNTEzNzcxODM4NjMuNTA5NzNmYXZnX25zcjE4NzMxMDk3MzE1LjIxMDU4M2xlcnJvcl90cmFjZXNmNzA3NC4wbHRvdGFsX3Rva2Vuc2gyMzQzNjQxN///////"
    const bin = atob(b64);
    const buffer = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) buffer[i] = bin.charCodeAt(i);

    const result = CBOR.decode(buffer.buffer);
    const row = result.results.stats.rows[0];
    expect(row.total_traces).toBe("12698");
    expect(row.error_traces).toBe("7074.0");
    expect(row.total_tokens).toBe("23436417");
  });
});
