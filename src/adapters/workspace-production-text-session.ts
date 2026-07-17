import { makeByteOffset } from '../domain/graph-rope-coordinates.js';
import type { ByteOffset, TextByteRange } from '../domain/graph-rope-types.js';
import {
  createProductionTextObstruction,
  ProductionTextObstructionCodes,
  ProductionTextSessionOutcomeKinds,
  type ProductionTextDeleteRequest,
  type ProductionTextCheckpointRequest,
  type ProductionTextCausalLineDiffRequest,
  type ProductionTextExportRequest,
  type ProductionTextInsertRequest,
  type ProductionTextMultiRangeRequest,
  type ProductionTextOpenRequest,
  type ProductionTextObstructionCode,
  type ProductionTextReplaceRequest,
  type ProductionTextSession,
  type ProductionTextWindowRequest,
  type ProductionTextWhyRangeRequest,
} from '../app/workspace/production-text-session.js';
import {
  JEDIT_TEXT_WINDOW_MATERIALIZATION_COMPLETENESS_COMPLETE,
  JEDIT_TEXT_WINDOW_MATERIALIZATION_SCHEMA_VERSION,
  JEDIT_TEXT_WINDOW_MATERIALIZER_VERSION,
  type JeditTextWindowMaterializationProvenance,
} from '../ports/jedit-text-window-materialization.js';
import {
  EchoTextHostOutcomeKinds,
  type EchoTextContractHostPort,
  type EchoTextHostApplied,
  type EchoTextHostObserved,
} from '../ports/echo-text-contract-host.js';

const UNSUPPORTED_CORRIDOR_MESSAGE =
  'The current generated Wesley compatibility corridor does not implement this operation. Edict migration will add it explicitly.';

export function createWorkspaceProductionTextSession(
  host: EchoTextContractHostPort,
): ProductionTextSession {
  return Object.freeze({
    openBuffer: (request: ProductionTextOpenRequest) => openBuffer(host, request),
    insertText: (request: ProductionTextInsertRequest) => insertText(host, request),
    replaceRange: (request: ProductionTextReplaceRequest) => applyEdit(host, request),
    deleteRange: (request: ProductionTextDeleteRequest) => deleteRange(host, request),
    multiRangeEdit: (request: ProductionTextMultiRangeRequest) => unsupportedOperation(ProductionTextObstructionCodes.Edit, request),
    checkpointBuffer: (request: ProductionTextCheckpointRequest) => unsupportedOperation(ProductionTextObstructionCodes.Checkpoint, request),
    observeWindow: (request: ProductionTextWindowRequest) => observeWindow(host, request),
    observeCausalLineDiff: (request: ProductionTextCausalLineDiffRequest) => unsupportedOperation(ProductionTextObstructionCodes.Query, request),
    exportSnapshot: (request: ProductionTextExportRequest) => unsupportedOperation(ProductionTextObstructionCodes.Export, request),
    explainRange: (request: ProductionTextWhyRangeRequest) => unsupportedOperation(ProductionTextObstructionCodes.WhyRange, request),
  });
}

interface TimedRequest {
  readonly atMs: number;
}

function insertText(host: EchoTextContractHostPort, request: ProductionTextInsertRequest) {
  return applyEdit(host, {
    bufferId: request.bufferId,
    startByte: request.startByte,
    endByte: request.startByte,
    insertText: request.insertText,
    atMs: request.atMs,
  });
}

function deleteRange(host: EchoTextContractHostPort, request: ProductionTextDeleteRequest) {
  return applyEdit(host, {
    ...request,
    insertText: '',
  });
}

async function openBuffer(host: EchoTextContractHostPort, request: ProductionTextOpenRequest) {
  const outcome = await host.openBuffer({
    bufferKey: request.bufferKey,
    initialText: request.initialText,
    projectionPath: request.projectionPath ?? null,
  });
  if (outcome.kind === EchoTextHostOutcomeKinds.Obstructed) {
    return createProductionTextObstruction(
      ProductionTextObstructionCodes.Open,
      request.atMs,
      outcome.message,
    );
  }
  return {
    kind: ProductionTextSessionOutcomeKinds.Opened,
    bufferId: outcome.bufferId,
    textBasis: fullTextBasis(outcome.headId, outcome.byteLength),
  };
}

async function observeWindow(host: EchoTextContractHostPort, request: ProductionTextWindowRequest) {
  const startByte = request.byteRange.startByte.value;
  const endByte = Math.min(
    request.byteRange.endByte.value,
    startByte + request.aperture.maxBytes,
  );
  const outcome = await host.observeWindow({
    bufferId: request.bufferId,
    basisHeadId: request.basisHeadId,
    startByte,
    endByte,
    maxBytes: request.aperture.maxBytes,
  });
  if (outcome.kind === EchoTextHostOutcomeKinds.Obstructed) {
    return createProductionTextObstruction(
      ProductionTextObstructionCodes.Query,
      request.atMs,
      outcome.message,
    );
  }
  return observedWindow(outcome, request);
}

function unsupportedOperation(code: ProductionTextObstructionCode, request: TimedRequest) {
  return Promise.resolve(createProductionTextObstruction(
    code,
    request.atMs,
    UNSUPPORTED_CORRIDOR_MESSAGE,
  ));
}

interface EditBoundaryRequest {
  readonly bufferId: string;
  readonly startByte: ByteOffset;
  readonly endByte: ByteOffset;
  readonly insertText: string;
  readonly atMs: number;
}

