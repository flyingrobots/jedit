import type { TextWindowInput } from '../generated/jedit/rope.wesley.generated.js';
import type { TextWindowRequest } from '../ports/text-buffer-session.js';

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
