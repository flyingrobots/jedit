import type { QueryOperationMap } from '../generated/jedit/hot-text-runtime.types.generated.js';
import { QueryOperationSchemas } from '../generated/jedit/hot-text-runtime.zod.generated.js';

const WORLDLINE_SNAPSHOT_OBSERVER_NAME = 'worldlineSnapshot' as const;
const WORLDLINE_SNAPSHOT_OBSERVER_KIND = 'WORLDLINE_SNAPSHOT' as const;
const WORLDLINE_SNAPSHOT_APERTURE_KIND = 'CANONICAL_WORLDLINE_SLICE' as const;
const WORLDLINE_SNAPSHOT_BASIS_KIND = 'JEDIT_HOT_TEXT' as const;
const WORLDLINE_SNAPSHOT_STATE_MODE = 'MEMORYLESS' as const;
const WORLDLINE_SNAPSHOT_UPDATE_KIND = 'REPLACE_WITH_LATEST_SLICE' as const;
const WORLDLINE_SNAPSHOT_EMIT_KIND = 'WORLDLINE_SNAPSHOT_READING' as const;
const WORLDLINE_SNAPSHOT_MATERIALIZATION_KIND = 'SLICE_ONLY' as const;
const WORLDLINE_SNAPSHOT_HISTORY_WINDOW = 'CANONICAL_HEAD_ONLY' as const;
const WORLDLINE_SNAPSHOT_EXPOSURE_TIER = 'AUTHOR_VISIBLE' as const;
const WORLDLINE_SNAPSHOT_REVELATION_TIER = 'CANONICAL_TEXT_ONLY' as const;
const WORLDLINE_SNAPSHOT_REDACTION_POLICY = 'HIDE_NON_CANONICAL_LANES' as const;
const WORLDLINE_SNAPSHOT_INPUT_BINDING = 'worldlineId' as const;
const WORLDLINE_SNAPSHOT_STATE_SCHEMA_ID = 'jedit.worldlineSnapshot.state.v1' as const;
const WORLDLINE_SNAPSHOT_READING_SCHEMA_ID = 'jedit.worldlineSnapshot.reading.v1' as const;
const WORLDLINE_SNAPSHOT_RIGHTS_SCHEMA_ID = 'jedit.worldlineSnapshot.rights.v1' as const;
const SINGLE_WORLDLINE = 1;

const WORLDLINE_SNAPSHOT_NODE_KINDS = [
  'BufferWorldline',
  'RopeHead',
  'Checkpoint',
] as const;

const WORLDLINE_SNAPSHOT_DERIVED_SURFACES = [
  'text',
] as const;

type WorldlineSnapshotInput = QueryOperationMap['worldlineSnapshot']['input'];
type WorldlineSnapshotReading = QueryOperationMap['worldlineSnapshot']['result'];

export interface WorldlineSnapshotObserverAperture {
  readonly kind: typeof WORLDLINE_SNAPSHOT_APERTURE_KIND;
  readonly inputBinding: typeof WORLDLINE_SNAPSHOT_INPUT_BINDING;
  readonly materialization: typeof WORLDLINE_SNAPSHOT_MATERIALIZATION_KIND;
  readonly historyWindow: typeof WORLDLINE_SNAPSHOT_HISTORY_WINDOW;
  readonly maxWorldlines: typeof SINGLE_WORLDLINE;
}

export interface WorldlineSnapshotObserverBasis {
  readonly kind: typeof WORLDLINE_SNAPSHOT_BASIS_KIND;
  readonly nodeKinds: typeof WORLDLINE_SNAPSHOT_NODE_KINDS;
  readonly derivedSurfaces: typeof WORLDLINE_SNAPSHOT_DERIVED_SURFACES;
}

export interface WorldlineSnapshotObserverStateSpec {
  readonly mode: typeof WORLDLINE_SNAPSHOT_STATE_MODE;
  readonly schemaId: typeof WORLDLINE_SNAPSHOT_STATE_SCHEMA_ID;
}

export interface WorldlineSnapshotObserverUpdatePlan {
  readonly kind: typeof WORLDLINE_SNAPSHOT_UPDATE_KIND;
}

export interface WorldlineSnapshotObserverEmitPlan {
  readonly kind: typeof WORLDLINE_SNAPSHOT_EMIT_KIND;
  readonly readingSchemaId: typeof WORLDLINE_SNAPSHOT_READING_SCHEMA_ID;
}

export interface WorldlineSnapshotObserverBudget {
  readonly materialization: typeof WORLDLINE_SNAPSHOT_MATERIALIZATION_KIND;
  readonly historyWindow: typeof WORLDLINE_SNAPSHOT_HISTORY_WINDOW;
  readonly maxWorldlines: typeof SINGLE_WORLDLINE;
}

