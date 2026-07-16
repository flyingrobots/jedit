import type {
  EditorState,
  RegisterState,
  VimRepeatState,
  VimRepeatTargetShape,
} from './editor/model.js';
import type {
  WorkspaceTextAuthority,
  WorkspaceTextAuthorityOpened,
  WorkspaceTextReceiptEvidence,
} from './workspace-text-authority.js';
import {
  WorkspaceTextAuthorityKinds,
  WorkspaceTextIntentStatuses,
  workspaceTextAuthorityWithLastCommandEvent,
  workspaceTextAuthorityWithReceipt,
} from './workspace-text-authority.js';
import { createJeditWhyObservation, jeditWhyObservationMessage, type JeditWhyObservation } from './jedit-why-observation.js';
import {
  commandKeySequence,
  jeditCommandEventSummary,
  jeditCommandReceiptMessage,
  jeditCommandSummary,
  jeditHistoryCommandEventSummary,
} from './jedit-command-event-summary.js';
import {
  parseVimChordSyntax,
  VimChordSyntaxKinds,
  type VimChordSyntax,
} from './vim-chord-syntax.js';

export { workspaceTextAuthorityWithCurrentJeditCommandObservation } from './jedit-command-event-observation.js';

export const JEDIT_WHY_TOAST_TITLE = 'Why';
export const JEDIT_WHY_NO_EVENT_OBSTRUCTION_CODE = 'jedit_why_no_meaningful_event';

export const JEDIT_HISTORY_COMMAND_EVENT_FAMILY = 'history';

export const JeditCommandEventRejectedCodes = Object.freeze({
  InvalidSyntax: 'jedit_command_event_invalid_syntax',
  RangeWithoutBasis: 'jedit_command_event_range_without_basis',
} as const);

export type JeditWhyReportKind = 'event' | 'obstruction';
export type JeditCommandEventReceiptPosture = 'pending' | 'received' | 'unavailable';
export type JeditCommandTargetKind = 'command' | 'motion' | 'registerSource' | 'textObject';
export type JeditCommandEventRejectedCode =
  typeof JeditCommandEventRejectedCodes[keyof typeof JeditCommandEventRejectedCodes];

export interface CreateJeditCommandEventInput {
  readonly editor: EditorState;
  readonly requestId?: number;
  readonly repeat: VimRepeatState;
  readonly textAuthority: WorkspaceTextAuthority;
}

export interface JeditCommandEvent {
  readonly basisDigest?: string;
  readonly command: string;
  readonly count?: number;
  readonly eventId: string;
  readonly family: string;
  readonly keys: readonly string[];
  readonly kind: 'vim';
  readonly motion?: string;
  readonly operator?: string;
  readonly observation: JeditWhyObservation;
  readonly receipt: JeditCommandReceipt;
  readonly receiptId?: string;
  readonly requestId?: number;
  readonly registerEffect?: JeditCommandRegisterEffect;
  readonly replayPolicy?: VimRepeatState['replayPolicy'];
  readonly result: JeditCommandResult;
  readonly reversedReceiptId?: string;
  readonly reversedRequestId?: number;
  readonly summary: string;
  readonly target?: JeditCommandTarget;
  readonly textObject?: JeditCommandTextObject;
}

export interface JeditCommandEventRejected {
  readonly code: JeditCommandEventRejectedCode;
  readonly command: string;
  readonly kind: 'rejected';
  readonly message: string;
}

export type JeditCommandEventFactoryResult =
  | JeditCommandEvent
  | JeditCommandEventRejected;

export interface JeditPlannedCommandEvent {
  readonly event: JeditCommandEvent;
  readonly requestId: number;
}

export interface JeditCommandReceipt {
  readonly posture: JeditCommandEventReceiptPosture;
  readonly receiptId?: string;
}

export interface JeditCommandRegisterEffect {
  readonly basisDigest?: string;
  readonly kind: RegisterState['kind'];
  readonly operation?: string;
  readonly rangeEnd?: number;
  readonly rangeStart?: number;
}

export interface JeditCommandResult {
  readonly cursorCol: number;
  readonly cursorRow: number;
  readonly dirty: boolean;
  readonly mode: string;
}

export interface JeditCommandTarget {
  readonly basisDigest: string;
  readonly kind: JeditCommandTargetKind;
  readonly rangeEnd: number;
  readonly rangeStart: number;
  readonly shape: VimRepeatTargetShape;
}

