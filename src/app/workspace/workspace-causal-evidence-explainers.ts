import {
  JeditWhyRangeOriginKinds,
  RESULT_PRODUCED,
  type JeditWhyRangeOrigin,
  type JeditWhyRangeReport,
  type JeditWhyRangeRewriteOrigin,
} from '../../ports/jedit-why-range.js';
import type { WorkspaceModel } from './model.js';
import { workspaceInlinePanelWhyRangeReport } from './workspace-inline-panel.js';

const COVERAGE_UNAVAILABLE = 'UNAVAILABLE';

export interface WorkspaceGutterWhyEvidence {
  readonly headId: string;
  readonly rewriteIds: readonly string[];
  readonly diffIds: readonly string[];
  readonly tickReceiptIds: readonly string[];
}

export interface WorkspaceFooterWhyEvidence {
  readonly headId: string;
  readonly tickReceiptIds: readonly string[];
  readonly causalAnchorIds: readonly string[];
  readonly coverage: 'COMPLETE' | 'PARTIAL' | typeof COVERAGE_UNAVAILABLE;
}

export interface WorkspaceGutterWhySupport {
  readonly nextHeadId: string;
  readonly rewriteIds: readonly string[];
  readonly diffIds: readonly string[];
  readonly tickReceiptIds: readonly string[];
}

export function workspaceGutterWhyEvidence(
  model: WorkspaceModel,
  lineNumber: number,
  support: WorkspaceGutterWhySupport,
): WorkspaceGutterWhyEvidence | undefined {
  const report = workspaceInlinePanelWhyRangeReport(model);
  if (report == null || model.editor?.cursorRow !== lineNumber || report.witness.basisHeadId !== support.nextHeadId) {
    return undefined;
  }
  const origins = rewriteOrigins(report);
  const evidence = rewriteEvidence(report, origins);
  return origins.length > 0 && markerSupportsEvidence(support, evidence)
    ? evidence
    : undefined;
}

export function workspaceFooterWhyEvidence(
  model: WorkspaceModel,
): WorkspaceFooterWhyEvidence | undefined {
  const report = workspaceInlinePanelWhyRangeReport(model);
  if (report == null) {
    return undefined;
  }
  const origins = rewriteOrigins(report);
  return {
    headId: report.witness.basisHeadId,
    tickReceiptIds: uniqueIds(origins.map(origin => origin.textTickReceiptId)),
    causalAnchorIds: causalAnchorIds(report),
    coverage: report.witness.result.kind === RESULT_PRODUCED
      ? report.witness.result.coverage.kind
      : COVERAGE_UNAVAILABLE,
  };
}

function rewriteOrigins(report: JeditWhyRangeReport): readonly JeditWhyRangeRewriteOrigin[] {
  return report.witness.result.kind === RESULT_PRODUCED
    ? report.witness.result.fragments
      .map(fragment => fragment.origin)
      .filter(isRewriteOrigin)
    : [];
}

function isRewriteOrigin(origin: JeditWhyRangeOrigin): origin is JeditWhyRangeRewriteOrigin {
  return origin.kind === JeditWhyRangeOriginKinds.Rewrite;
}

function rewriteEvidence(
  report: JeditWhyRangeReport,
  origins: readonly JeditWhyRangeRewriteOrigin[],
): WorkspaceGutterWhyEvidence {
  return {
    headId: report.witness.basisHeadId,
    rewriteIds: uniqueIds(origins.map(origin => origin.rewriteId)),
    diffIds: uniqueIds(origins.map(origin => origin.diffId)),
    tickReceiptIds: uniqueIds(origins.map(origin => origin.textTickReceiptId)),
  };
}

function markerSupportsEvidence(
  support: WorkspaceGutterWhySupport,
  evidence: WorkspaceGutterWhyEvidence,
): boolean {
  return allIdsSupported(evidence.rewriteIds, support.rewriteIds) &&
    allIdsSupported(evidence.diffIds, support.diffIds) &&
    allIdsSupported(evidence.tickReceiptIds, support.tickReceiptIds);
}

function allIdsSupported(ids: readonly string[], support: readonly string[]): boolean {
  const supported = new Set(support);
  return ids.length > 0 && ids.every(id => supported.has(id));
}

function causalAnchorIds(report: JeditWhyRangeReport): readonly string[] {
  return report.witness.result.kind === RESULT_PRODUCED
    ? uniqueIds(report.witness.result.relatedCheckpoints.flatMap(checkpoint => (
      checkpoint.anchorAssociation == null ? [] : [checkpoint.anchorAssociation.causalAnchorId]
    )))
    : [];
}

function uniqueIds(ids: readonly string[]): readonly string[] {
  return [...new Set(ids)];
}