export interface WorldlineSnapshotObserverRights {
  readonly schemaId: typeof WORLDLINE_SNAPSHOT_RIGHTS_SCHEMA_ID;
  readonly exposureTier: typeof WORLDLINE_SNAPSHOT_EXPOSURE_TIER;
  readonly revelationTier: typeof WORLDLINE_SNAPSHOT_REVELATION_TIER;
  readonly redactionPolicy: typeof WORLDLINE_SNAPSHOT_REDACTION_POLICY;
}

export interface WorldlineSnapshotObserverSpec {
  readonly observerName: typeof WORLDLINE_SNAPSHOT_OBSERVER_NAME;
  readonly kind: typeof WORLDLINE_SNAPSHOT_OBSERVER_KIND;
  readonly operationName: typeof WORLDLINE_SNAPSHOT_OBSERVER_NAME;
  readonly aperture: WorldlineSnapshotObserverAperture;
  readonly basis: WorldlineSnapshotObserverBasis;
  readonly state: WorldlineSnapshotObserverStateSpec;
  readonly update: WorldlineSnapshotObserverUpdatePlan;
  readonly emit: WorldlineSnapshotObserverEmitPlan;
  readonly budgets: WorldlineSnapshotObserverBudget;
  readonly rights: WorldlineSnapshotObserverRights;
}

export interface WorldlineSnapshotObserverState {
  readonly mode: typeof WORLDLINE_SNAPSHOT_STATE_MODE;
}

export interface WorldlineSnapshotReadingEnvelope {
  readonly observerName: typeof WORLDLINE_SNAPSHOT_OBSERVER_NAME;
  readonly frontierRef: string;
  readonly reading: WorldlineSnapshotReading;
}

export function createWorldlineSnapshotObserverSpec(): WorldlineSnapshotObserverSpec {
  return {
    observerName: WORLDLINE_SNAPSHOT_OBSERVER_NAME,
    kind: WORLDLINE_SNAPSHOT_OBSERVER_KIND,
    operationName: WORLDLINE_SNAPSHOT_OBSERVER_NAME,
    aperture: {
      kind: WORLDLINE_SNAPSHOT_APERTURE_KIND,
      inputBinding: WORLDLINE_SNAPSHOT_INPUT_BINDING,
      materialization: WORLDLINE_SNAPSHOT_MATERIALIZATION_KIND,
      historyWindow: WORLDLINE_SNAPSHOT_HISTORY_WINDOW,
      maxWorldlines: SINGLE_WORLDLINE,
    },
    basis: {
      kind: WORLDLINE_SNAPSHOT_BASIS_KIND,
      nodeKinds: WORLDLINE_SNAPSHOT_NODE_KINDS,
      derivedSurfaces: WORLDLINE_SNAPSHOT_DERIVED_SURFACES,
    },
    state: {
      mode: WORLDLINE_SNAPSHOT_STATE_MODE,
      schemaId: WORLDLINE_SNAPSHOT_STATE_SCHEMA_ID,
    },
    update: {
      kind: WORLDLINE_SNAPSHOT_UPDATE_KIND,
    },
    emit: {
      kind: WORLDLINE_SNAPSHOT_EMIT_KIND,
      readingSchemaId: WORLDLINE_SNAPSHOT_READING_SCHEMA_ID,
    },
    budgets: {
      materialization: WORLDLINE_SNAPSHOT_MATERIALIZATION_KIND,
      historyWindow: WORLDLINE_SNAPSHOT_HISTORY_WINDOW,
      maxWorldlines: SINGLE_WORLDLINE,
    },
    rights: {
      schemaId: WORLDLINE_SNAPSHOT_RIGHTS_SCHEMA_ID,
      exposureTier: WORLDLINE_SNAPSHOT_EXPOSURE_TIER,
      revelationTier: WORLDLINE_SNAPSHOT_REVELATION_TIER,
      redactionPolicy: WORLDLINE_SNAPSHOT_REDACTION_POLICY,
    },
  };
}

export function createWorldlineSnapshotObserverState(): WorldlineSnapshotObserverState {
  return {
    mode: WORLDLINE_SNAPSHOT_STATE_MODE,
  };
}

export function parseWorldlineSnapshotObserverInput(
  input: WorldlineSnapshotInput,
): WorldlineSnapshotInput {
  return QueryOperationSchemas.worldlineSnapshot.input.parse(input);
}

export function emitWorldlineSnapshotReading(
  frontierRef: string,
  reading: WorldlineSnapshotReading,
): WorldlineSnapshotReadingEnvelope {
  return {
    observerName: WORLDLINE_SNAPSHOT_OBSERVER_NAME,
    frontierRef,
    reading: QueryOperationSchemas.worldlineSnapshot.result.parse(reading),
  };
}
