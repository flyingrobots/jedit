import {
  workspaceBufferFileBasisHeadId,
  WorkspaceBufferCausalDurabilityKinds,
  type WorkspaceBufferDurability,
} from './workspace-buffer-durability.js';

const BASIS_LAST_SAVE = 'last-save';
const BASIS_IMPORT = 'import';

export const WorkspaceCausalGutterBasisKinds = Object.freeze({
  LastSave: BASIS_LAST_SAVE,
  Import: BASIS_IMPORT,
} as const);

export type WorkspaceCausalGutterBasisKind =
  typeof WorkspaceCausalGutterBasisKinds[keyof typeof WorkspaceCausalGutterBasisKinds];

export type WorkspaceCausalGutterBasis =
  | { readonly kind: typeof BASIS_LAST_SAVE }
  | { readonly kind: typeof BASIS_IMPORT };

const BASIS_ORDER: readonly WorkspaceCausalGutterBasisKind[] = Object.freeze([
  BASIS_LAST_SAVE,
  BASIS_IMPORT,
]);

export const INITIAL_WORKSPACE_CAUSAL_GUTTER_BASIS: WorkspaceCausalGutterBasis = Object.freeze({
  kind: BASIS_LAST_SAVE,
});

export function nextWorkspaceCausalGutterBasis(
  current: WorkspaceCausalGutterBasis | undefined,
  delta: number,
): WorkspaceCausalGutterBasis {
  const currentIndex = BASIS_ORDER.indexOf(current?.kind ?? BASIS_LAST_SAVE);
  const nextIndex = positiveModulo((currentIndex < 0 ? 0 : currentIndex) + delta, BASIS_ORDER.length);
  const nextKind = BASIS_ORDER[nextIndex] ?? BASIS_LAST_SAVE;
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
  return undefined;
}

export function workspaceCurrentCausalHeadId(
  durability: WorkspaceBufferDurability,
): string | undefined {
  return durability.causal.kind === WorkspaceBufferCausalDurabilityKinds.Admitted
    ? nonEmptyId(durability.causal.headId)
    : undefined;
}

function positiveModulo(value: number, size: number): number {
  return ((value % size) + size) % size;
}

function nonEmptyId(value: string | undefined): string | undefined {
  return value == null || value.trim().length === 0 ? undefined : value;
}
