export {
  JeditContractStatePortError,
} from './jedit-contract-state-port.js';
export {
  createJeditSubmissionId,
  recordAcceptedJeditSubmission,
} from './jedit-submission-ledger.js';
import {
  createInMemoryJeditContractStatePort,
} from './jedit-contract-state-port.js';
import {
  createInMemoryJeditSubmissionLedgerPort,
} from './jedit-submission-ledger.js';
import {
  createInMemoryJeditTicketedWorkPort,
} from './jedit-ticketed-work-boundary.js';
import type { HashPort } from '../ports/hash.js';

export function createDefaultJeditHostingBoundaries(hash: HashPort) {
  return {
    statePort: createInMemoryJeditContractStatePort(),
    submissionLedger: createInMemoryJeditSubmissionLedgerPort(),
    ticketedWorkPort: createInMemoryJeditTicketedWorkPort(hash),
  };
}
