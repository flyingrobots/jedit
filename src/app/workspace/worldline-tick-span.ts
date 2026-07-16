const TICK_PREFIX = 'tick:t';
const TICKS_PREFIX = 'ticks:t';
const TICK_SPAN_SEPARATOR = '->t';

export interface WorkspaceWorldlineTickSpan {
  readonly basisTick?: number;
  readonly observedTick?: number;
  readonly headTick?: number;
}

export function workspaceWorldlineTickSpanLabel(
  span: WorkspaceWorldlineTickSpan,
): string | undefined {
  const basisTick = span.observedTick ?? span.basisTick;
  const headTick = span.observedTick ?? span.headTick;
  if (basisTick == null && headTick == null) {
    return undefined;
  }
  if (basisTick == null) {
    return `${TICK_PREFIX}${headTick}`;
  }
  if (headTick == null || basisTick === headTick) {
    return `${TICK_PREFIX}${basisTick}`;
  }
  return `${TICKS_PREFIX}${basisTick}${TICK_SPAN_SEPARATOR}${headTick}`;
}
