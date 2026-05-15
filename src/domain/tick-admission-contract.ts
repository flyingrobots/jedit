import {
  replaceRange,
  type BufferRoot,
  type ReplaceReceipt,
  type TextFragment,
  type TextRange,
} from './text-edit-contract.js';

const TICK_ADMISSION_ERROR_INVALID_STATE = 1;
const FIRST_TICK_ID = 1;

export interface AdmittedTick {
  readonly id: number;
  readonly rootId: number;
}

export interface TickAdmissionState {
  readonly currentRoot: BufferRoot;
  readonly ticks: readonly AdmittedTick[];
}

export interface TickAdmissionReceipt {
  readonly tickId: number;
  readonly replaceReceipt: ReplaceReceipt;
}

export interface TickAdmissionResult {
  readonly nextState: TickAdmissionState;
  readonly receipt?: TickAdmissionReceipt;
}

export class TickAdmissionContractError extends Error {
  public readonly code: number;

  public constructor(code: number, message: string) {
    super(message);
    this.name = 'TickAdmissionContractError';
    this.code = code;
  }
}

export function createTickAdmissionState(
  currentRoot: BufferRoot,
  ticks: readonly AdmittedTick[] = [],
): TickAdmissionState {
  validateStateShape(currentRoot, ticks);

  return {
    currentRoot,
    ticks: [...ticks],
  };
}

export function admitReplaceRangeTick(
  state: TickAdmissionState,
  range: TextRange,
  fragment: TextFragment,
): TickAdmissionResult {
  validateStateShape(state.currentRoot, state.ticks);

  const replaceResult = replaceRange(state.currentRoot, range, fragment);
  if (replaceResult.receipt === undefined) {
    return { nextState: state };
  }

  const nextTick = {
    id: nextTickId(state.ticks),
    rootId: replaceResult.nextRoot.id,
  };

  return {
    nextState: {
      currentRoot: replaceResult.nextRoot,
      ticks: [...state.ticks, nextTick],
    },
    receipt: {
      tickId: nextTick.id,
      replaceReceipt: replaceResult.receipt,
    },
  };
}

function validateStateShape(currentRoot: BufferRoot, ticks: readonly AdmittedTick[]): void {
  validatePositiveRootId(currentRoot.id, 'Tick admission requires a positive integer current root id.');

  let expectedTickId = FIRST_TICK_ID;
  let lastRootId: number | undefined;

  for (const tick of ticks) {
    validateExpectedTickId(tick.id, expectedTickId);
    validatePositiveRootId(tick.rootId, 'Tick admission history requires positive integer root ids.');
    expectedTickId += 1;
    lastRootId = tick.rootId;
  }

  if (lastRootId !== undefined && currentRoot.id !== lastRootId) {
    throw new TickAdmissionContractError(
      TICK_ADMISSION_ERROR_INVALID_STATE,
      'Tick admission current root must match the last admitted tick root.',
    );
  }
}

function validatePositiveRootId(rootId: number, message: string): void {
  if (!Number.isInteger(rootId) || rootId < FIRST_TICK_ID) {
    throw new TickAdmissionContractError(TICK_ADMISSION_ERROR_INVALID_STATE, message);
  }
}

function validateExpectedTickId(tickId: number, expectedTickId: number): void {
  if (!Number.isInteger(tickId) || tickId !== expectedTickId) {
    throw new TickAdmissionContractError(
      TICK_ADMISSION_ERROR_INVALID_STATE,
      'Tick admission history requires contiguous positive tick ids.',
    );
  }
}

function nextTickId(ticks: readonly AdmittedTick[]): number {
  const lastTick = ticks[ticks.length - 1];
  if (lastTick === undefined) {
    return FIRST_TICK_ID;
  }
  return lastTick.id + 1;
}
