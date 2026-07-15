import type { QueryOperationMap } from '../generated/jedit/rope.types.generated.js';
import type { TextWindowRequest } from '../ports/text-buffer-session.js';

type TextWindowInput = QueryOperationMap['textWindow']['input'];

export function serializeJeditTextWindowInput(
  worldlineId: string,
  request: TextWindowRequest,
): TextWindowInput {
  return {
    worldlineId,
    basisHeadId: request.basisHeadId,
    startByte: request.byteRange.startByte.value,
    endByte: request.byteRange.endByte.value,
    ...request.aperture,
  };
}
