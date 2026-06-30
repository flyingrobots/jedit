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
