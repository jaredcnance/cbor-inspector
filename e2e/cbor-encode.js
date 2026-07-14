// Minimal CBOR encoder for test fixtures
function encode(value) {
  const parts = [];

  function encodeValue(v) {
    if (v === null || v === undefined) {
      parts.push(new Uint8Array([0xf6])); // null
    } else if (typeof v === "boolean") {
      parts.push(new Uint8Array([v ? 0xf5 : 0xf4]));
    } else if (typeof v === "number") {
      if (Number.isInteger(v) && v >= 0 && v < 24) {
        parts.push(new Uint8Array([v]));
      } else if (Number.isInteger(v) && v >= 0 && v < 256) {
        parts.push(new Uint8Array([0x18, v]));
      } else if (Number.isInteger(v) && v >= 0 && v < 65536) {
        const buf = new Uint8Array(3);
        buf[0] = 0x19;
        buf[1] = (v >> 8) & 0xff;
        buf[2] = v & 0xff;
        parts.push(buf);
      } else {
        // float64
        const buf = new ArrayBuffer(9);
        const view = new DataView(buf);
        view.setUint8(0, 0xfb);
        view.setFloat64(1, v);
        parts.push(new Uint8Array(buf));
      }
    } else if (typeof v === "string") {
      const encoded = new TextEncoder().encode(v);
      encodeLength(3, encoded.length);
      parts.push(encoded);
    } else if (Array.isArray(v)) {
      encodeLength(4, v.length);
      for (const item of v) encodeValue(item);
    } else if (typeof v === "object") {
      const keys = Object.keys(v);
      encodeLength(5, keys.length);
      for (const key of keys) {
        encodeValue(key);
        encodeValue(v[key]);
      }
    }
  }

  function encodeLength(majorType, length) {
    const mt = majorType << 5;
    if (length < 24) {
      parts.push(new Uint8Array([mt | length]));
    } else if (length < 256) {
      parts.push(new Uint8Array([mt | 24, length]));
    } else if (length < 65536) {
      const buf = new Uint8Array(3);
      buf[0] = mt | 25;
      buf[1] = (length >> 8) & 0xff;
      buf[2] = length & 0xff;
      parts.push(buf);
    }
  }

  encodeValue(value);
  const totalLength = parts.reduce((sum, p) => sum + p.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.length;
  }
  return result.buffer;
}

module.exports = { encode };
