export {
  JEDIT_TICKETED_WORK_AVAILABLE,
  JEDIT_TICKETED_WORK_MISSING,
  JEDIT_TICKETED_WORK_MISSING_CODE,
} from '../ports/jedit-ticketed-work-boundary.js';
import {
  JEDIT_TICKETED_WORK_AVAILABLE,
  JEDIT_TICKETED_WORK_MISSING,
  JEDIT_TICKETED_WORK_MISSING_CODE,
  type JeditTicketedWorkAvailable,
  type JeditTicketedWorkMissing,
  type JeditTicketedWorkPort,
  type JeditTicketedWorkRequest,
} from '../ports/jedit-ticketed-work-boundary.js';
import type { HashPort } from '../ports/hash.js';

const TICKET_ID_PREFIX = 'jedit-ticketed-work:';
const MISSING_TICKET_REASON = 'jedit ticketed work is unavailable';

export function createInMemoryJeditTicketedWorkPort(hash: HashPort): JeditTicketedWorkPort {
  return {
    issueTicketedWork(request) {
      return createJeditTicketedWork(request, hash);
    },
  };
}

export function createJeditTicketedWork(
  request: JeditTicketedWorkRequest,
  hash: HashPort,
): JeditTicketedWorkAvailable {
  return {
    status: JEDIT_TICKETED_WORK_AVAILABLE,
    submissionId: request.submissionId,
    ticketId: ticketIdFor(request, hash),
    packageId: request.packageId,
    operationName: request.operationName,
  };
}

export function missingJeditTicketedWork(submissionId: string): JeditTicketedWorkMissing {
  return {
    status: JEDIT_TICKETED_WORK_MISSING,
    submissionId,
    obstruction: {
      code: JEDIT_TICKETED_WORK_MISSING_CODE,
      reason: MISSING_TICKET_REASON,
    },
  };
}

function ticketIdFor(request: JeditTicketedWorkRequest, hash: HashPort): string {
  return `${TICKET_ID_PREFIX}${hash.sha256Hex(ticketDigestMaterial(request))}`;
}

function ticketDigestMaterial(request: JeditTicketedWorkRequest): string {
  return JSON.stringify({
    canonicalRequestBytesHex: request.canonicalRequestBytesHex,
    operationName: request.operationName,
    packageId: request.packageId,
    submissionId: request.submissionId,
  });
}
