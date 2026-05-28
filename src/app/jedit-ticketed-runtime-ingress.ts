export {
  JEDIT_TICKETED_RUNTIME_INGRESS_AVAILABLE,
  JEDIT_TICKETED_RUNTIME_INGRESS_MISSING,
  JEDIT_TICKETED_RUNTIME_INGRESS_MISSING_CODE,
} from '../ports/jedit-ticketed-runtime-ingress.js';
import {
  JEDIT_ADMISSION_TICKET_HANDLE_KIND,
  JEDIT_TICKETED_RUNTIME_INGRESS_AVAILABLE,
  JEDIT_TICKETED_RUNTIME_INGRESS_MISSING,
  JEDIT_TICKETED_RUNTIME_INGRESS_MISSING_CODE,
  type JeditAdmissionTicketHandle,
  type JeditTicketedRuntimeIngressAvailable,
  type JeditTicketedRuntimeIngressInput,
  type JeditTicketedRuntimeIngressMissing,
} from '../ports/jedit-ticketed-runtime-ingress.js';

const MISSING_TICKETED_RUNTIME_INGRESS_REASON =
  'Echo admission ticket and ticketed runtime ingress are not exposed in this release-gate slice';

export function createJeditAdmissionTicketHandle(ticketId: string): JeditAdmissionTicketHandle {
  return {
    kind: JEDIT_ADMISSION_TICKET_HANDLE_KIND,
    ticketId,
  };
}

export function createJeditTicketedRuntimeIngress(
  input: JeditTicketedRuntimeIngressInput,
): JeditTicketedRuntimeIngressAvailable {
  return {
    status: JEDIT_TICKETED_RUNTIME_INGRESS_AVAILABLE,
    submissionId: input.submissionId,
    ticket: createJeditAdmissionTicketHandle(input.admissionTicketId),
  };
}

export function missingJeditTicketedRuntimeIngress(
  submissionId: string,
): JeditTicketedRuntimeIngressMissing {
  return {
    status: JEDIT_TICKETED_RUNTIME_INGRESS_MISSING,
    submissionId,
    obstruction: {
      code: JEDIT_TICKETED_RUNTIME_INGRESS_MISSING_CODE,
      reason: MISSING_TICKETED_RUNTIME_INGRESS_REASON,
    },
  };
}
