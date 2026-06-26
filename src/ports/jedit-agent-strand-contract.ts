const STATUS_READY = 'ready';
const STATUS_INVALID = 'invalid';
const STATUS_ACCEPTED = 'accepted';
const STATUS_OBSTRUCTED = 'obstructed';
const DEFAULT_ADMISSION_TARGET = 'main';
const DEFAULT_RECEIPT_POLICY = 'required';
const DEFAULT_CANONICAL_WRITE_POLICY = 'braid-admission-only';
const AGENT_STRAND_PREFIX = 'agent';
const GRAPH_UNIVERSE_PREFIX = 'graph';
const INVALID_AGENT_ID = 'agentId is required';
const INVALID_SESSION_ID = 'sessionId is required';
const INVALID_BASIS = 'basis is required';
const INVALID_INTENT_KIND = 'intent.kind is required';

export const JeditAgentStrandStatuses = Object.freeze({
  Ready: STATUS_READY,
  Invalid: STATUS_INVALID,
  Accepted: STATUS_ACCEPTED,
  Obstructed: STATUS_OBSTRUCTED,
} as const);

export const JeditAgentStrandOperations = Object.freeze({
  OpenSession: 'jim.agent.openSession',
  SubmitIntent: 'jim.agent.submitIntent',
  ReadProjection: 'jim.agent.readProjection',
  DiffStrand: 'jim.agent.diffStrand',
  ExplainIntent: 'jim.agent.explainIntent',
  PreviewBraid: 'jim.agent.previewBraid',
  RequestAdmission: 'jim.agent.requestAdmission',
} as const);

export type JeditAgentStrandStatus =
  typeof JeditAgentStrandStatuses[keyof typeof JeditAgentStrandStatuses];
export type JeditAgentStrandOperation =
  typeof JeditAgentStrandOperations[keyof typeof JeditAgentStrandOperations];

export interface JeditAgentStrandSessionRequest {
  readonly agentId: string;
  readonly sessionId: string;
  readonly basis: string;
  readonly capabilities?: readonly string[];
  readonly rationale?: string;
  readonly strand?: string;
  readonly admissionTarget?: string;
}

export interface JeditAgentStrandSession {
  readonly agentId: string;
  readonly sessionId: string;
  readonly basis: string;
  readonly strand: string;
  readonly graphUniverseId: string;
  readonly admissionTarget: string;
  readonly capabilities: readonly string[];
  readonly rationale?: string;
  readonly receiptPolicy: typeof DEFAULT_RECEIPT_POLICY;
  readonly canonicalWritePolicy: typeof DEFAULT_CANONICAL_WRITE_POLICY;
}

export interface JeditAgentIntentRange {
  readonly path: string;
  readonly startLine: number;
  readonly endLine: number;
}

export type JeditAgentIntentPayloadValue = string | number | boolean | null;

export interface JeditAgentIntent {
  readonly kind: string;
  readonly path?: string;
  readonly affectedRanges?: readonly JeditAgentIntentRange[];
  readonly rationale?: string;
  readonly payload?: Record<string, JeditAgentIntentPayloadValue>;
}

export interface JeditAgentIntentEnvelope {
  readonly operation: typeof JeditAgentStrandOperations.SubmitIntent;
  readonly session: JeditAgentStrandSession;
  readonly intent: JeditAgentIntent;
  readonly receiptPolicy: typeof DEFAULT_RECEIPT_POLICY;
}

export interface JeditAgentBraidPreviewRequest {
  readonly operation: typeof JeditAgentStrandOperations.PreviewBraid;
  readonly session: JeditAgentStrandSession;
  readonly members: readonly string[];
  readonly admissionTarget: string;
}

export interface JeditAgentAdmissionRequest {
  readonly operation: typeof JeditAgentStrandOperations.RequestAdmission;
  readonly session: JeditAgentStrandSession;
  readonly braidId: string;
  readonly admissionTarget: string;
}

export interface JeditAgentStrandReadyResult {
  readonly status: typeof JeditAgentStrandStatuses.Ready;
  readonly session: JeditAgentStrandSession;
}

export interface JeditAgentStrandInvalidResult {
  readonly status: typeof JeditAgentStrandStatuses.Invalid;
  readonly reason: string;
}

export type JeditAgentStrandSessionResult =
  JeditAgentStrandReadyResult | JeditAgentStrandInvalidResult;

