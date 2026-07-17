const ANCHOR_BIAS_LEFT = 1;
const ANCHOR_BIAS_RIGHT = 2;
const ZERO_BYTES = 0;
const ANCHOR_TRANSFORM_ERROR_INVALID_ANCHOR = 1;
const ANCHOR_TRANSFORM_ERROR_INVALID_DELTA = 2;

export interface PointAnchor {
  readonly byte: number;
  readonly bias: number;
}

export interface AnchorTransformRange {
  readonly startByte: number;
  readonly endByte: number;
}

export interface AnchorTransformDelta {
  readonly replaced: AnchorTransformRange;
  readonly insertedByteLength: number;
}

export class AnchorTransformContractError extends Error {
  public readonly code: number;

  public constructor(code: number, message: string) {
    super(message);
    this.name = 'AnchorTransformContractError';
    this.code = code;
  }
}

export function leftAnchorBias(): number {
  return ANCHOR_BIAS_LEFT;
}

export function rightAnchorBias(): number {
  return ANCHOR_BIAS_RIGHT;
}

export function createPointAnchor(byte: number, bias: number): PointAnchor {
  return {
    byte,
    bias,
  };
}

export function createAnchorTransformDelta(
  startByte: number,
  endByte: number,
  insertedByteLength: number,
): AnchorTransformDelta {
  return {
    replaced: {
      startByte,
      endByte,
    },
    insertedByteLength,
  };
}

export function transformPointAnchor(
  anchor: PointAnchor,
  delta: AnchorTransformDelta,
): PointAnchor {
  validatePointAnchor(anchor);
  validateDelta(delta);

  if (anchor.byte < delta.replaced.startByte) {
    return anchor;
  }

  if (isInsertionAtAnchorByte(anchor, delta)) {
    if (anchor.bias === ANCHOR_BIAS_LEFT) {
      return anchor;
    }

    return createPointAnchor(anchor.byte + delta.insertedByteLength, anchor.bias);
  }

  if (anchor.byte >= delta.replaced.endByte) {
    return createPointAnchor(anchor.byte + replacementByteDelta(delta), anchor.bias);
  }

  return createPointAnchor(delta.replaced.startByte, anchor.bias);
}

function validatePointAnchor(anchor: PointAnchor): void {
  if (!Number.isInteger(anchor.byte) || anchor.byte < ZERO_BYTES) {
    throw new AnchorTransformContractError(
      ANCHOR_TRANSFORM_ERROR_INVALID_ANCHOR,
      'Point anchors require a non-negative integer byte offset.',
    );
  }

  if (anchor.bias !== ANCHOR_BIAS_LEFT && anchor.bias !== ANCHOR_BIAS_RIGHT) {
    throw new AnchorTransformContractError(
      ANCHOR_TRANSFORM_ERROR_INVALID_ANCHOR,
      'Point anchors require a known bias.',
    );
  }
}

function validateDelta(delta: AnchorTransformDelta): void {
  if (
    !Number.isInteger(delta.replaced.startByte)
    || !Number.isInteger(delta.replaced.endByte)
    || !Number.isInteger(delta.insertedByteLength)
  ) {
    throw new AnchorTransformContractError(
      ANCHOR_TRANSFORM_ERROR_INVALID_DELTA,
      'Anchor transform deltas require integer byte counts.',
    );
  }

  if (
    delta.replaced.startByte < ZERO_BYTES
    || delta.replaced.endByte < delta.replaced.startByte
    || delta.insertedByteLength < ZERO_BYTES
  ) {
    throw new AnchorTransformContractError(
      ANCHOR_TRANSFORM_ERROR_INVALID_DELTA,
      'Anchor transform deltas require valid non-negative byte ranges.',
    );
  }
}

function isInsertionAtAnchorByte(anchor: PointAnchor, delta: AnchorTransformDelta): boolean {
  return deletedByteLength(delta) === ZERO_BYTES && anchor.byte === delta.replaced.startByte;
}

function deletedByteLength(delta: AnchorTransformDelta): number {
  return delta.replaced.endByte - delta.replaced.startByte;
}

function replacementByteDelta(delta: AnchorTransformDelta): number {
  return delta.insertedByteLength - deletedByteLength(delta);
}
