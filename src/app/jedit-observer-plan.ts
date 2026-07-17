import type { HashPort } from '../ports/hash.js';
import {
  createWorldlineSnapshotObserverSpec,
  type WorldlineSnapshotObserverAperture,
  type WorldlineSnapshotObserverBasis,
  type WorldlineSnapshotObserverBudget,
  type WorldlineSnapshotObserverEmitPlan,
  type WorldlineSnapshotObserverRights,
  type WorldlineSnapshotObserverSpec,
  type WorldlineSnapshotObserverStateSpec,
  type WorldlineSnapshotObserverUpdatePlan,
} from './jedit-observer-spec.js';

const OBSERVER_PLAN_ID_PREFIX = 'observer-plan:';
const OBSERVER_PLAN_ID_SEPARATOR = ':';
const OBSERVER_PLAN_HASH_LENGTH = 16;

export interface WorldlineSnapshotObserverPlan extends WorldlineSnapshotObserverSpec {
  readonly planId: string;
  readonly specHash: string;
}

export function createWorldlineSnapshotObserverPlan(hash: HashPort): WorldlineSnapshotObserverPlan {
  const spec = createWorldlineSnapshotObserverSpec();
  const specHash = hash.sha256Hex(canonicalObserverSpec(spec));
  return Object.freeze({
    ...spec,
    planId: `${OBSERVER_PLAN_ID_PREFIX}${spec.observerName}${OBSERVER_PLAN_ID_SEPARATOR}${specHash.slice(0, OBSERVER_PLAN_HASH_LENGTH)}`,
    specHash,
  });
}

function canonicalObserverSpec(spec: WorldlineSnapshotObserverSpec): string {
  const canonicalSpec: WorldlineSnapshotObserverSpec = {
    aperture: canonicalAperture(spec),
    basis: canonicalBasis(spec),
    budgets: canonicalBudget(spec),
    emit: canonicalEmit(spec),
    kind: spec.kind,
    observerName: spec.observerName,
    operationName: spec.operationName,
    rights: canonicalRights(spec),
    state: canonicalState(spec),
    update: canonicalUpdate(spec),
  };
  return JSON.stringify(canonicalSpec);
}

function canonicalAperture(spec: WorldlineSnapshotObserverSpec): WorldlineSnapshotObserverAperture {
  return {
    historyWindow: spec.aperture.historyWindow,
    inputBinding: spec.aperture.inputBinding,
    kind: spec.aperture.kind,
    materialization: spec.aperture.materialization,
    maxWorldlines: spec.aperture.maxWorldlines,
  };
}

function canonicalBasis(spec: WorldlineSnapshotObserverSpec): WorldlineSnapshotObserverBasis {
  return {
    derivedSurfaces: spec.basis.derivedSurfaces,
    kind: spec.basis.kind,
    nodeKinds: spec.basis.nodeKinds,
  };
}

function canonicalBudget(spec: WorldlineSnapshotObserverSpec): WorldlineSnapshotObserverBudget {
  return {
    historyWindow: spec.budgets.historyWindow,
    materialization: spec.budgets.materialization,
    maxWorldlines: spec.budgets.maxWorldlines,
  };
}

function canonicalEmit(spec: WorldlineSnapshotObserverSpec): WorldlineSnapshotObserverEmitPlan {
  return {
    kind: spec.emit.kind,
    readingSchemaId: spec.emit.readingSchemaId,
  };
}

function canonicalRights(spec: WorldlineSnapshotObserverSpec): WorldlineSnapshotObserverRights {
  return {
    exposureTier: spec.rights.exposureTier,
    redactionPolicy: spec.rights.redactionPolicy,
    revelationTier: spec.rights.revelationTier,
    schemaId: spec.rights.schemaId,
  };
}

function canonicalState(spec: WorldlineSnapshotObserverSpec): WorldlineSnapshotObserverStateSpec {
  return {
    mode: spec.state.mode,
    schemaId: spec.state.schemaId,
  };
}

function canonicalUpdate(spec: WorldlineSnapshotObserverSpec): WorldlineSnapshotObserverUpdatePlan {
  return { kind: spec.update.kind };
}
