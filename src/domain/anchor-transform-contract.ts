const ANCHOR_BIAS_LEFT = 1;
const ANCHOR_BIAS_RIGHT = 2;
const ZERO_BYTES = 0;
const ANCHOR_TRANSFORM_ERROR_INVALID_ANCHOR = 1;
const ANCHOR_TRANSFORM_ERROR_INVALID_RECEIPT = 2;

export interface PointAnchor {
  readonly byte: number;
  readonly bias: number;
}

export interface AnchorTransformRange {
  readonly startByte: number;
  readonly endByte: number;
}

export interface AnchorTransformReceipt {
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

export function createAnchorTransformReceipt(
  startByte: number,
  endByte: number,
  insertedByteLength: number,
): AnchorTransformReceipt {
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
  receipt: AnchorTransformReceipt,
): PointAnchor {
  validatePointAnchor(anchor);
  validateReceipt(receipt);

  if (anchor.byte < receipt.replaced.startByte) {
    return anchor;
  }

  if (isInsertionAtAnchorByte(anchor, receipt)) {
    if (anchor.bias === ANCHOR_BIAS_LEFT) {
      return anchor;
    }

    return createPointAnchor(anchor.byte + receipt.insertedByteLength, anchor.bias);
  }

  if (anchor.byte >= receipt.replaced.endByte) {
    return createPointAnchor(anchor.byte + replacementByteDelta(receipt), anchor.bias);
  }

  return createPointAnchor(receipt.replaced.startByte, anchor.bias);
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

function validateReceipt(receipt: AnchorTransformReceipt): void {
  if (
    !Number.isInteger(receipt.replaced.startByte)
    || !Number.isInteger(receipt.replaced.endByte)
    || !Number.isInteger(receipt.insertedByteLength)
  ) {
    throw new AnchorTransformContractError(
      ANCHOR_TRANSFORM_ERROR_INVALID_RECEIPT,
      'Anchor transform receipts require integer byte counts.',
    );
  }

  if (
    receipt.replaced.startByte < ZERO_BYTES
    || receipt.replaced.endByte < receipt.replaced.startByte
    || receipt.insertedByteLength < ZERO_BYTES
  ) {
    throw new AnchorTransformContractError(
      ANCHOR_TRANSFORM_ERROR_INVALID_RECEIPT,
      'Anchor transform receipts require valid non-negative byte ranges.',
    );
  }
}

function isInsertionAtAnchorByte(anchor: PointAnchor, receipt: AnchorTransformReceipt): boolean {
  return deletedByteLength(receipt) === ZERO_BYTES && anchor.byte === receipt.replaced.startByte;
}

function deletedByteLength(receipt: AnchorTransformReceipt): number {
  return receipt.replaced.endByte - receipt.replaced.startByte;
}

function replacementByteDelta(receipt: AnchorTransformReceipt): number {
  return receipt.insertedByteLength - deletedByteLength(receipt);
}
