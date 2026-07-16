import type { GraphRopeRuntimeObstructionCode } from '../domain/graph-rope-runtime.js';

export const CREATE_BUFFER_OPERATION = 'createBuffer';
export const REPLACE_RANGE_OPERATION = 'admitReplaceRangeTick';
export const TEXT_WINDOW_OPERATION = 'textWindow';
export const CAUSAL_LINE_DIFF_OPERATION = 'causalLineDiff';
export const SAVE_CHECKPOINT_OPERATION = 'saveCheckpoint';

const GRAPH_ROPE_OBSTRUCTION_MESSAGE = 'Graph rope text authority operation was obstructed';
const GRAPH_ROPE_STATE_MESSAGE = 'Graph rope text authority received invalid compatibility state';
export const GRAPH_ROPE_STATE_MISSING_BASIS = 'missing-authority-basis';
export const GRAPH_ROPE_STATE_INVALID_RANGE = 'invalid-byte-range';
export const GRAPH_ROPE_STATE_INCOMPLETE_TRANSITION = 'incomplete-authority-transition';
export const GRAPH_ROPE_STATE_PROJECTION_MISMATCH = 'projection-basis-mismatch';

type GraphRopeTextAuthorityStateCode =
  | typeof GRAPH_ROPE_STATE_MISSING_BASIS
  | typeof GRAPH_ROPE_STATE_INVALID_RANGE
  | typeof GRAPH_ROPE_STATE_INCOMPLETE_TRANSITION
  | typeof GRAPH_ROPE_STATE_PROJECTION_MISMATCH;

type GraphRopeAuthorityOperation =
  | typeof CREATE_BUFFER_OPERATION
  | typeof REPLACE_RANGE_OPERATION
  | typeof TEXT_WINDOW_OPERATION
  | typeof CAUSAL_LINE_DIFF_OPERATION
  | typeof SAVE_CHECKPOINT_OPERATION;

export class GraphRopeTextAuthorityObstructionError extends Error {
  public readonly operation: GraphRopeAuthorityOperation;
  public readonly obstructionCode: GraphRopeRuntimeObstructionCode;

  public constructor(
    operation: GraphRopeAuthorityOperation,
    obstructionCode: GraphRopeRuntimeObstructionCode,
  ) {
    super(`${GRAPH_ROPE_OBSTRUCTION_MESSAGE}: ${operation} (${obstructionCode}).`);
    this.name = 'GraphRopeTextAuthorityObstructionError';
    this.operation = operation;
    this.obstructionCode = obstructionCode;
  }
}

export class GraphRopeTextAuthorityStateError extends Error {
  public readonly code: GraphRopeTextAuthorityStateCode;

  public constructor(code: GraphRopeTextAuthorityStateCode) {
    super(`${GRAPH_ROPE_STATE_MESSAGE}: ${code}.`);
    this.name = 'GraphRopeTextAuthorityStateError';
    this.code = code;
  }
}