export interface JeditAgentOperationAccepted {
  readonly status: typeof JeditAgentStrandStatuses.Accepted;
  readonly receiptId: string;
}

export interface JeditAgentOperationObstructed {
  readonly status: typeof JeditAgentStrandStatuses.Obstructed;
  readonly reason: string;
}

export type JeditAgentOperationResult =
  JeditAgentOperationAccepted | JeditAgentOperationObstructed;

export interface JeditAgentStrandPort {
  openSession(request: JeditAgentStrandSessionRequest): Promise<JeditAgentStrandSessionResult>;
  submitIntent(envelope: JeditAgentIntentEnvelope): Promise<JeditAgentOperationResult>;
  readProjection(session: JeditAgentStrandSession): Promise<JeditAgentOperationResult>;
  diffStrand(session: JeditAgentStrandSession): Promise<JeditAgentOperationResult>;
  explainIntent(envelope: JeditAgentIntentEnvelope): Promise<JeditAgentOperationResult>;
  previewBraid(request: JeditAgentBraidPreviewRequest): Promise<JeditAgentOperationResult>;
  requestAdmission(request: JeditAgentAdmissionRequest): Promise<JeditAgentOperationResult>;
}

export function createJeditAgentStrandSession(
  request: JeditAgentStrandSessionRequest,
): JeditAgentStrandSessionResult {
  const invalid = validateSessionRequest(request);
  if (invalid != null) {
    return invalidAgentSession(invalid);
  }

  const strand = request.strand ?? defaultAgentStrand(request);
  return {
    status: JeditAgentStrandStatuses.Ready,
    session: {
      agentId: request.agentId,
      sessionId: request.sessionId,
      basis: request.basis,
      strand,
      graphUniverseId: graphUniverseId(strand),
      admissionTarget: request.admissionTarget ?? DEFAULT_ADMISSION_TARGET,
      capabilities: request.capabilities ?? [],
      rationale: request.rationale,
      receiptPolicy: DEFAULT_RECEIPT_POLICY,
      canonicalWritePolicy: DEFAULT_CANONICAL_WRITE_POLICY,
    },
  };
}

export function createJeditAgentIntentEnvelope(
  session: JeditAgentStrandSession,
  intent: JeditAgentIntent,
): JeditAgentIntentEnvelope | JeditAgentStrandInvalidResult {
  if (intent.kind.trim().length === 0) {
    return invalidAgentSession(INVALID_INTENT_KIND);
  }
  return {
    operation: JeditAgentStrandOperations.SubmitIntent,
    session,
    intent,
    receiptPolicy: DEFAULT_RECEIPT_POLICY,
  };
}

export function createJeditAgentBraidPreviewRequest(
  session: JeditAgentStrandSession,
  members: readonly string[] = [DEFAULT_ADMISSION_TARGET, session.strand],
): JeditAgentBraidPreviewRequest {
  return {
    operation: JeditAgentStrandOperations.PreviewBraid,
    session,
    members,
    admissionTarget: session.admissionTarget,
  };
}

export function createJeditAgentAdmissionRequest(
  session: JeditAgentStrandSession,
  braidId: string,
): JeditAgentAdmissionRequest {
  return {
    operation: JeditAgentStrandOperations.RequestAdmission,
    session,
    braidId,
    admissionTarget: session.admissionTarget,
  };
}

function validateSessionRequest(
  request: JeditAgentStrandSessionRequest,
): string | undefined {
  if (request.agentId.trim().length === 0) {
    return INVALID_AGENT_ID;
  }
  if (request.sessionId.trim().length === 0) {
    return INVALID_SESSION_ID;
  }
  return request.basis.trim().length === 0 ? INVALID_BASIS : undefined;
}

function invalidAgentSession(reason: string): JeditAgentStrandInvalidResult {
  return {
    status: JeditAgentStrandStatuses.Invalid,
    reason,
  };
}

function defaultAgentStrand(request: JeditAgentStrandSessionRequest): string {
  return [
    AGENT_STRAND_PREFIX,
    sanitizePathSegment(request.agentId),
    sanitizePathSegment(request.sessionId),
  ].join('/');
}

function graphUniverseId(strand: string): string {
  return `${GRAPH_UNIVERSE_PREFIX}:${strand}`;
}

function sanitizePathSegment(value: string): string {
  return value.trim().replace(/[^A-Za-z0-9_.-]+/g, '-');
}
