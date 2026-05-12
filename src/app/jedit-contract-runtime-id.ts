const WORLDLINE_ID_PREFIX = 'wl:';
const HEAD_ID_PREFIX = 'head:';
const ROOT_NODE_ID_PREFIX = 'root:';
const CHECKPOINT_ID_PREFIX = 'checkpoint:';
const TICK_ID_PREFIX = 'tick:';
const RECEIPT_ID_PREFIX = 'receipt:';
const NUMERIC_ID_PATTERN = /^\d+$/;
const DECIMAL_RADIX = 10;
const EMPTY_TEXT_LINE_COUNT = 1;
const ROOT_NODE_ID_LABEL = 'root node id';
const CHECKPOINT_ID_LABEL = 'checkpoint id';
const TICK_ID_LABEL = 'tick id';
const RECEIPT_ID_LABEL = 'receipt id';
const RUNTIME_ID_PARSE_ERROR_MESSAGE = 'Invalid runtime id';

export class JeditRuntimeIdParseError extends Error {
  public constructor(label: string, value: string) {
    super(`${RUNTIME_ID_PARSE_ERROR_MESSAGE}: ${label} ${value}`);
    this.name = 'JeditRuntimeIdParseError';
    Object.freeze(this);
  }
}

export class WorldlineId {
  private constructor(public readonly value: string) {
    Object.freeze(this);
  }

  public static fromProjectionPath(path: string): WorldlineId {
    return new WorldlineId(`${WORLDLINE_ID_PREFIX}${path}`);
  }

  public static parse(value: string): WorldlineId | undefined {
    return value.startsWith(WORLDLINE_ID_PREFIX) ? new WorldlineId(value) : undefined;
  }
}

export class HeadId {
  private constructor(public readonly value: string) {
    Object.freeze(this);
  }

  public static fromRootId(rootId: number): HeadId {
    return new HeadId(`${HEAD_ID_PREFIX}${rootId}`);
  }

  public static parse(value: string): HeadId | undefined {
    if (!value.startsWith(HEAD_ID_PREFIX)) {
      return undefined;
    }
    const id = value.slice(HEAD_ID_PREFIX.length);
    return NUMERIC_ID_PATTERN.test(id) ? new HeadId(value) : undefined;
  }
}

export function toWorldlineId(path: string): string {
  return WorldlineId.fromProjectionPath(path).value;
}

export function toHeadId(rootId: number): string {
  return HeadId.fromRootId(rootId).value;
}

export function toRootNodeId(rootId: number): string {
  return `${ROOT_NODE_ID_PREFIX}${rootId}`;
}

export function toCheckpointId(checkpointId: number): string {
  return `${CHECKPOINT_ID_PREFIX}${checkpointId}`;
}

export function toTickId(tickId: number): string {
  return `${TICK_ID_PREFIX}${tickId}`;
}

export function toReceiptId(tickId: number): string {
  return `${RECEIPT_ID_PREFIX}${tickId}`;
}

export function parseWorldlineId(value: string): WorldlineId | undefined {
  return WorldlineId.parse(value);
}

export function parseHeadId(value: string): HeadId | undefined {
  return HeadId.parse(value);
}

export function parseRootNodeId(value: string): number {
  return parseNumericRuntimeId(value, ROOT_NODE_ID_PREFIX, ROOT_NODE_ID_LABEL);
}

export function parseCheckpointId(value: string): number {
  return parseNumericRuntimeId(value, CHECKPOINT_ID_PREFIX, CHECKPOINT_ID_LABEL);
}

export function parseTickId(value: string): number {
  return parseNumericRuntimeId(value, TICK_ID_PREFIX, TICK_ID_LABEL);
}

export function parseReceiptId(value: string): number {
  return parseNumericRuntimeId(value, RECEIPT_ID_PREFIX, RECEIPT_ID_LABEL);
}

const UTF8_ENCODER = new TextEncoder();

export function byteLength(text: string): number {
  return UTF8_ENCODER.encode(text).length;
}

export function lineCount(text: string): number {
  if (text.length === 0) {
    return EMPTY_TEXT_LINE_COUNT;
  }
  return text.split('\n').length;
}

export function digest(text: string, hash: { readonly sha256Hex: (value: string) => string }): string {
  return hash.sha256Hex(text);
}

function parseNumericRuntimeId(value: string, prefix: string, label: string): number {
  if (!value.startsWith(prefix)) {
    throw new JeditRuntimeIdParseError(label, value);
  }

  const id = value.slice(prefix.length);
  if (!NUMERIC_ID_PATTERN.test(id)) {
    throw new JeditRuntimeIdParseError(label, value);
  }

  return Number.parseInt(id, DECIMAL_RADIX);
}
