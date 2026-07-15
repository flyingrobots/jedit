#!/usr/bin/env node
const REPORT_FORMAT_JSON = '--json';
const OPTION_OBSTRUCT = '--obstruct';
const WITNESS_BUFFER_ID = 'buffer:witness';
const WITNESS_BUFFER_KEY = 'witness.md';
const WITNESS_INITIAL_TEXT = 'initial witness text';
const WITNESS_INSERT_TEXT = 'edited ';
const WITNESS_READING_OPEN = 'reading:witness-open';
const WITNESS_READING_EDIT = 'reading:witness-edit';
const WITNESS_READING_EXPORT = 'reading:witness-export';
const WITNESS_RECEIPT = 'receipt:witness-edit';
const WITNESS_CHECKPOINT = 'checkpoint:witness';
const WITNESS_HEAD = 'head:witness-edit';

const options = parseArgs(process.argv.slice(2));
const report = await workspaceWitnessReport(options);

if (options.json) {
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
} else {
  process.stdout.write(`${report.capability}: ${report.outcome}\n`);
}

function parseArgs(args) {
  const parsed = {
    json: false,
    obstruct: false,
  };
  for (const arg of args) {
    if (arg === REPORT_FORMAT_JSON) {
      parsed.json = true;
    } else if (arg === OPTION_OBSTRUCT) {
      parsed.obstruct = true;
    } else {
      process.stderr.write(`unknown argument: ${arg}\n`);
      process.exit(1);
    }
  }
  return parsed;
}

async function workspaceWitnessReport(options) {
  const { createProductionTextSession } = await import('../dist/app/workspace/production-text-session.js');
  const productionTextSession = createProductionTextSession(createWitnessTextBufferSession(options));
  const opened = await productionTextSession.openBuffer({
    bufferKey: WITNESS_BUFFER_KEY,
    initialText: WITNESS_INITIAL_TEXT,
    projectionPath: WITNESS_BUFFER_KEY,
    atMs: 1,
  });
  if (opened.kind === 'obstructed') {
    return obstructedReport('open', opened.obstruction.issue.message);
  }
  const edit = await productionTextSession.insertText({
    bufferId: opened.optic.buffer.bufferId,
    startByte: 0,
    insertText: WITNESS_INSERT_TEXT,
    atMs: 2,
  });
  if (edit.kind === 'obstructed') {
    return obstructedReport('edit', edit.obstruction.issue.message);
  }
  const read = await productionTextSession.observeWindow({
    bufferId: opened.optic.buffer.bufferId,
    aperture: witnessAperture(),
    atMs: 3,
  });
  if (read.kind === 'obstructed') {
    return obstructedReport('read', read.obstruction.issue.message);
  }
  const exported = await productionTextSession.exportSnapshot({
    bufferId: opened.optic.buffer.bufferId,
    atMs: 4,
  });
  if (exported.kind === 'obstructed') {
    return obstructedReport('export', exported.obstruction.issue.message);
  }
  const checkpoint = await productionTextSession.checkpointBuffer({
    bufferId: opened.optic.buffer.bufferId,
    basisHeadId: exported.basisHeadId,
    label: 'workspace witness',
    atMs: 5,
  });
  if (checkpoint.kind === 'obstructed') {
    return obstructedReport('checkpoint', checkpoint.obstruction.issue.message);
  }
  return {
    capability: 'jedit.workspace.echo-witness',
    outcome: 'applied',
    lifecycleAuthorityExposed: false,
    operations: ['open', 'edit', 'read', 'export', 'checkpoint'],
    open: {
      bufferId: opened.optic.buffer.bufferId,
      readingId: WITNESS_READING_OPEN,
    },
    edit: {
      receiptId: edit.result.receiptId,
      readingId: read.observed.evidence.readingId,
    },
    export: {
      readingId: exported.readingId,
    },
    checkpoint: {
      checkpointId: checkpoint.result.checkpointId,
    },
  };
}

function createWitnessTextBufferSession(options) {
  const optic = createWitnessOptic();
  return {
    sessionId: 'session:witness',
    async createBuffer() {
      if (options.obstruct) {
        throw new Error('workspace witness open obstruction');
      }
      return optic;
    },
    async getBufferOptic(bufferId) {
      return bufferId === WITNESS_BUFFER_ID ? optic : null;
    },
    async listBuffers() {
      return [optic.buffer];
    },
  };
}

function createWitnessOptic() {
  let text = WITNESS_INITIAL_TEXT;
  let readingId = WITNESS_READING_OPEN;
  const buffer = {
    bufferId: WITNESS_BUFFER_ID,
    bufferKey: WITNESS_BUFFER_KEY,
    projectionPath: WITNESS_BUFFER_KEY,
    createdAt: '2026-05-24T00:00:00.000Z',
  };
  return {
    buffer,
    currentReadBasis() {
      return { kind: 'read-basis-handle', id: `basis:${readingId}` };
    },
    async applyIntent(intent) {
      text = `${text.slice(0, intent.startByte)}${intent.insertText}${text.slice(intent.endByte)}`;
      readingId = WITNESS_READING_EDIT;
      return {
        buffer,
        readBasis: this.currentReadBasis(),
        bufferVersion: 2,
        receiptId: WITNESS_RECEIPT,
      };
    },
    async createCheckpoint() {
      return {
        buffer,
        readBasis: this.currentReadBasis(),
        bufferVersion: 2,
        checkpointId: WITNESS_CHECKPOINT,
        checkpointKind: 'MANUAL_SAVE',
      };
    },
    async textWindow() {
      const exportRead = readingId === WITNESS_READING_EDIT ? WITNESS_READING_EXPORT : readingId;
      readingId = exportRead;
      const byteLength = Buffer.byteLength(text, 'utf8');
      return {
        value: {
          readingId: exportRead,
          projection: {
            basisHeadId: WITNESS_HEAD,
            byteRange: { startByte: 0, endByte: byteLength },
            text,
            support: [],
          },
          lines: [{
            lineNumber: 0,
            startByte: 0,
            endByte: byteLength,
            text,
          }],
          byteLength,
          lineCount: 1,
          startLine: 0,
          totalLineCount: 1,
          hasMoreBefore: false,
          hasMoreAfter: false,
          cursorLine: 0,
          viewportLineCount: 24,
          truncated: false,
        },
        evidence: {
          readingId: exportRead,
          receiptId: WITNESS_RECEIPT,
        },
      };
    },
  };
}

function witnessAperture() {
  return {
    cursorLine: 0,
    viewportLineCount: 24,
    beforeLines: 0,
    afterLines: 0,
    maxBytes: 1048576,
  };
}

function obstructedReport(stage, message) {
  return {
    capability: 'jedit.workspace.echo-witness',
    outcome: 'obstructed',
    lifecycleAuthorityExposed: false,
    operations: ['open', 'edit', 'read', 'export', 'checkpoint'],
    obstruction: {
      stage,
      message,
    },
  };
}
