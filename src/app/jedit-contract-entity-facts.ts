export {
  JEDIT_CONTRACT_ENTITY_FACT_CHECKPOINT,
  JEDIT_CONTRACT_ENTITY_FACT_HEAD,
  JEDIT_CONTRACT_ENTITY_FACT_ROOT,
  JEDIT_CONTRACT_ENTITY_FACT_SET_KIND,
  JEDIT_CONTRACT_ENTITY_FACT_TICK,
  JEDIT_CONTRACT_ENTITY_FACT_WORLDLINE,
} from '../ports/jedit-contract-entity-facts.js';
import type { JeditWorldlineSession } from './jedit-contract-runtime.js';
import type { HashPort } from '../ports/hash.js';
import {
  JEDIT_CONTRACT_ENTITY_FACT_CHECKPOINT,
  JEDIT_CONTRACT_ENTITY_FACT_HEAD,
  JEDIT_CONTRACT_ENTITY_FACT_ROOT,
  JEDIT_CONTRACT_ENTITY_FACT_SET_KIND,
  JEDIT_CONTRACT_ENTITY_FACT_TICK,
  JEDIT_CONTRACT_ENTITY_FACT_WORLDLINE,
  type JeditCheckpointEntityFact,
  type JeditContractEntityFact,
  type JeditContractEntityFactSet,
  type JeditHeadEntityFact,
  type JeditRootEntityFact,
  type JeditTickEntityFact,
  type JeditWorldlineEntityFact,
} from '../ports/jedit-contract-entity-facts.js';

export function jeditContractSessionToFacts(
  session: JeditWorldlineSession,
  hash: HashPort,
): JeditContractEntityFactSet {
  return {
    kind: JEDIT_CONTRACT_ENTITY_FACT_SET_KIND,
    worldlineId: session.worldline.worldlineId,
    facts: Object.freeze([
      worldlineFact(session, hash),
      headFact(session, hash),
      ...rootFacts(session, hash),
      ...tickFacts(session, hash),
      ...checkpointFacts(session, hash),
    ]),
  };
}

function worldlineFact(
  session: JeditWorldlineSession,
  hash: HashPort,
): JeditWorldlineEntityFact {
  return withFactId({
    kind: JEDIT_CONTRACT_ENTITY_FACT_WORLDLINE,
    worldlineId: session.worldline.worldlineId,
    canonicalHeadId: session.worldline.canonicalHeadId,
  }, hash);
}

function headFact(session: JeditWorldlineSession, hash: HashPort): JeditHeadEntityFact {
  return withFactId({
    kind: JEDIT_CONTRACT_ENTITY_FACT_HEAD,
    worldlineId: session.worldline.worldlineId,
    headId: session.worldline.canonicalHeadId,
    rootId: session.state.currentRoot.id,
  }, hash);
}

function rootFacts(
  session: JeditWorldlineSession,
  hash: HashPort,
): readonly JeditRootEntityFact[] {
  return (session.state.roots ?? []).map((root) => rootFact(session, hash, root));
}

function rootFact(
  session: JeditWorldlineSession,
  hash: HashPort,
  root: JeditWorldlineSession['state']['currentRoot'],
): JeditRootEntityFact {
  return withFactId({
    kind: JEDIT_CONTRACT_ENTITY_FACT_ROOT,
    worldlineId: session.worldline.worldlineId,
    rootId: root.id,
    textDigest: hash.sha256Hex(root.text),
  }, hash);
}

function tickFacts(
  session: JeditWorldlineSession,
  hash: HashPort,
): readonly JeditTickEntityFact[] {
  return session.state.ticks.map((tick) => withFactId({
    kind: JEDIT_CONTRACT_ENTITY_FACT_TICK,
    worldlineId: session.worldline.worldlineId,
    tickId: tick.id,
    rootId: tick.rootId,
  }, hash));
}

function checkpointFacts(
  session: JeditWorldlineSession,
  hash: HashPort,
): readonly JeditCheckpointEntityFact[] {
  return session.state.checkpoints.map((checkpoint) => withFactId({
    kind: JEDIT_CONTRACT_ENTITY_FACT_CHECKPOINT,
    worldlineId: session.worldline.worldlineId,
    checkpointId: checkpoint.id,
    rootId: checkpoint.rootId,
  }, hash));
}

function withFactId<T extends Omit<JeditContractEntityFact, 'factId'>>(
  fact: T,
  hash: HashPort,
): T & { readonly factId: string } {
  return Object.freeze({
    ...fact,
    factId: hash.sha256Hex(JSON.stringify(fact)),
  });
}
