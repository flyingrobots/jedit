const WORLDLINE_ID_PREFIX = 'wl:';
const HEAD_ID_PREFIX = 'head:';
const ROOT_NODE_ID_PREFIX = 'root:';
const CHECKPOINT_ID_PREFIX = 'checkpoint:';
const TICK_ID_PREFIX = 'tick:';
const RECEIPT_ID_PREFIX = 'receipt:';

export function toWorldlineId(path: string): string {
  return `${WORLDLINE_ID_PREFIX}${path}`;
}

export function toHeadId(rootId: number): string {
  return `${HEAD_ID_PREFIX}${rootId}`;
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
  return `${RECEIPT_ID_PREFIX}${toTickId(tickId)}`;
}

const UTF8_ENCODER = new TextEncoder();

export function byteLength(text: string): number {
  return UTF8_ENCODER.encode(text).length;
}

export function lineCount(text: string): number {
  if (text.length === 0) {
    return 1;
  }
  return text.split('\n').length;
}

export function digest(text: string, hash: { readonly sha256Hex: (value: string) => string }): string {
  return hash.sha256Hex(text);
}
