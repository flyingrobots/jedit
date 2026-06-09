import {
  parseVimChordSyntax,
  type VimChordSyntax,
  type VimChordSyntaxFamily,
} from './vim-chord-syntax.js';

export type VimNormalPhase =
  | 'commandLinePending'
  | 'modifierPending'
  | 'normal'
  | 'operatorPending'
  | 'prefixPending';

export type VimNormalInputOwner =
  | 'commandLine'
  | 'drawer'
  | 'focusTransfer'
  | 'insert'
  | 'modal'
  | 'normal';

export type VimNormalTransitionEffect =
  | 'complete'
  | 'ignored'
  | 'invalid'
  | 'pending'
  | 'reset';

export type VimNormalIgnoredReason =
  | 'ownedByCommandLine'
  | 'ownedByDrawer'
  | 'ownedByFocusTransfer'
  | 'ownedByInsert'
  | 'ownedByModal';

export interface VimNormalAccumulator {
  readonly pendingKeys: readonly string[];
  readonly phase: VimNormalPhase;
  readonly syntax?: VimChordSyntax;
}

export interface VimNormalInput {
  readonly key: string;
  readonly owner: VimNormalInputOwner;
}

export interface VimNormalTransition {
  readonly effect: VimNormalTransitionEffect;
  readonly ignoredReason?: VimNormalIgnoredReason;
  readonly readyForExecution: boolean;
  readonly state: VimNormalAccumulator;
  readonly syntax?: VimChordSyntax;
}

export const VimNormalPhases: Record<string, VimNormalPhase> = Object.freeze({
  CommandLinePending: 'commandLinePending',
  ModifierPending: 'modifierPending',
  Normal: 'normal',
  OperatorPending: 'operatorPending',
  PrefixPending: 'prefixPending',
});

export const VimNormalInputOwners: Record<string, VimNormalInputOwner> = Object.freeze({
  CommandLine: 'commandLine',
  Drawer: 'drawer',
  FocusTransfer: 'focusTransfer',
  Insert: 'insert',
  Modal: 'modal',
  Normal: 'normal',
});

export const VimNormalTransitionEffects: Record<string, VimNormalTransitionEffect> = Object.freeze({
  Complete: 'complete',
  Ignored: 'ignored',
  Invalid: 'invalid',
  Pending: 'pending',
  Reset: 'reset',
});

export const VimNormalIgnoredReasons: Record<string, VimNormalIgnoredReason> = Object.freeze({
  OwnedByCommandLine: 'ownedByCommandLine',
  OwnedByDrawer: 'ownedByDrawer',
  OwnedByFocusTransfer: 'ownedByFocusTransfer',
  OwnedByInsert: 'ownedByInsert',
  OwnedByModal: 'ownedByModal',
});

const PHASE_COMMAND_LINE_PENDING: 'commandLinePending' = 'commandLinePending';
const PHASE_MODIFIER_PENDING: 'modifierPending' = 'modifierPending';
const PHASE_NORMAL: 'normal' = 'normal';
const PHASE_OPERATOR_PENDING: 'operatorPending' = 'operatorPending';
const PHASE_PREFIX_PENDING: 'prefixPending' = 'prefixPending';

const OWNER_COMMAND_LINE: 'commandLine' = 'commandLine';
const OWNER_DRAWER: 'drawer' = 'drawer';
const OWNER_FOCUS_TRANSFER: 'focusTransfer' = 'focusTransfer';
const OWNER_INSERT: 'insert' = 'insert';
const OWNER_MODAL: 'modal' = 'modal';
const OWNER_NORMAL: 'normal' = 'normal';

const EFFECT_COMPLETE: 'complete' = 'complete';
const EFFECT_IGNORED: 'ignored' = 'ignored';
const EFFECT_INVALID: 'invalid' = 'invalid';
const EFFECT_PENDING: 'pending' = 'pending';
const EFFECT_RESET: 'reset' = 'reset';

const REASON_COMMAND_LINE: 'ownedByCommandLine' = 'ownedByCommandLine';
const REASON_DRAWER: 'ownedByDrawer' = 'ownedByDrawer';
const REASON_FOCUS_TRANSFER: 'ownedByFocusTransfer' = 'ownedByFocusTransfer';
const REASON_INSERT: 'ownedByInsert' = 'ownedByInsert';
const REASON_MODAL: 'ownedByModal' = 'ownedByModal';

