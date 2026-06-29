// Minimal CBOR decoder - handles indefinite-length maps/arrays (Smithy RPC v2 style)
const CBOR = (() => {
  function decode(buffer) {
    const view = new DataView(buffer instanceof ArrayBuffer ? buffer : buffer.buffer);
    let offset = 0;

    function read() {
      const ib = view.getUint8(offset++);
      const mt = ib >> 5;
      const ai = ib & 0x1f;

      if (ib === 0xff) return Symbol.for("break");

      let val;
      if (ai < 24) val = ai;
      else if (ai === 24) val = view.getUint8(offset++);
      else if (ai === 25) { val = view.getUint16(offset); offset += 2; }
      else if (ai === 26) { val = view.getUint32(offset); offset += 4; }
      else if (ai === 27) {
        const hi = view.getUint32(offset);
        const lo = view.getUint32(offset + 4);
        offset += 8;
        val = hi * 0x100000000 + lo;
      } else if (ai === 31) val = -1; // indefinite
      else throw new Error(`Unsupported additional info: ${ai}`);

      switch (mt) {
        case 0: return val;
        case 1: return -1 - val;
        case 2: { // byte string
          if (val === -1) {
            const chunks = [];
            while (true) {
              const chunk = read();
              if (chunk === Symbol.for("break")) break;
              chunks.push(chunk);
            }
            const totalLen = chunks.reduce((s, c) => s + c.byteLength, 0);
            const merged = new Uint8Array(totalLen);
            let pos = 0;
            for (const c of chunks) { merged.set(new Uint8Array(c), pos); pos += c.byteLength; }
            return merged.buffer;
          }
          const bytes = buffer.slice(offset, offset + val);
          offset += val;
          return bytes;
        }
        case 3: { // text string
          if (val === -1) {
            let str = "";
            while (true) {
              const chunk = read();
              if (chunk === Symbol.for("break")) break;
              str += chunk;
            }
            return str;
          }
          const strBytes = new Uint8Array(buffer instanceof ArrayBuffer ? buffer : buffer.buffer, offset, val);
          offset += val;
          return new TextDecoder().decode(strBytes);
        }
        case 4: { // array
          const arr = [];
          if (val === -1) {
            while (true) {
              const item = read();
              if (item === Symbol.for("break")) break;
              arr.push(item);
            }
          } else {
            for (let i = 0; i < val; i++) arr.push(read());
          }
          return arr;
        }
        case 5: { // map
          const obj = {};
          if (val === -1) {
            while (true) {
              const key = read();
              if (key === Symbol.for("break")) break;
              obj[key] = read();
            }
          } else {
            for (let i = 0; i < val; i++) {
              const key = read();
              obj[key] = read();
            }
          }
          return obj;
        }
        case 6: return read(); // tagged value - just unwrap
        case 7: {
          if (ai === 20) return false;
          if (ai === 21) return true;
          if (ai === 22) return null;
          if (ai === 23) return undefined;
          if (ai === 25) { // float16
            const half = val;
            const exp = (half >> 10) & 0x1f;
            const mant = half & 0x3ff;
            let fval;
            if (exp === 0) fval = mant * 2 ** -24;
            else if (exp === 31) fval = mant === 0 ? Infinity : NaN;
            else fval = (mant + 1024) * 2 ** (exp - 25);
            return half & 0x8000 ? -fval : fval;
          }
          if (ai === 26) { // float32
            offset -= 4;
            const f = view.getFloat32(offset);
            offset += 4;
            return f;
          }
          if (ai === 27) { // float64
            offset -= 8;
            const f = view.getFloat64(offset);
            offset += 8;
            return f;
          }
          return undefined;
        }
      }
    }

    return read();
  }

  return { decode };
})();
