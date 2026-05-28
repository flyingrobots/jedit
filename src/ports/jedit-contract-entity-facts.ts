export const JEDIT_CONTRACT_ENTITY_FACT_SET_KIND = 'jedit-contract-entity-fact-set';
export const JEDIT_CONTRACT_ENTITY_FACT_WORLDLINE = 'WORLDLINE_FACT';
export const JEDIT_CONTRACT_ENTITY_FACT_HEAD = 'HEAD_FACT';
export const JEDIT_CONTRACT_ENTITY_FACT_ROOT = 'ROOT_FACT';
export const JEDIT_CONTRACT_ENTITY_FACT_TICK = 'TICK_FACT';
export const JEDIT_CONTRACT_ENTITY_FACT_CHECKPOINT = 'CHECKPOINT_FACT';

export type JeditContractEntityFact =
  | JeditWorldlineEntityFact
  | JeditHeadEntityFact
  | JeditRootEntityFact
  | JeditTickEntityFact
  | JeditCheckpointEntityFact;

export interface JeditContractEntityFactSet {
  readonly kind: typeof JEDIT_CONTRACT_ENTITY_FACT_SET_KIND;
  readonly worldlineId: string;
  readonly facts: readonly JeditContractEntityFact[];
}

export interface JeditWorldlineEntityFact {
  readonly kind: typeof JEDIT_CONTRACT_ENTITY_FACT_WORLDLINE;
  readonly factId: string;
  readonly worldlineId: string;
  readonly canonicalHeadId: string;
}

export interface JeditHeadEntityFact {
  readonly kind: typeof JEDIT_CONTRACT_ENTITY_FACT_HEAD;
  readonly factId: string;
  readonly worldlineId: string;
  readonly headId: string;
  readonly rootId: number;
}

export interface JeditRootEntityFact {
  readonly kind: typeof JEDIT_CONTRACT_ENTITY_FACT_ROOT;
  readonly factId: string;
  readonly worldlineId: string;
  readonly rootId: number;
  readonly textDigest: string;
}

export interface JeditTickEntityFact {
  readonly kind: typeof JEDIT_CONTRACT_ENTITY_FACT_TICK;
  readonly factId: string;
  readonly worldlineId: string;
  readonly tickId: number;
  readonly rootId: number;
}

export interface JeditCheckpointEntityFact {
  readonly kind: typeof JEDIT_CONTRACT_ENTITY_FACT_CHECKPOINT;
  readonly factId: string;
  readonly worldlineId: string;
  readonly checkpointId: number;
  readonly rootId: number;
}
