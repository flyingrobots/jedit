import type {
  JeditCommandEvent,
  JeditCommandReceipt,
  JeditCommandTarget,
} from './command-provenance.js';
import {
  parseVimChordSyntax,
  VimChordSyntaxKinds,
  type VimChordSyntax,
} from './vim-chord-syntax.js';

const TARGET_UNAVAILABLE_SUMMARY = 'target unavailable';
const KEY_SEQUENCE_EMPTY = '<empty>';
const REVERSES_UNSETTLED_EDIT = 'reverses the prior unsettled edit';
const REVERSES_REQUEST_PREFIX = 'reverses request';

export function commandKeySequence(keys: readonly string[]): string {
  return keys.length === 0 ? KEY_SEQUENCE_EMPTY : keys.join('');
}

export function jeditHistoryCommandEventSummary(
  command: string,
  operator: string,
  reversedReceiptId: string | undefined,
  receipt: JeditCommandReceipt,
  reversedRequestId?: number,
): string {
  const reverses = historyReversalSummary(reversedReceiptId, reversedRequestId);
  return `${command} ${operator} ${reverses} receipt ${jeditCommandReceiptMessage(receipt)}`;
}

function historyReversalSummary(
  reversedReceiptId: string | undefined,
  reversedRequestId: number | undefined,
): string {
  if (reversedReceiptId != null) {
    return `reverses receipt ${reversedReceiptId}`;
  }
  return reversedRequestId == null
    ? REVERSES_UNSETTLED_EDIT
    : `${REVERSES_REQUEST_PREFIX} ${reversedRequestId} awaiting receipt`;
}

export function jeditCommandEventSummary(event: JeditCommandEvent): string {
  const syntax = parseVimChordSyntax(event.keys);
  return syntax.kind === VimChordSyntaxKinds.Complete
    ? jeditCommandSummary(event.command, syntax, event.target, event.receipt)
    : event.summary;
}

export function jeditCommandSummary(
  command: string,
  syntax: VimChordSyntax,
  target: JeditCommandTarget | undefined,
  receipt: JeditCommandReceipt,
): string {
  const operation = syntax.operator ?? syntax.family;
  const resolvedTarget = target == null
    ? TARGET_UNAVAILABLE_SUMMARY
    : `${target.kind} ${target.rangeStart}..${target.rangeEnd}`;
  return `${command} ${operation} ${resolvedTarget} receipt ${jeditCommandReceiptMessage(receipt)}`;
}

export function jeditCommandReceiptMessage(receipt: JeditCommandReceipt): string {
  return receipt.receiptId ?? receipt.posture;
}
