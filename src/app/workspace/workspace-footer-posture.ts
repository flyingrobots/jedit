import { workspaceTextAuthorityPosture } from './workspace-text-authority.js';
import { WorkspaceTextAuthorityKinds } from './workspace-text-authority.js';
import {
  workspaceBufferFileDirtyReading,
  WorkspaceBufferCausalLineChangeKinds,
  WorkspaceBufferCausalDurabilityKinds,
  WorkspaceBufferFileDirtyKinds,
  WorkspaceBufferFileDurabilityKinds,
  WorkspaceBufferIntentDurabilityKinds,
  type WorkspaceBufferDurability,
  type WorkspaceBufferFileDurability,
  type WorkspaceBufferIntentDurability,
  type WorkspaceBufferCausalLineChanges,
} from './workspace-buffer-durability.js';
import {
  workspaceWorldlineContextLabel,
  workspaceWorldlineMaterialization,
  worldlineGraphContextLine,
  WorkspaceHistoryDrawerViews,
} from './worldline-state.js';
import type { WorkspaceModel } from './model.js';
import { jeditCommandFooterSummary } from './command-provenance-summaries.js';
import { workspaceFooterWhyEvidence } from './workspace-causal-evidence-explainers.js';

const WHY_FOOTER_I18N_KEYS = Object.freeze({
  Head: 'footer.evidence.head',
  Tick: 'footer.evidence.tick',
  Anchor: 'footer.evidence.anchor',
  Coverage: 'footer.evidence.coverage',
  Complete: 'footer.evidence.complete',
  Partial: 'footer.evidence.partial',
  Unavailable: 'footer.evidence.unavailable',
} as const);
const WHY_EVIDENCE_COVERAGE = Object.freeze({
  Complete: 'COMPLETE',
  Partial: 'PARTIAL',
} as const);

export function workspaceFooterTextPosture(model: WorkspaceModel): string {
  const whyEvidence = workspaceFooterWhyEvidencePosture(model);
  if (whyEvidence != null) {
    return whyEvidence;
  }
  return [
    workspaceFooterAuthorityPosture(model),
    workspaceWorldlineContextLabel({
      worldline: model.worldline,
      materialization: workspaceFooterMaterialization(model),
      causalLineDelta: workspaceFooterCausalLineDelta(model),
    }),
  ].join(' | ');
}

export function workspaceFooterWhyEvidencePosture(model: WorkspaceModel): string | undefined {
  const evidence = workspaceFooterWhyEvidence(model);
  if (evidence == null) {
    return undefined;
  }
  return [
    `${model.i18n.t(WHY_FOOTER_I18N_KEYS.Head)}=${evidence.headId}`,
    evidenceListPosture(model.i18n.t(WHY_FOOTER_I18N_KEYS.Tick), evidence.tickReceiptIds),
    evidenceListPosture(model.i18n.t(WHY_FOOTER_I18N_KEYS.Anchor), evidence.causalAnchorIds),
    `${model.i18n.t(WHY_FOOTER_I18N_KEYS.Coverage)}=${footerCoverageLabel(model, evidence.coverage)}`,
  ].filter((part): part is string => part != null).join(' ');
}

export function workspaceBufferDurabilityFooterPosture(
  durability: WorkspaceBufferDurability,
): string {
  return [
    footerIntentPosture(durability.intent),
    footerCausalPosture(durability),
    footerFilePosture(durability.file),
    `git:${durability.localGit.kind}`,
    `remote:${durability.remoteGit.kind}`,
  ].join(' | ');
}

export function workspaceHistoryContextLine(model: WorkspaceModel): string | undefined {
  if (model.historyDrawerView !== WorkspaceHistoryDrawerViews.Worldlines) {
    return undefined;
  }
  const lineChanges = model.textAuthority.kind === WorkspaceTextAuthorityKinds.Opened
    ? model.textAuthority.durability.lineChanges
    : undefined;
  return [
    worldlineGraphContextLine(model.worldline),
    lineChanges == null ? undefined : causalLineChangesDebugLabel(lineChanges),
  ].filter((part): part is string => part != null).join(' | ');
}

