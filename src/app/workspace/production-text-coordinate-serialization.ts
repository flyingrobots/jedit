import type { ByteOffset, TextByteRange } from '../../domain/graph-rope-types.js';
import type { JeditWhyByteRange } from '../../ports/jedit-why-range.js';

export function serializeByteOffset(byteOffset: ByteOffset): number {
  return byteOffset.value;
}

export function serializeTextByteRange(range: TextByteRange): JeditWhyByteRange {
  return {
    startByte: serializeByteOffset(range.startByte),
    endByte: serializeByteOffset(range.endByte),
  };
}