export interface JeditCommandTextObject {
  readonly scope: string;
  readonly target: string;
}

export interface JeditWhyReport {
  readonly code?: string;
  readonly event?: JeditCommandEvent;
  readonly kind: JeditWhyReportKind;
  readonly message: string;
  readonly title: string;
}

const COMMAND_FIELD_SEPARATOR = ' | ';
const RECEIPT_PENDING = 'pending';
const RECEIPT_UNAVAILABLE = 'unavailable';
const EVENT_ID_SEPARATOR = ':';
const EVENT_KIND_REJECTED: JeditCommandEventRejected['kind'] = 'rejected';
const EVENT_KIND_VIM: JeditCommandEvent['kind'] = 'vim';

export function explainLastJeditCommand(
  editor: EditorState | undefined,
  textAuthority: WorkspaceTextAuthority,
): JeditWhyReport {
  const result = jeditCommandEventResultFromEditor(editor, textAuthority);
  if (result == null) {
    return noCommandEventReport();
  }
  return result.kind === EVENT_KIND_REJECTED
    ? rejectedCommandEventReport(result)
    : commandEventReport(result);
}

export function jeditCommandEventFromEditor(
  editor: EditorState | undefined,
  textAuthority: WorkspaceTextAuthority,
): JeditCommandEvent | undefined {
  const result = jeditCommandEventResultFromEditor(editor, textAuthority);
  return result?.kind === EVENT_KIND_VIM ? result : undefined;
}

export function createJeditCommandEvent(
  input: CreateJeditCommandEventInput,
): JeditCommandEventFactoryResult {
  const syntax = parseVimChordSyntax(input.repeat.keys);
  const command = commandKeySequence(input.repeat.keys);
  if (syntax.kind !== VimChordSyntaxKinds.Complete) {
    return rejectedCommandEvent(command, JeditCommandEventRejectedCodes.InvalidSyntax);
  }
  const receipt = commandReceipt(input.textAuthority);
  const register = registerEffect(input.editor.register);
  const target = commandTarget(input.repeat, syntax);
  if (target != null && target.basisDigest.length === 0) {
    return rejectedCommandEvent(command, JeditCommandEventRejectedCodes.RangeWithoutBasis);
  }
  return eventFromValidatedFacts(input, syntax, receipt, register, target);
}

export function createPlannedJeditCommandEvent(
  input: CreateJeditCommandEventInput & { readonly requestId: number },
): JeditPlannedCommandEvent | JeditCommandEventRejected {
  const result = createJeditCommandEvent(input);
  return result.kind === EVENT_KIND_VIM
    ? { requestId: input.requestId, event: result }
    : result;
}

export function receivedJeditCommandEventForRequest(
  textAuthority: WorkspaceTextAuthority,
  requestId: number,
  receiptId: string,
  reversedReceiptId?: string,
): JeditCommandEvent | undefined {
  const event = plannedOrLastJeditCommandEventForRequest(textAuthority, requestId);
  return event == null
    ? undefined
    : jeditCommandEventWithReceipt(event, { posture: 'received', receiptId }, reversedReceiptId);
}

export function workspaceTextAuthorityWithAppliedJeditCommandReceipt(
  authority: WorkspaceTextAuthorityOpened,
  requestId: number,
  receiptId: string,
  reversedReceiptId?: string,
  evidence: WorkspaceTextReceiptEvidence = {},
): WorkspaceTextAuthorityOpened {
  const withReceipt = workspaceTextAuthorityWithReceipt(authority, receiptId, evidence);
  const event = receivedJeditCommandEventForRequest(authority, requestId, receiptId, reversedReceiptId);
  return event == null
    ? withReceipt
    : workspaceTextAuthorityWithLastCommandEvent(withReceipt, event);
}

function jeditCommandEventResultFromEditor(
  editor: EditorState | undefined,
  textAuthority: WorkspaceTextAuthority,
): JeditCommandEventFactoryResult | undefined {
  const stored = jeditCommandEventFromAuthority(textAuthority);
  if (stored != null) {
    return stored;
  }
  if (editor?.lastVimEdit == null) {
    return undefined;
  }
  return createJeditCommandEvent({
    editor,
    repeat: editor.lastVimEdit,
    textAuthority,
  });
}

