const UTF8_ENCODER = new TextEncoder();
const UTF8_DECODER = new TextDecoder();

export function packEintEnvelope(opId, varsBytes) {
  const envelope = new Uint8Array(12 + varsBytes.length);
  envelope.set(encodeUtf8('EINT'), 0);
  writeU32Le(envelope, 4, opId);
  writeU32Le(envelope, 8, varsBytes.length);
  envelope.set(varsBytes, 12);
  return envelope;
}

export function encodeUtf8(text) {
  return UTF8_ENCODER.encode(text);
}

export function bytesAsSequence(bytes) {
  return Array.from(bytes);
}

export function bytesToHex(bytes) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function hexToBytes(hex) {
  if (hex.length % 2 !== 0) {
    throw new Error('hex string must have an even length');
  }
  const bytes = new Uint8Array(hex.length / 2);
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Number.parseInt(hex.slice(index * 2, index * 2 + 2), 16);
  }
  return bytes;
}

export function toByteArray(value) {
  if (value instanceof Uint8Array) {
    return Array.from(value);
  }
  if (Array.isArray(value)) {
    return value;
  }
  throw new Error('expected byte string or byte sequence');
}

export function encodeCbor(value) {
  const chunks = [];
  appendCbor(value, chunks);
  return concatBytes(chunks);
}

export function decodeCbor(bytes) {
  const normalized = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  const cursor = { offset: 0 };
  const value = readCbor(normalized, cursor);
  if (cursor.offset !== normalized.length) {
    throw new Error('trailing CBOR bytes');
  }
  return value;
}

function writeU32Le(bytes, offset, value) {
  bytes[offset] = value & 0xff;
  bytes[offset + 1] = (value >>> 8) & 0xff;
  bytes[offset + 2] = (value >>> 16) & 0xff;
  bytes[offset + 3] = (value >>> 24) & 0xff;
}

function appendCbor(value, chunks) {
  if (value === null) {
    chunks.push(new Uint8Array([0xf6]));
    return;
  }
  if (typeof value === 'boolean') {
    chunks.push(new Uint8Array([value ? 0xf5 : 0xf4]));
    return;
  }
  if (typeof value === 'number') {
    if (!Number.isSafeInteger(value)) {
      throw new Error('CBOR witness encoder only supports safe integers');
    }
    appendCborInteger(value, chunks);
    return;
  }
  if (typeof value === 'string') {
    appendCborText(value, chunks);
    return;
  }
  if (value instanceof Uint8Array) {
    appendCborBytes(value, chunks);
    return;
  }
  if (Array.isArray(value)) {
    appendMajorLength(4, value.length, chunks);
    for (const item of value) {
      appendCbor(item, chunks);
    }
    return;
  }
  appendCborObject(value, chunks);
}

function appendCborObject(value, chunks) {
  const entries = Object.entries(value).map(([key, entryValue]) => {
    const encodedKey = encodeCbor(key);
    const encodedValue = encodeCbor(entryValue);
    return { encodedKey, encodedValue };
  });
  entries.sort((left, right) => compareBytes(left.encodedKey, right.encodedKey));
  appendMajorLength(5, entries.length, chunks);
  for (const entry of entries) {
    chunks.push(entry.encodedKey);
    chunks.push(entry.encodedValue);
  }
}

function appendCborInteger(value, chunks) {
  if (value >= 0) {
    appendMajorLength(0, value, chunks);
    return;
  }
  appendMajorLength(1, -1 - value, chunks);
}

function appendCborText(value, chunks) {
  const bytes = encodeUtf8(value);
  appendMajorLength(3, bytes.length, chunks);
  chunks.push(bytes);
}

function appendCborBytes(value, chunks) {
  appendMajorLength(2, value.length, chunks);
  chunks.push(value);
}

function appendMajorLength(major, length, chunks) {
  if (length <= 23) {
    chunks.push(new Uint8Array([(major << 5) | length]));
  } else if (length <= 0xff) {
    chunks.push(new Uint8Array([(major << 5) | 24, length]));
  } else if (length <= 0xffff) {
    chunks.push(new Uint8Array([(major << 5) | 25, length >> 8, length & 0xff]));
  } else if (length <= 0xffff_ffff) {
    chunks.push(new Uint8Array([
      (major << 5) | 26,
      (length >>> 24) & 0xff,
      (length >>> 16) & 0xff,
      (length >>> 8) & 0xff,
      length & 0xff,
    ]));
  } else {
    throw new Error('CBOR witness encoder does not support lengths above u32::MAX');
  }
}

function readCbor(bytes, cursor) {
  const initial = readByte(bytes, cursor);
  const major = initial >> 5;
  const additional = initial & 0x1f;
  switch (major) {
    case 0:
      return readLength(bytes, cursor, additional);
    case 1:
      return -1 - readLength(bytes, cursor, additional);
    case 2:
      return readByteString(bytes, cursor, additional);
    case 3:
      return UTF8_DECODER.decode(readByteString(bytes, cursor, additional));
    case 4:
      return readArray(bytes, cursor, additional);
    case 5:
      return readMap(bytes, cursor, additional);
    case 7:
      return readSimple(additional);
    default:
      throw new Error(`unsupported CBOR major type ${major}`);
  }
}

function readArray(bytes, cursor, additional) {
  const length = readLength(bytes, cursor, additional);
  const values = [];
  for (let index = 0; index < length; index += 1) {
    values.push(readCbor(bytes, cursor));
  }
  return values;
}

function readMap(bytes, cursor, additional) {
  const length = readLength(bytes, cursor, additional);
  const value = Object.create(null);
  for (let index = 0; index < length; index += 1) {
    const key = readCbor(bytes, cursor);
    if (typeof key !== 'string') {
      throw new Error('CBOR witness decoder only supports string map keys');
    }
    value[key] = readCbor(bytes, cursor);
  }
  return value;
}

function readByteString(bytes, cursor, additional) {
  const length = readLength(bytes, cursor, additional);
  const start = cursor.offset;
  const end = start + length;
  if (end > bytes.length) {
    throw new Error('incomplete CBOR byte string');
  }
  cursor.offset = end;
  return bytes.slice(start, end);
}

function readSimple(additional) {
  switch (additional) {
    case 20:
      return false;
    case 21:
      return true;
    case 22:
      return null;
    default:
      throw new Error(`unsupported CBOR simple value ${additional}`);
  }
}

function readLength(bytes, cursor, additional) {
  if (additional <= 23) {
    return additional;
  }
  if (additional === 24) {
    return readByte(bytes, cursor);
  }
  if (additional === 25) {
    return (readByte(bytes, cursor) << 8) | readByte(bytes, cursor);
  }
  if (additional === 26) {
    return (
      (readByte(bytes, cursor) * 0x1_000000)
      + (readByte(bytes, cursor) << 16)
      + (readByte(bytes, cursor) << 8)
      + readByte(bytes, cursor)
    );
  }
  throw new Error(`unsupported CBOR additional length ${additional}`);
}

function readByte(bytes, cursor) {
  if (cursor.offset >= bytes.length) {
    throw new Error('incomplete CBOR input');
  }
  const value = bytes[cursor.offset];
  cursor.offset += 1;
  return value;
}

function concatBytes(chunks) {
  const length = chunks.reduce((total, chunk) => total + chunk.length, 0);
  const out = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
}

function compareBytes(left, right) {
  const length = Math.min(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    const delta = left[index] - right[index];
    if (delta !== 0) {
      return delta;
    }
  }
  return left.length - right.length;
}