const SYNTAX_COMPLETE: 'complete' = 'complete';
const SYNTAX_PENDING: 'pending' = 'pending';
const FAMILY_COMMAND_LINE: 'commandLine' = 'commandLine';
const FAMILY_MODIFIER: 'modifier' = 'modifier';
const FAMILY_OPERATOR_COMMAND: 'operatorCommand' = 'operatorCommand';
const FAMILY_PREFIX: 'prefix' = 'prefix';
const ESCAPE_KEY = 'escape';

const EMPTY_KEYS: readonly string[] = Object.freeze([]);
const OWNER_REASONS: ReadonlyMap<VimNormalInputOwner, VimNormalIgnoredReason> = new Map([
  [OWNER_COMMAND_LINE, REASON_COMMAND_LINE],
  [OWNER_DRAWER, REASON_DRAWER],
  [OWNER_FOCUS_TRANSFER, REASON_FOCUS_TRANSFER],
  [OWNER_INSERT, REASON_INSERT],
  [OWNER_MODAL, REASON_MODAL],
]);

export function createVimNormalAccumulator(): VimNormalAccumulator {
  return normalAccumulator();
}

export function updateVimNormalAccumulator(
  state: VimNormalAccumulator,
  input: VimNormalInput,
): VimNormalTransition {
  if (input.owner !== OWNER_NORMAL) {
    return ignoredTransition(state, input.owner);
  }
  if (input.key === ESCAPE_KEY) {
    return resetTransition();
  }
  return syntaxTransition(parseVimChordSyntax([...state.pendingKeys, input.key]));
}

function syntaxTransition(syntax: VimChordSyntax): VimNormalTransition {
  if (syntax.kind === SYNTAX_PENDING) {
    return pendingTransition(syntax);
  }
  return syntax.kind === SYNTAX_COMPLETE
    ? completeTransition(syntax)
    : invalidTransition(syntax);
}

function pendingTransition(syntax: VimChordSyntax): VimNormalTransition {
  return {
    effect: EFFECT_PENDING,
    readyForExecution: false,
    state: pendingAccumulator(syntax),
    syntax,
  };
}

function completeTransition(syntax: VimChordSyntax): VimNormalTransition {
  return {
    effect: EFFECT_COMPLETE,
    readyForExecution: true,
    state: normalAccumulator(),
    syntax,
  };
}

function invalidTransition(syntax: VimChordSyntax): VimNormalTransition {
  return {
    effect: EFFECT_INVALID,
    readyForExecution: false,
    state: normalAccumulator(),
    syntax,
  };
}

function resetTransition(): VimNormalTransition {
  return {
    effect: EFFECT_RESET,
    readyForExecution: false,
    state: normalAccumulator(),
  };
}

function ignoredTransition(
  state: VimNormalAccumulator,
  owner: VimNormalInputOwner,
): VimNormalTransition {
  return {
    effect: EFFECT_IGNORED,
    ignoredReason: OWNER_REASONS.get(owner),
    readyForExecution: false,
    state,
  };
}

function normalAccumulator(): VimNormalAccumulator {
  return { pendingKeys: EMPTY_KEYS, phase: PHASE_NORMAL };
}

function pendingAccumulator(syntax: VimChordSyntax): VimNormalAccumulator {
  return {
    pendingKeys: syntax.keys,
    phase: pendingPhase(syntax.family),
    syntax,
  };
}

function pendingPhase(family: VimChordSyntaxFamily): VimNormalPhase {
  if (family === FAMILY_OPERATOR_COMMAND) {
    return PHASE_OPERATOR_PENDING;
  }
  if (family === FAMILY_MODIFIER) {
    return PHASE_MODIFIER_PENDING;
  }
  return pendingNonOperatorPhase(family);
}

function pendingNonOperatorPhase(family: VimChordSyntaxFamily): VimNormalPhase {
  if (family === FAMILY_COMMAND_LINE) {
    return PHASE_COMMAND_LINE_PENDING;
  }
  return family === FAMILY_PREFIX ? PHASE_PREFIX_PENDING : PHASE_PREFIX_PENDING;
}
