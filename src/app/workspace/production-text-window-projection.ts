import type { Observed, TextWindowRangeInput, TextWindowReading } from '../../ports/text-buffer-session.js';
import type { ProductionTextViewportAperture } from './production-text-basis-request.js';

export function textWindowInputFromViewport(
  aperture: ProductionTextViewportAperture,
): TextWindowRangeInput {
  return {
    cursorLine: aperture.cursorLine,
    viewportLineCount: aperture.viewportLineCount,
    beforeLines: aperture.beforeLines,
    afterLines: aperture.afterLines,
    maxBytes: aperture.maxBytes,
  };
}

export function materializeObservedText(observed: Observed<TextWindowReading>): string {
  return observed.value.projection.text;
}
