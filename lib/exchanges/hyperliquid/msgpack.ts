type MsgpackValue =
  | null
  | boolean
  | number
  | string
  | MsgpackValue[]
  | { [key: string]: MsgpackValue };

function concat(chunks: Uint8Array[]): Uint8Array {
  const length = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const out = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
}

function encodeString(value: string): Uint8Array {
  const bytes = new TextEncoder().encode(value);
  if (bytes.length < 32) {
    return concat([Uint8Array.of(0xa0 | bytes.length), bytes]);
  }
  if (bytes.length < 256) {
    return concat([Uint8Array.of(0xd9, bytes.length), bytes]);
  }
  if (bytes.length < 65536) {
    const header = new Uint8Array(3);
    header[0] = 0xda;
    header[1] = (bytes.length >> 8) & 0xff;
    header[2] = bytes.length & 0xff;
    return concat([header, bytes]);
  }
  const header = new Uint8Array(5);
  header[0] = 0xdb;
  const view = new DataView(header.buffer);
  view.setUint32(1, bytes.length);
  return concat([header, bytes]);
}

function encodeNumber(value: number): Uint8Array {
  if (!Number.isFinite(value) || !Number.isInteger(value)) {
    throw new Error("Hyperliquid msgpack only encodes integers.");
  }
  if (value >= 0 && value <= 127) {
    return Uint8Array.of(value);
  }
  if (value < 0 && value >= -32) {
    return Uint8Array.of(value & 0xff);
  }
  if (value >= 0 && value <= 0xff) {
    return Uint8Array.of(0xcc, value);
  }
  if (value >= 0 && value <= 0xffff) {
    return Uint8Array.of(0xcd, (value >> 8) & 0xff, value & 0xff);
  }
  if (value >= 0 && value <= 0xffffffff) {
    const out = new Uint8Array(5);
    out[0] = 0xce;
    new DataView(out.buffer).setUint32(1, value);
    return out;
  }
  const out = new Uint8Array(9);
  out[0] = 0xcf;
  new DataView(out.buffer).setBigUint64(1, BigInt(value));
  return out;
}

export function encodeMsgpack(value: MsgpackValue): Uint8Array {
  if (value === null) {
    return Uint8Array.of(0xc0);
  }
  if (value === false) {
    return Uint8Array.of(0xc2);
  }
  if (value === true) {
    return Uint8Array.of(0xc3);
  }
  if (typeof value === "number") {
    return encodeNumber(value);
  }
  if (typeof value === "string") {
    return encodeString(value);
  }
  if (Array.isArray(value)) {
    const items = value.map(encodeMsgpack);
    if (value.length < 16) {
      return concat([Uint8Array.of(0x90 | value.length), ...items]);
    }
    if (value.length < 65536) {
      const header = new Uint8Array(3);
      header[0] = 0xdc;
      header[1] = (value.length >> 8) & 0xff;
      header[2] = value.length & 0xff;
      return concat([header, ...items]);
    }
    const header = new Uint8Array(5);
    header[0] = 0xdd;
    new DataView(header.buffer).setUint32(1, value.length);
    return concat([header, ...items]);
  }
  const keys = Object.keys(value);
  const pairs = keys.flatMap((key) => [
    encodeString(key),
    encodeMsgpack(value[key]),
  ]);
  if (keys.length < 16) {
    return concat([Uint8Array.of(0x80 | keys.length), ...pairs]);
  }
  if (keys.length < 65536) {
    const header = new Uint8Array(3);
    header[0] = 0xde;
    header[1] = (keys.length >> 8) & 0xff;
    header[2] = keys.length & 0xff;
    return concat([header, ...pairs]);
  }
  const header = new Uint8Array(5);
  header[0] = 0xdf;
  new DataView(header.buffer).setUint32(1, keys.length);
  return concat([header, ...pairs]);
}
