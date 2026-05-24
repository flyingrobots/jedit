export const JEDIT_TICKETED_WORK_AVAILABLE = 'JEDIT_TICKETED_WORK_AVAILABLE';
export const JEDIT_TICKETED_WORK_MISSING = 'JEDIT_TICKETED_WORK_MISSING';
export const JEDIT_TICKETED_WORK_MISSING_CODE = 'JEDIT_TICKETED_WORK_MISSING';

export interface JeditTicketedWorkRequest {
  readonly submissionId: string;
  readonly packageId: string;
  readonly operationName: string;
  readonly canonicalRequestBytesHex: string;
}

export interface JeditTicketedWorkPort {
  issueTicketedWork(request: JeditTicketedWorkRequest): JeditTicketedWorkResult;
}

export interface JeditTicketedWorkAvailable {
  readonly status: typeof JEDIT_TICKETED_WORK_AVAILABLE;
  readonly submissionId: string;
  readonly ticketId: string;
  readonly packageId: string;
  readonly operationName: string;
}

export interface JeditTicketedWorkMissing {
  readonly status: typeof JEDIT_TICKETED_WORK_MISSING;
  readonly submissionId: string;
  readonly obstruction: JeditTicketedWorkObstruction;
}

export interface JeditTicketedWorkObstruction {
  readonly code: typeof JEDIT_TICKETED_WORK_MISSING_CODE;
  readonly reason: string;
}

export type JeditTicketedWorkResult =
  | JeditTicketedWorkAvailable
  | JeditTicketedWorkMissing;
