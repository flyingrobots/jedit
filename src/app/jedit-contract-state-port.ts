export {
  JEDIT_CONTRACT_STATE_MISSING_CODE,
  JEDIT_CONTRACT_STATE_READ_FOUND,
  JEDIT_CONTRACT_STATE_READ_MISSING,
  JEDIT_CONTRACT_STATE_WRITE_STORED,
} from '../ports/jedit-contract-state-port.js';
import { jeditContractSessionToFacts } from './jedit-contract-entity-facts.js';
import type { JeditWorldlineSession } from './jedit-contract-runtime.js';
import type { JeditContractEntityFactSet } from '../ports/jedit-contract-entity-facts.js';
import {
  JEDIT_CONTRACT_STATE_MISSING_CODE,
  JEDIT_CONTRACT_STATE_READ_FOUND,
  JEDIT_CONTRACT_STATE_READ_MISSING,
  JEDIT_CONTRACT_STATE_WRITE_STORED,
  type JeditContractStatePort,
  type JeditContractStateReadMissing,
  type JeditContractStateReadResult,
  type JeditContractStateWriteResult,
} from '../ports/jedit-contract-state-port.js';
import type { HashPort } from '../ports/hash.js';

const MISSING_STATE_REASON = 'jedit contract fact set is not present in the state port';

export function createInMemoryJeditContractStatePort(): JeditContractStatePort {
  const factSets = new Map<string, JeditContractEntityFactSet>();

  return {
    writeFactSet(factSet) {
      factSets.set(factSet.worldlineId, factSet);
      return {
        status: JEDIT_CONTRACT_STATE_WRITE_STORED,
        factSet,
      };
    },
    readFactSet(worldlineId) {
      const factSet = factSets.get(worldlineId);
      return factSet == null ? missingFactSet(worldlineId) : {
        status: JEDIT_CONTRACT_STATE_READ_FOUND,
        factSet,
      };
    },
  };
}

export function publishJeditContractSessionFacts(
  port: JeditContractStatePort,
  session: JeditWorldlineSession,
  hash: HashPort,
): JeditContractStateWriteResult {
  return port.writeFactSet(jeditContractSessionToFacts(session, hash));
}

export function readJeditContractFactSet(
  port: JeditContractStatePort,
  worldlineId: string,
): JeditContractStateReadResult {
  return port.readFactSet(worldlineId);
}

function missingFactSet(worldlineId: string): JeditContractStateReadMissing {
  return {
    status: JEDIT_CONTRACT_STATE_READ_MISSING,
    worldlineId,
    obstruction: {
      code: JEDIT_CONTRACT_STATE_MISSING_CODE,
      reason: MISSING_STATE_REASON,
    },
  };
}