function jeditCommandEventFromAuthority(
  textAuthority: WorkspaceTextAuthority,
): JeditCommandEvent | undefined {
  return textAuthority.kind === WorkspaceTextAuthorityKinds.Opened
    ? textAuthority.lastCommandEvent
    : undefined;
}

export function jeditAppliedCommandHistorySummary(
  filePath: string,
  requestId: number,
  textAuthority: WorkspaceTextAuthority,
): string {
  const event = plannedOrLastJeditCommandEventForRequest(textAuthority, requestId);
  return event == null ? filePath : `${filePath} ${event.summary}`;
}

function plannedOrLastJeditCommandEventForRequest(
  textAuthority: WorkspaceTextAuthority,
  requestId: number,
): JeditCommandEvent | undefined {
  if (textAuthority.kind !== WorkspaceTextAuthorityKinds.Opened) {
    return undefined;
  }
  if (textAuthority.pendingCommandEvent?.requestId === requestId) {
    return textAuthority.pendingCommandEvent.event;
  }
  return textAuthority.lastCommandEvent?.requestId === requestId
    ? textAuthority.lastCommandEvent
    : undefined;
}

function eventFromValidatedFacts(
  input: CreateJeditCommandEventInput,
  syntax: VimChordSyntax,
  receipt: JeditCommandReceipt,
  register: JeditCommandRegisterEffect | undefined,
  target: JeditCommandTarget | undefined,
): JeditCommandEvent {
  const command = commandKeySequence(input.repeat.keys);
  const basis = basisDigest(input.editor, input.repeat, target);
  const observation = createJeditWhyObservation({
    basisDigest: basis,
    receiptReferenceId: receipt.receiptId,
    target,
    textAuthority: input.textAuthority,
  });
  return {
    kind: EVENT_KIND_VIM,
    eventId: commandEventId(command, basis, target, receipt, input.requestId),
    command,
    keys: input.repeat.keys,
    family: syntax.family,
    count: syntax.count,
    operator: syntax.operator,
    motion: syntax.motion,
    textObject: syntax.textObject,
    observation,
    basisDigest: basis,
    requestId: input.requestId,
    replayPolicy: input.repeat.replayPolicy,
    receipt,
    receiptId: receipt.receiptId,
    registerEffect: register,
    target,
    result: commandResult(input.editor),
    summary: jeditCommandSummary(command, syntax, target, receipt),
  };
}

function jeditCommandEventWithReceipt(
  event: JeditCommandEvent,
  receipt: JeditCommandReceipt,
  reversedReceiptId?: string,
): JeditCommandEvent {
  if (event.family === JEDIT_HISTORY_COMMAND_EVENT_FAMILY) {
    const received = {
      ...event,
      receipt,
      receiptId: receipt.receiptId,
      reversedReceiptId: reversedReceiptId ?? event.reversedReceiptId,
    };
    return {
      ...received,
      summary: jeditHistoryCommandEventSummary(
        received.command,
        received.operator ?? received.family,
        received.reversedReceiptId,
        receipt,
        received.reversedRequestId,
      ),
    };
  }
  const syntax = parseVimChordSyntax(event.keys);
  const received = {
    ...event,
    eventId: commandEventId(event.command, event.basisDigest, event.target, receipt, event.requestId),
    receipt,
    receiptId: receipt.receiptId,
  };
  return {
    ...received,
    summary: syntax.kind === VimChordSyntaxKinds.Complete
      ? jeditCommandEventSummary(received)
      : event.summary,
  };
}

function commandEventReport(event: JeditCommandEvent): JeditWhyReport {
  return {
    kind: 'event',
    title: JEDIT_WHY_TOAST_TITLE,
    event,
    message: commandEventMessage(event),
  };
}

function noCommandEventReport(): JeditWhyReport {
  const message = `No meaningful command recorded yet. obstruction: ${JEDIT_WHY_NO_EVENT_OBSTRUCTION_CODE}`;
  return {
    kind: 'obstruction',
    title: JEDIT_WHY_TOAST_TITLE,
    code: JEDIT_WHY_NO_EVENT_OBSTRUCTION_CODE,
    message,
  };
}

function rejectedCommandEventReport(rejected: JeditCommandEventRejected): JeditWhyReport {
  return {
    kind: 'obstruction',
    title: JEDIT_WHY_TOAST_TITLE,
    code: rejected.code,
    message: rejected.message,
  };
}

