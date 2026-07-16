import {
  workspaceBufferFileBasisHeadId,
  WorkspaceBufferCausalDurabilityKinds,
  type WorkspaceBufferDurability,
} from './workspace-buffer-durability.js';
import {
  EchoHistoryEntryKinds,
  sortedEchoHistoryEntries,
  type EchoHistoryEntry,
} from './echo-history.js';

const BASIS_LAST_SAVE = 'last-save';
const BASIS_IMPORT = 'import';
const BASIS_SELECTED_CHECKPOINT = 'selected-checkpoint';
const BASIS_SELECTED_TICK = 'selected-tick';

export const WorkspaceCausalGutterBasisKinds = Object.freeze({
  LastSave: BASIS_LAST_SAVE,
  Import: BASIS_IMPORT,
  SelectedCheckpoint: BASIS_SELECTED_CHECKPOINT,
  SelectedTick: BASIS_SELECTED_TICK,
} as const);

export type WorkspaceCausalGutterBasisKind =
  typeof WorkspaceCausalGutterBasisKinds[keyof typeof WorkspaceCausalGutterBasisKinds];

export type WorkspaceCausalGutterBasis =
  | { readonly kind: typeof BASIS_LAST_SAVE }
  | { readonly kind: typeof BASIS_IMPORT }
  | {
      readonly kind: typeof BASIS_SELECTED_CHECKPOINT;
      readonly evidenceId?: string;
      readonly headId?: string;
    }
  | {
      readonly kind: typeof BASIS_SELECTED_TICK;
      readonly evidenceId?: string;
      readonly headId?: string;
      readonly tickId?: string;
    };

const BASIS_ORDER: readonly WorkspaceCausalGutterBasisKind[] = Object.freeze([
  BASIS_LAST_SAVE,
  BASIS_IMPORT,
  BASIS_SELECTED_CHECKPOINT,
  BASIS_SELECTED_TICK,
]);

export const INITIAL_WORKSPACE_CAUSAL_GUTTER_BASIS: WorkspaceCausalGutterBasis = Object.freeze({
  kind: BASIS_LAST_SAVE,
});

export function nextWorkspaceCausalGutterBasis(
  current: WorkspaceCausalGutterBasis | undefined,
  delta: number,
  history: readonly EchoHistoryEntry[],
  selectedHistoryIndex: number,
): WorkspaceCausalGutterBasis {
  const currentIndex = BASIS_ORDER.indexOf(current?.kind ?? BASIS_LAST_SAVE);
  const nextIndex = positiveModulo((currentIndex < 0 ? 0 : currentIndex) + delta, BASIS_ORDER.length);
  const nextKind = BASIS_ORDER[nextIndex] ?? BASIS_LAST_SAVE;
  const selectedEntry = sortedEchoHistoryEntries(history)[selectedHistoryIndex];
  if (nextKind === BASIS_SELECTED_CHECKPOINT) {
    return selectedCheckpointBasis(selectedEntry);
  }
  if (nextKind === BASIS_SELECTED_TICK) {
    return selectedTickBasis(selectedEntry);
  }
  return { kind: nextKind };
}

export function workspaceCausalGutterBasisHeadId(
  basis: WorkspaceCausalGutterBasis | undefined,
  durability: WorkspaceBufferDurability,
): string | undefined {
  if (basis == null || basis.kind === BASIS_LAST_SAVE) {
    return workspaceBufferFileBasisHeadId(durability.file);
  }
  if (basis.kind === BASIS_IMPORT) {
    return nonEmptyId(durability.importBasisHeadId);
  }
  if (basis.kind === BASIS_SELECTED_CHECKPOINT) {
    return nonEmptyId(basis.evidenceId) == null ? undefined : nonEmptyId(basis.headId);
  }
  return nonEmptyId(basis.evidenceId) == null || nonEmptyId(basis.tickId) == null
    ? undefined
    : nonEmptyId(basis.headId);
}

export function workspaceCurrentCausalHeadId(
  durability: WorkspaceBufferDurability,
): string | undefined {
  return durability.causal.kind === WorkspaceBufferCausalDurabilityKinds.Admitted
    ? nonEmptyId(durability.causal.headId)
    : undefined;
}

function selectedCheckpointBasis(
  entry: EchoHistoryEntry | undefined,
): WorkspaceCausalGutterBasis {
  if (entry?.kind !== EchoHistoryEntryKinds.Checkpoint) {
    return { kind: BASIS_SELECTED_CHECKPOINT };
  }
  const evidenceId = nonEmptyId(entry.evidenceId);
  const headId = nonEmptyId(entry.causalHeadId);
  return evidenceId == null || headId == null
    ? { kind: BASIS_SELECTED_CHECKPOINT }
    : { kind: BASIS_SELECTED_CHECKPOINT, evidenceId, headId };
}

function selectedTickBasis(entry: EchoHistoryEntry | undefined): WorkspaceCausalGutterBasis {
  if (entry?.kind !== EchoHistoryEntryKinds.Edit) {
    return { kind: BASIS_SELECTED_TICK };
  }
  const evidenceId = nonEmptyId(entry.evidenceId);
  const headId = nonEmptyId(entry.causalHeadId);
  const tickId = nonEmptyId(entry.causalTickId);
  return evidenceId == null || headId == null || tickId == null
    ? { kind: BASIS_SELECTED_TICK }
    : { kind: BASIS_SELECTED_TICK, evidenceId, headId, tickId };
}

function positiveModulo(value: number, size: number): number {
  return ((value % size) + size) % size;
}

function nonEmptyId(value: string | undefined): string | undefined {
  return value == null || value.trim().length === 0 ? undefined : value;
}
