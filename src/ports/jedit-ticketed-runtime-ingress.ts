export const JEDIT_ADMISSION_TICKET_HANDLE_KIND = 'jedit-admission-ticket-handle';
export const JEDIT_TICKETED_RUNTIME_INGRESS_AVAILABLE = 'TICKETED_RUNTIME_INGRESS_AVAILABLE';
export const JEDIT_TICKETED_RUNTIME_INGRESS_MISSING = 'TICKETED_RUNTIME_INGRESS_MISSING';
export const JEDIT_TICKETED_RUNTIME_INGRESS_MISSING_CODE = 'JEDIT_TICKETED_RUNTIME_INGRESS_UNAVAILABLE';

export interface JeditAdmissionTicketHandle {
  readonly kind: typeof JEDIT_ADMISSION_TICKET_HANDLE_KIND;
  readonly ticketId: string;
}

export interface JeditTicketedRuntimeIngressInput {
  readonly submissionId: string;
  readonly admissionTicketId: string;
}

export interface JeditTicketedRuntimeIngressAvailable {
  readonly status: typeof JEDIT_TICKETED_RUNTIME_INGRESS_AVAILABLE;
  readonly submissionId: string;
  readonly ticket: JeditAdmissionTicketHandle;
}

export interface JeditTicketedRuntimeIngressMissing {
  readonly status: typeof JEDIT_TICKETED_RUNTIME_INGRESS_MISSING;
  readonly submissionId: string;
  readonly obstruction: JeditTicketedRuntimeIngressObstruction;
}

export interface JeditTicketedRuntimeIngressObstruction {
  readonly code: typeof JEDIT_TICKETED_RUNTIME_INGRESS_MISSING_CODE;
  readonly reason: string;
}

export type JeditTicketedRuntimeIngressPosture =
  | JeditTicketedRuntimeIngressAvailable
  | JeditTicketedRuntimeIngressMissing;