async function applyEdit(host: EchoTextContractHostPort, request: EditBoundaryRequest) {
  const outcome = await host.replaceRange({
    bufferId: request.bufferId,
    startByte: request.startByte.value,
    endByte: request.endByte.value,
    insertText: request.insertText,
  });
  if (outcome.kind === EchoTextHostOutcomeKinds.Obstructed) {
    return createProductionTextObstruction(
      ProductionTextObstructionCodes.Edit,
      request.atMs,
      outcome.message,
    );
  }
  return appliedEdit(outcome);
}

function appliedEdit(outcome: EchoTextHostApplied) {
  return {
    kind: ProductionTextSessionOutcomeKinds.Applied,
    result: {
      buffer: {
        bufferId: outcome.bufferId,
        bufferKey: outcome.bufferKey,
        projectionPath: outcome.projectionPath,
        createdAt: `echo-buffer:${outcome.bufferId}`,
      },
      textBasis: fullTextBasis(outcome.headId, outcome.byteLength),
      bufferVersion: outcome.bufferVersion,
      receiptId: outcome.receiptId,
      causalTransition: {
        admittedTickId: outcome.admittedTickId,
        nextHeadId: outcome.headId,
      },
    },
  } as const;
}

function observedWindow(outcome: EchoTextHostObserved, request: ProductionTextWindowRequest) {
  const byteRange = textByteRange(outcome.startByte, outcome.endByte);
  return {
    kind: ProductionTextSessionOutcomeKinds.Observed,
    observed: {
      value: observedWindowValue(outcome, request, byteRange),
      evidence: {
        readingId: outcome.readingId,
      },
    },
  } as const;
}

function windowProjection(outcome: EchoTextHostObserved) {
  return {
    basisHeadId: outcome.basisHeadId,
    basis: {
      worldlineId: outcome.worldlineId,
      headId: outcome.basisHeadId,
      rootNodeId: outcome.rootNodeId ?? '',
      byteLength: outcome.byteLength,
      lineCount: outcome.lineCount,
    },
    byteRange: {
      startByte: outcome.startByte,
      endByte: outcome.endByte,
    },
    text: outcome.text,
    support: outcome.support.map((support) => ({
      leafId: support.leafId,
      blobId: support.blobId,
      contentHash: support.contentHash,
      byteRange: {
        startByte: support.startByte,
        endByte: support.endByte,
      },
    })),
  };
}

function windowMaterialization(
  outcome: EchoTextHostObserved,
  byteRange: TextByteRange,
): JeditTextWindowMaterializationProvenance {
  return {
    key: {
      schemaVersion: JEDIT_TEXT_WINDOW_MATERIALIZATION_SCHEMA_VERSION,
      materializerVersion: JEDIT_TEXT_WINDOW_MATERIALIZER_VERSION,
      basis: {
        worldlineId: outcome.worldlineId,
        headId: outcome.basisHeadId,
        requestFrontierRef: `${outcome.worldlineId}:${outcome.resolvedWorldlineTick}`,
      },
      coverage: byteRange,
      observerPlanId: outcome.observerPlanId,
      policyDigest: outcome.packageArtifactHash,
      coordinateDigest: outcome.commitHash,
      cacheKeyDigest: outcome.readingId,
    },
    completeness: JEDIT_TEXT_WINDOW_MATERIALIZATION_COMPLETENESS_COMPLETE,
    materializedProjectionBytes: new TextEncoder().encode(outcome.text).length,
  };
}

function observedWindowValue(
  outcome: EchoTextHostObserved,
  request: ProductionTextWindowRequest,
  byteRange: TextByteRange,
) {
  const startLine = outcome.lines[0]?.lineNumber ?? request.aperture.cursorLine;
  return {
    readingId: outcome.readingId,
    textBasis: {
      basisHeadId: outcome.basisHeadId,
      byteRange,
    },
    projection: windowProjection(outcome),
    materialization: windowMaterialization(outcome, byteRange),
    lines: outcome.lines,
    byteLength: outcome.endByte - outcome.startByte,
    lineCount: outcome.lines.length,
    startLine,
    totalLineCount: outcome.lineCount,
    hasMoreBefore: outcome.startByte > 0,
    hasMoreAfter: outcome.endByte < outcome.byteLength,
    cursorLine: request.aperture.cursorLine,
    viewportLineCount: request.aperture.viewportLineCount,
    truncated: outcome.startByte > request.byteRange.startByte.value
      || outcome.endByte < request.byteRange.endByte.value,
  };
}

function fullTextBasis(headId: string, byteLength: number) {
  return {
    basisHeadId: headId,
    byteRange: textByteRange(0, byteLength),
  };
}

function textByteRange(startByte: number, endByte: number): TextByteRange {
  return {
    startByte: requiredByteOffset(startByte),
    endByte: requiredByteOffset(endByte),
  };
}

function requiredByteOffset(value: number): ByteOffset {
  const result = makeByteOffset(value);
  if (!result.ok) {
    throw new InvalidEchoTextEvidenceError(value);
  }
  return result.value;
}

class InvalidEchoTextEvidenceError extends Error {
  public constructor(value: number) {
    super(`Echo returned an invalid UTF-8 byte offset: ${value}`);
    this.name = 'InvalidEchoTextEvidenceError';
  }
}
