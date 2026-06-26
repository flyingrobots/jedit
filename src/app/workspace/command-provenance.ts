import type { EditorState, RegisterState, VimRepeatState } from './editor/model.js';
import type { WorkspaceTextAuthority } from './workspace-text-authority.js';
import { WorkspaceTextAuthorityKinds } from './workspace-text-authority.js';
import { parseVimChordSyntax } from './vim-chord-syntax.js';

export const JEDIT_WHY_TOAST_TITLE = 'Why';
export const JEDIT_WHY_NO_EVENT_OBSTRUCTION_CODE = 'jedit_why_no_meaningful_event';

export type JeditWhyReportKind = 'event' | 'obstruction';

export interface JeditCommandEvent {
  readonly basisDigest?: string;
  readonly command: string;
  readonly count?: number;
  readonly family: string;
  readonly keys: readonly string[];
  readonly kind: 'vim';
  readonly motion?: string;
  readonly operator?: string;
  readonly receiptId?: string;
  readonly registerEffect?: JeditCommandRegisterEffect;
  readonly replayPolicy?: VimRepeatState['replayPolicy'];
  readonly result: JeditCommandResult;
  readonly textObject?: JeditCommandTextObject;
}

export interface JeditCommandRegisterEffect {
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
const KEY_SEQUENCE_EMPTY = '<empty>';
const RECEIPT_PENDING = 'pending';
const RECEIPT_UNAVAILABLE = 'unavailable';

export function explainLastJeditCommand(
  editor: EditorState | undefined,
  textAuthority: WorkspaceTextAuthority,
): JeditWhyReport {
  const event = jeditCommandEventFromEditor(editor, textAuthority);
  return event == null ? noCommandEventReport() : commandEventReport(event);
}

export function jeditCommandEventFromEditor(
  editor: EditorState | undefined,
  textAuthority: WorkspaceTextAuthority,
): JeditCommandEvent | undefined {
  if (editor?.lastVimEdit == null) {
    return undefined;
  }

  const repeat = editor.lastVimEdit;
  const syntax = parseVimChordSyntax(repeat.keys);
  return {
    kind: 'vim',
    command: commandKeySequence(repeat.keys),
    keys: repeat.keys,
    family: syntax.family,
    count: syntax.count,
    operator: syntax.operator,
    motion: syntax.motion,
    textObject: syntax.textObject,
    basisDigest: basisDigest(editor, repeat),
    replayPolicy: repeat.replayPolicy,
    receiptId: receiptId(textAuthority),
    registerEffect: registerEffect(editor.register),
    result: {
      cursorRow: editor.cursorRow,
      cursorCol: editor.cursorCol,
      mode: editor.mode,
      dirty: editor.dirty,
    },
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

function commandEventMessage(event: JeditCommandEvent): string {
  return [
    `command: ${event.command}`,
    `family: ${event.family}`,
    event.operator == null ? undefined : `operator: ${event.operator}`,
    event.motion == null ? undefined : `motion: ${event.motion}`,
    event.textObject == null
      ? undefined
      : `text-object: ${event.textObject.scope}:${event.textObject.target}`,
    registerEffectMessage(event.registerEffect),
    event.basisDigest == null ? undefined : `basis: ${event.basisDigest}`,
    `receipt: ${event.receiptId ?? RECEIPT_PENDING}`,
    `result: ${event.result.mode} @ ${event.result.cursorRow}:${event.result.cursorCol}`,
  ].filter((field): field is string => field != null).join(COMMAND_FIELD_SEPARATOR);
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
): string | undefined {
  return repeat.sourceBasisDigest ?? editor.register?.source?.basisDigest;
}

function registerEffect(
  register: RegisterState | undefined,
): JeditCommandRegisterEffect | undefined {
  if (register == null) {
    return undefined;
  }
  return {
    kind: register.kind,
    operation: register.source?.operation,
    rangeStart: register.source?.rangeStart,
    rangeEnd: register.source?.rangeEnd,
  };
}

function receiptId(textAuthority: WorkspaceTextAuthority): string | undefined {
  if (textAuthority.kind !== WorkspaceTextAuthorityKinds.Opened) {
    return RECEIPT_UNAVAILABLE;
  }
  return textAuthority.lastReceiptId;
}

function commandKeySequence(keys: readonly string[]): string {
  return keys.length === 0 ? KEY_SEQUENCE_EMPTY : keys.join('');
}