function commandEventMessage(event: JeditCommandEvent): string {
  return [
    `command: ${event.command}`,
    `family: ${event.family}`,
    event.operator == null ? undefined : `operator: ${event.operator}`,
    event.motion == null ? undefined : `motion: ${event.motion}`,
    textObjectMessage(event.textObject),
    targetMessage(event.target),
    registerEffectMessage(event.registerEffect),
    event.basisDigest == null ? undefined : `basis: ${event.basisDigest}`,
    jeditWhyObservationMessage(event.observation),
    `receipt: ${jeditCommandReceiptMessage(event.receipt)}`,
    `result: ${event.result.mode} @ ${event.result.cursorRow}:${event.result.cursorCol}`,
    `summary: ${event.summary}`,
  ].filter((field): field is string => field != null).join(COMMAND_FIELD_SEPARATOR);
}

function commandTarget(repeat: VimRepeatState, syntax: VimChordSyntax): JeditCommandTarget | undefined {
  if (repeat.target != null) {
    return {
      ...repeat.target,
      kind: targetKind(syntax),
    };
  }
  return undefined;
}

function targetKind(syntax: VimChordSyntax): JeditCommandTargetKind {
  if (syntax.textObject != null) {
    return 'textObject';
  }
  return syntax.motion == null ? 'command' : 'motion';
}

function textObjectMessage(object: JeditCommandTextObject | undefined): string | undefined {
  return object == null ? undefined : `text-object: ${object.scope}:${object.target}`;
}

function targetMessage(target: JeditCommandTarget | undefined): string | undefined {
  if (target == null) {
    return undefined;
  }
  return `target: ${target.kind} ${target.shape} ${target.rangeStart}..${target.rangeEnd}`;
}

function registerEffectMessage(effect: JeditCommandRegisterEffect | undefined): string | undefined {
  if (effect == null) {
    return undefined;
  }
  const range = effect.rangeStart == null || effect.rangeEnd == null
    ? undefined
    : ` ${effect.rangeStart}..${effect.rangeEnd}`;
  const operation = effect.operation == null ? undefined : ` ${effect.operation}`;
  return `register: ${effect.kind}${operation ?? ''}${range ?? ''}`;
}

function basisDigest(
  editor: EditorState,
  repeat: VimRepeatState,
  target: JeditCommandTarget | undefined,
): string | undefined {
  return repeat.sourceBasisDigest ?? target?.basisDigest ?? editor.register?.source?.basisDigest;
}

function registerEffect(
  register: RegisterState | undefined,
): JeditCommandRegisterEffect | undefined {
  if (register == null) {
    return undefined;
  }
  return {
    kind: register.kind,
    basisDigest: register.source?.basisDigest,
    operation: register.source?.operation,
    rangeStart: register.source?.rangeStart,
    rangeEnd: register.source?.rangeEnd,
  };
}

function commandReceipt(textAuthority: WorkspaceTextAuthority): JeditCommandReceipt {
  if (textAuthority.kind !== WorkspaceTextAuthorityKinds.Opened) {
    return { posture: RECEIPT_UNAVAILABLE };
  }
  if (textAuthority.pendingIntentStatus === WorkspaceTextIntentStatuses.Predicted) {
    return { posture: RECEIPT_PENDING };
  }
  return textAuthority.lastReceiptId == null
    ? { posture: RECEIPT_PENDING }
    : { posture: 'received', receiptId: textAuthority.lastReceiptId };
}

function commandResult(editor: EditorState): JeditCommandResult {
  return {
    cursorRow: editor.cursorRow,
    cursorCol: editor.cursorCol,
    mode: editor.mode,
    dirty: editor.dirty,
  };
}

function rejectedCommandEvent(
  command: string,
  code: JeditCommandEventRejectedCode,
): JeditCommandEventRejected {
  return {
    kind: EVENT_KIND_REJECTED,
    command,
    code,
    message: `Command provenance rejected for ${command}. obstruction: ${code}`,
  };
}

function commandEventId(
  command: string,
  basis: string | undefined,
  target: JeditCommandTarget | undefined,
  receipt: JeditCommandReceipt,
  requestId: number | undefined,
): string {
  return [
    'jedit-command',
    requestId == null ? 'no-request' : `request:${requestId}`,
    command,
    basis ?? 'no-basis',
    target?.rangeStart ?? 'no-range',
    jeditCommandReceiptMessage(receipt),
  ].join(EVENT_ID_SEPARATOR);
}
