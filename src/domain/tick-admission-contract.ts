import {
  createTextFragment,
  replaceRange,
  type BufferRoot,
  type ReplaceReceipt,
  type TextRange,
} from './text-edit-contract.js';

const ALLOCATED_IDS_PER_ADMITTED_TICK = 2;

const TICK_ADMISSION_ERROR_INVALID_STATE = 1;
const FIRST_TICK_ID = 1;

export interface AdmittedTick {
  readonly id: number;
  readonly rootId: number;
}

export interface TickAdmissionState {
  readonly currentRoot: BufferRoot;
  readonly ticks: readonly AdmittedTick[];
  readonly nextRootId: number;
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
  nextRootId: number = deriveNextRootId(currentRoot, ticks),
): TickAdmissionState {
  validateStateShape(currentRoot, ticks, nextRootId);

  return {
    currentRoot,
    ticks: [...ticks],
    nextRootId,
  };
}

export function admitReplaceRangeTick(
  state: TickAdmissionState,
  range: TextRange,
  fragmentText: string,
): TickAdmissionResult {
  validateStateShape(state.currentRoot, state.ticks, state.nextRootId);

  const fragment = createTextFragment(state.nextRootId, fragmentText);
  const replaceResult = replaceRange(state.currentRoot, range, fragment, state.nextRootId + 1);
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
      nextRootId: state.nextRootId + ALLOCATED_IDS_PER_ADMITTED_TICK,
    },
    receipt: {
      tickId: nextTick.id,
      replaceReceipt: replaceResult.receipt,
    },
  };
}

function deriveNextRootId(currentRoot: BufferRoot, ticks: readonly AdmittedTick[]): number {
  let highestRootId = currentRoot.id;
  for (const tick of ticks) {
    if (tick.rootId > highestRootId) {
      highestRootId = tick.rootId;
    }
  }
  return highestRootId + 1;
}

function validateStateShape(
  currentRoot: BufferRoot,
  ticks: readonly AdmittedTick[],
  nextRootId: number,
): void {
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

  validateNextRootId(nextRootId, currentRoot, ticks);
}

function validateNextRootId(
  nextRootId: number,
  currentRoot: BufferRoot,
  ticks: readonly AdmittedTick[],
): void {
  if (!Number.isInteger(nextRootId) || nextRootId <= currentRoot.id) {
    throw new TickAdmissionContractError(
      TICK_ADMISSION_ERROR_INVALID_STATE,
      'Tick admission requires the next root id to exceed the current root id.',
    );
  }

  for (const tick of ticks) {
    if (nextRootId <= tick.rootId) {
      throw new TickAdmissionContractError(
        TICK_ADMISSION_ERROR_INVALID_STATE,
        'Tick admission requires the next root id to exceed all admitted root ids.',
      );
    }
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