export function workspaceFooterCommandSummary(model: WorkspaceModel): string | undefined {
  return jeditCommandFooterSummary(model.editor, model.textAuthority);
}

function workspaceFooterMaterialization(
  model: WorkspaceModel,
) {
  return model.textAuthority.kind === WorkspaceTextAuthorityKinds.Opened
    ? model.textAuthority.materialization
    : workspaceWorldlineMaterialization(model.editor?.dirty);
}

function workspaceFooterAuthorityPosture(model: WorkspaceModel): string {
  return model.textAuthority.kind === WorkspaceTextAuthorityKinds.Opened
    ? workspaceBufferDurabilityFooterPosture(model.textAuthority.durability)
    : workspaceTextAuthorityPosture(model.textAuthority);
}

function workspaceFooterCausalLineDelta(
  model: WorkspaceModel,
): { readonly insertedLineCount: number | null; readonly deletedLineCount: number | null } | undefined {
  if (model.textAuthority.kind !== WorkspaceTextAuthorityKinds.Opened) {
    return undefined;
  }
  const lineChanges = model.textAuthority.durability.lineChanges;
  return lineChanges.kind === WorkspaceBufferCausalLineChangeKinds.Available
    ? {
      insertedLineCount: lineChanges.insertedLineCount,
      deletedLineCount: lineChanges.deletedLineCount,
    }
    : { insertedLineCount: null, deletedLineCount: null };
}

function causalLineChangesDebugLabel(lineChanges: WorkspaceBufferCausalLineChanges): string {
  if (lineChanges.kind === WorkspaceBufferCausalLineChangeKinds.Unavailable) {
    return `Causal lines unavailable:${lineChanges.reason}`;
  }
  const rewrites = lineChanges.rewriteIds.length === 0 ? '-' : lineChanges.rewriteIds.join(',');
  const diffs = lineChanges.diffIds.length === 0 ? '-' : lineChanges.diffIds.join(',');
  return [
    `Causal lines ${lineChanges.basisHeadId}->${lineChanges.nextHeadId}`,
    `+${lineChanges.insertedLineCount}/-${lineChanges.deletedLineCount}`,
    `rewrites:${rewrites}`,
    `diffs:${diffs}`,
  ].join(' ');
}

function footerIntentPosture(intent: WorkspaceBufferIntentDurability): string {
  return intent.kind === WorkspaceBufferIntentDurabilityKinds.Idle
    ? 'intent:idle'
    : `intent:pending:${intent.status}`;
}

function footerCausalPosture(durability: WorkspaceBufferDurability): string {
  if (durability.causal.kind !== WorkspaceBufferCausalDurabilityKinds.Admitted) {
    return 'causal:unavailable';
  }
  return workspaceBufferFileDirtyReading(durability).kind === WorkspaceBufferFileDirtyKinds.Dirty
    ? 'causal:unsaved'
    : 'causal:admitted';
}

function footerFilePosture(file: WorkspaceBufferFileDurability): string {
  return file.kind === WorkspaceBufferFileDurabilityKinds.Saved && file.exportReadingId != null
    ? 'file:exported'
    : `file:${file.kind}`;
}

function evidenceListPosture(label: string, ids: readonly string[]): string | undefined {
  return ids.length === 0 ? undefined : `${label}=${ids.join(',')}`;
}

function footerCoverageLabel(
  model: WorkspaceModel,
  coverage: NonNullable<ReturnType<typeof workspaceFooterWhyEvidence>>['coverage'],
): string {
  if (coverage === WHY_EVIDENCE_COVERAGE.Complete) {
    return model.i18n.t(WHY_FOOTER_I18N_KEYS.Complete);
  }
  return model.i18n.t(
    coverage === WHY_EVIDENCE_COVERAGE.Partial
      ? WHY_FOOTER_I18N_KEYS.Partial
      : WHY_FOOTER_I18N_KEYS.Unavailable,
  );
}
