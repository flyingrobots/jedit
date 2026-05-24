import type { JeditContractEntityFactSet } from './jedit-contract-entity-facts.js';

export const JEDIT_CONTRACT_STATE_WRITE_STORED = 'JEDIT_CONTRACT_STATE_WRITE_STORED';
export const JEDIT_CONTRACT_STATE_READ_FOUND = 'JEDIT_CONTRACT_STATE_READ_FOUND';
export const JEDIT_CONTRACT_STATE_READ_MISSING = 'JEDIT_CONTRACT_STATE_READ_MISSING';
export const JEDIT_CONTRACT_STATE_MISSING_CODE = 'JEDIT_CONTRACT_STATE_MISSING';

export interface JeditContractStatePort {
  writeFactSet(factSet: JeditContractEntityFactSet): JeditContractStateWriteResult;
  readFactSet(worldlineId: string): JeditContractStateReadResult;
}

export interface JeditContractStateWriteStored {
  readonly status: typeof JEDIT_CONTRACT_STATE_WRITE_STORED;
  readonly factSet: JeditContractEntityFactSet;
}

export interface JeditContractStateReadFound {
  readonly status: typeof JEDIT_CONTRACT_STATE_READ_FOUND;
  readonly factSet: JeditContractEntityFactSet;
}

export interface JeditContractStateReadMissing {
  readonly status: typeof JEDIT_CONTRACT_STATE_READ_MISSING;
  readonly worldlineId: string;
  readonly obstruction: JeditContractStateMissingObstruction;
}

export interface JeditContractStateMissingObstruction {
  readonly code: typeof JEDIT_CONTRACT_STATE_MISSING_CODE;
  readonly reason: string;
}

export type JeditContractStateWriteResult = JeditContractStateWriteStored;
export type JeditContractStateReadResult =
  | JeditContractStateReadFound
  | JeditContractStateReadMissing;
