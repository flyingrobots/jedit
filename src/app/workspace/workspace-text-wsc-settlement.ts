import { createHash } from 'node:crypto';
import type { JeditWscWorkspaceEnvelope } from '../../ports/jedit-wsc-workspace-store.js';
import type { WorkspaceTextEditCommandRequest } from './workspace-text-commands.js';
import type { WorkspaceTextReadingCache } from './workspace-text-reading-cache.js';

export const WSC_EDIT_SETTLEMENT_SCHEMA_VERSION = 'jedit.workspace_text_edit_settlement.v1';
export const UTF8_ENCODING = 'utf8';
const SHA256_ALGORITHM = 'sha256';
const HEX_DIGEST_ENCODING = 'hex';
const EMPTY_INSERT_TEXT = '';

export function createWorkspaceTextEditSettlementEnvelope(
  request: WorkspaceTextEditCommandRequest,
  receiptId: string,
  cache: WorkspaceTextReadingCache,
): JeditWscWorkspaceEnvelope {
  const bytes = Buffer.from(JSON.stringify(settlementPayload(request, receiptId, cache)), UTF8_ENCODING);
  return {
    envelopeId: createHash(SHA256_ALGORITHM).update(bytes).digest(HEX_DIGEST_ENCODING),
    bytes,
  };
}

function settlementPayload(
  request: WorkspaceTextEditCommandRequest,
  receiptId: string,
  cache: WorkspaceTextReadingCache,
) {
  return {
    schemaVersion: WSC_EDIT_SETTLEMENT_SCHEMA_VERSION,
    filePath: request.filePath,
    bufferId: request.bufferId,
    commandKind: request.kind,
    range: editRangePayload(request),
    submittedAtMs: request.atMs,
    receiptId,
    reading: {
      readingId: cache.readingId,
      lines: cache.lines,
      coverage: cache.coverage,
      lineCount: cache.lineCount,
      startLine: cache.startLine,
      returnedLineCount: cache.returnedLineCount,
      totalLineCount: cache.totalLineCount,
      hasMoreBefore: cache.hasMoreBefore,
      hasMoreAfter: cache.hasMoreAfter,
      cursorLine: cache.cursorLine,
      viewportLineCount: cache.viewportLineCount,
      truncated: cache.truncated,
    },
    aperture: request.aperture,
  };
}

function editRangePayload(request: WorkspaceTextEditCommandRequest) {
  if ('insertText' in request && 'endByte' in request) {
    return {
      startByte: request.startByte,
      endByte: request.endByte,
      insertText: request.insertText,
    };
  }
  if ('insertText' in request) {
    return {
      startByte: request.startByte,
      endByte: request.startByte,
      insertText: request.insertText,
    };
  }
  return {
    startByte: request.startByte,
    endByte: request.endByte,
    insertText: EMPTY_INSERT_TEXT,
  };
}
