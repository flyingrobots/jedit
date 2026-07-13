const ZERO_BYTE_OFFSET = 0;
const REPLACE_RANGE_ERROR_INVALID_RANGE = 1;
const REPLACE_RANGE_ERROR_OUT_OF_BOUNDS = 2;
const REPLACE_RANGE_ERROR_INVALID_UTF8_BOUNDARY = 3;
const REPLACE_RANGE_ERROR_INVALID_ROOT_ID = 4;

export const FIRST_ROOT_ID = 1;

const TEXT_ENCODER = new TextEncoder();
const TEXT_DECODER = new TextDecoder('utf-8', { fatal: true });

export interface TextPoint {
  readonly byte: number;
}

export interface TextRange {
  readonly start: TextPoint;
  readonly end: TextPoint;
}

export interface BufferRoot {
  readonly id: number;
  readonly text: string;
}

export interface TextFragment {
  readonly root: BufferRoot;
}

export interface ReplaceReceipt {
  readonly baseRootId: number;
  readonly nextRootId: number;
  readonly replaced: TextRange;
  readonly insertedRootId: number;
}

export interface ReplaceResult {
  readonly nextRoot: BufferRoot;
  readonly receipt?: ReplaceReceipt;
}

export class TextEditContractError extends Error {
  public readonly code: number;

  public constructor(code: number, message: string) {
    super(message);
    this.name = 'TextEditContractError';
    this.code = code;
  }
}

export function createTextPoint(byte: number): TextPoint {
  return { byte };
}

export function createTextRange(startByte: number, endByte: number): TextRange {
  return {
    start: createTextPoint(startByte),
    end: createTextPoint(endByte),
  };
}

export function createBufferRoot(id: number, text: string): BufferRoot {
  validateRootId(id);

  return { id, text };
}

export function createTextFragment(id: number, text: string): TextFragment {
  const root = createBufferRoot(id, text);
  return { root };
}

export function materializeRoot(root: BufferRoot): string {
  return root.text;
}

export function emptyFragment(id: number): TextFragment {
  return createTextFragment(id, '');
}

export function replaceRange(
  baseRoot: BufferRoot,
  range: TextRange,
  fragment: TextFragment,
  nextRootId: number,
): ReplaceResult {
  validateRootId(nextRootId);
  const baseBytes = encodeText(baseRoot.text);
  validateRange(range, baseBytes.length);
  ensureUtf8Boundary(baseBytes, range.start.byte);
  ensureUtf8Boundary(baseBytes, range.end.byte);

  const insertedBytes = encodeText(fragment.root.text);
  const replacedBytes = baseBytes.subarray(range.start.byte, range.end.byte);
  if (equalBytes(replacedBytes, insertedBytes)) {
    return {
      nextRoot: baseRoot,
    };
  }

  const nextRoot = createBufferRoot(
    nextRootId,
    decodeText(concatBytes(
      baseBytes.subarray(ZERO_BYTE_OFFSET, range.start.byte),
      insertedBytes,
      baseBytes.subarray(range.end.byte),
    )),
  );

  return {
    nextRoot,
    receipt: {
      baseRootId: baseRoot.id,
      nextRootId: nextRoot.id,
      replaced: range,
      insertedRootId: fragment.root.id,
    },
  };
}

export function firstPoint(): TextPoint {
  return createTextPoint(ZERO_BYTE_OFFSET);
}

function validateRootId(id: number): void {
  if (!Number.isInteger(id) || id < FIRST_ROOT_ID) {
    throw new TextEditContractError(
      REPLACE_RANGE_ERROR_INVALID_ROOT_ID,
      'Buffer roots require positive integer ids.',
    );
  }
}

function validateRange(range: TextRange, byteLength: number): void {
  if (range.start.byte > range.end.byte) {
    throw new TextEditContractError(
      REPLACE_RANGE_ERROR_INVALID_RANGE,
      'ReplaceRange requires start <= end.',
    );
  }

  if (range.start.byte < ZERO_BYTE_OFFSET || range.end.byte > byteLength) {
    throw new TextEditContractError(
      REPLACE_RANGE_ERROR_OUT_OF_BOUNDS,
      'ReplaceRange byte range is outside the root text.',
    );
  }
}

function ensureUtf8Boundary(bytes: Uint8Array, offset: number): void {
  try {
    decodeText(bytes.subarray(ZERO_BYTE_OFFSET, offset));
    decodeText(bytes.subarray(offset));
  } catch {
    throw new TextEditContractError(
      REPLACE_RANGE_ERROR_INVALID_UTF8_BOUNDARY,
      'ReplaceRange requires valid UTF-8 text boundaries.',
    );
  }
}

function encodeText(text: string): Uint8Array {
  return TEXT_ENCODER.encode(text);
}

function decodeText(bytes: Uint8Array): string {
  return TEXT_DECODER.decode(bytes);
}

function equalBytes(left: Uint8Array, right: Uint8Array): boolean {
  if (left.length !== right.length) {
    return false;
  }

  for (let index = ZERO_BYTE_OFFSET; index < left.length; index += 1) {
    if (left[index] !== right[index]) {
      return false;
    }
  }

  return true;
}

function concatBytes(prefix: Uint8Array, middle: Uint8Array, suffix: Uint8Array): Uint8Array {
  const next = new Uint8Array(prefix.length + middle.length + suffix.length);
  next.set(prefix, ZERO_BYTE_OFFSET);
  next.set(middle, prefix.length);
  next.set(suffix, prefix.length + middle.length);
  return next;
}
