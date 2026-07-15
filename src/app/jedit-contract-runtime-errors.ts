const WORLDLINE_MISMATCH_CODE = 'WORLDLINE_MISMATCH';
const BASE_HEAD_MISMATCH_CODE = 'BASE_HEAD_MISMATCH';
const INVALID_ROOT_ID_CODE = 'INVALID_ROOT_ID';
const INVALID_WORLDLINE_ID_CODE = 'INVALID_WORLDLINE_ID';
const INVALID_HEAD_ID_CODE = 'INVALID_HEAD_ID';

interface JeditContractRuntimeErrorCodeMap {
  readonly WorldlineMismatch: typeof WORLDLINE_MISMATCH_CODE;
  readonly BaseHeadMismatch: typeof BASE_HEAD_MISMATCH_CODE;
  readonly InvalidRootId: typeof INVALID_ROOT_ID_CODE;
  readonly InvalidWorldlineId: typeof INVALID_WORLDLINE_ID_CODE;
  readonly InvalidHeadId: typeof INVALID_HEAD_ID_CODE;
}

export const JeditContractRuntimeErrorCode: JeditContractRuntimeErrorCodeMap = Object.freeze({
  WorldlineMismatch: WORLDLINE_MISMATCH_CODE,
  BaseHeadMismatch: BASE_HEAD_MISMATCH_CODE,
  InvalidRootId: INVALID_ROOT_ID_CODE,
  InvalidWorldlineId: INVALID_WORLDLINE_ID_CODE,
  InvalidHeadId: INVALID_HEAD_ID_CODE,
});

export type JeditContractRuntimeErrorCode =
  JeditContractRuntimeErrorCodeMap[keyof JeditContractRuntimeErrorCodeMap];

export class JeditContractRuntimeError extends Error {
  public readonly code: JeditContractRuntimeErrorCode;

  public constructor(code: JeditContractRuntimeErrorCode, message: string) {
    super(message);
    this.name = 'JeditContractRuntimeError';
    this.code = code;
  }
}
