const SAVE_CHECKPOINT_ERROR_INVALID_STATE = 1;
const SAVE_CHECKPOINT_ERROR_INVALID_PATH = 2;
const ROOT_ID_MIN = 1;
const FIRST_CHECKPOINT_ID = 1;

export interface SaveCheckpoint {
  readonly id: number;
  readonly rootId: number;
  readonly path: string;
}

export interface SaveCheckpointState {
  readonly currentRootId: number;
  readonly path: string;
  readonly tickIds: readonly number[];
  readonly checkpoints: readonly SaveCheckpoint[];
}

export interface SaveCheckpointReceipt {
  readonly checkpointId: number;
  readonly rootId: number;
  readonly path: string;
}

export interface SaveCheckpointResult {
  readonly nextState: SaveCheckpointState;
  readonly receipt?: SaveCheckpointReceipt;
}

export class SaveCheckpointContractError extends Error {
  public readonly code: number;

  public constructor(code: number, message: string) {
    super(message);
    this.name = 'SaveCheckpointContractError';
    this.code = code;
  }
}

export function createSaveCheckpointState(
  currentRootId: number,
  path: string,
  tickIds: readonly number[] = [],
): SaveCheckpointState {
  validateRootId(currentRootId);
  validatePath(path);
  validateTickIds(tickIds);

  return {
    currentRootId,
    path,
    tickIds: [...tickIds],
    checkpoints: [],
  };
}

export function saveCheckpoint(state: SaveCheckpointState): SaveCheckpointResult {
  validateState(state);

  const lastCheckpoint = state.checkpoints[state.checkpoints.length - 1];
  if (
    lastCheckpoint !== undefined
    && lastCheckpoint.rootId === state.currentRootId
    && lastCheckpoint.path === state.path
  ) {
    return { nextState: state };
  }

  const nextCheckpoint = {
    id: nextCheckpointId(state.checkpoints),
    rootId: state.currentRootId,
    path: state.path,
  };

  return {
    nextState: {
      currentRootId: state.currentRootId,
      path: state.path,
      tickIds: [...state.tickIds],
      checkpoints: [...state.checkpoints, nextCheckpoint],
    },
    receipt: {
      checkpointId: nextCheckpoint.id,
      rootId: state.currentRootId,
      path: state.path,
    },
  };
}

function validateState(state: SaveCheckpointState): void {
  validateRootId(state.currentRootId);
  validatePath(state.path);
  validateTickIds(state.tickIds);

  for (const checkpoint of state.checkpoints) {
    validateRootId(checkpoint.rootId);
    validatePath(checkpoint.path);
    if (!Number.isInteger(checkpoint.id) || checkpoint.id < FIRST_CHECKPOINT_ID) {
      throw new SaveCheckpointContractError(
        SAVE_CHECKPOINT_ERROR_INVALID_STATE,
        'Save checkpoints require positive integer ids.',
      );
    }
  }
}

function validateRootId(rootId: number): void {
  if (!Number.isInteger(rootId) || rootId < ROOT_ID_MIN) {
    throw new SaveCheckpointContractError(
      SAVE_CHECKPOINT_ERROR_INVALID_STATE,
      'Save checkpoint state requires a positive integer root id.',
    );
  }
}

function validatePath(path: string): void {
  if (path.length === 0) {
    throw new SaveCheckpointContractError(
      SAVE_CHECKPOINT_ERROR_INVALID_PATH,
      'Save checkpoint state requires a non-empty path.',
    );
  }
}

function validateTickIds(tickIds: readonly number[]): void {
  for (const tickId of tickIds) {
    if (!Number.isInteger(tickId) || tickId < ROOT_ID_MIN) {
      throw new SaveCheckpointContractError(
        SAVE_CHECKPOINT_ERROR_INVALID_STATE,
        'Save checkpoint state requires positive integer tick ids.',
      );
    }
  }
}

function nextCheckpointId(checkpoints: readonly SaveCheckpoint[]): number {
  const lastCheckpoint = checkpoints[checkpoints.length - 1];
  if (lastCheckpoint === undefined) {
    return FIRST_CHECKPOINT_ID;
  }
  return lastCheckpoint.id + 1;
}
