import assert from 'node:assert/strict';
import { createI18nMock } from './i18n-mock.mjs';
import {
  basisPinnedTestTextSession,
  importDist,
  mockJeditTheme,
  mockRuntime,
  surfaceText,
} from './workspace-helpers.mjs';

const DEFAULT_NOW_MS = 42;
const DEFAULT_COLUMNS = 100;
const DEFAULT_ROWS = 24;

export async function createWorkspaceEchoAppHarness(options = {}) {
  const [runtimeModule, fileSystem, focus, profile, viewerContent, themes, viewer] = await Promise.all([
    importDist('app', 'workspace', 'runtime.js'),
    importDist('ports', 'file-system.js'),
    importDist('ui', 'panel-focus.js'),
    importDist('app', 'text-runtime-profile.js'),
    importDist('app', 'workspace', 'viewer-content.js'),
    importDist('ui', 'jedit-themes.js'),
    importDist('app', 'workspace', 'viewer.js'),
  ]);
  const savedFiles = [];
  const calls = {
    open: [],
    insert: [],
    replace: [],
    delete: [],
    observe: [],
    export: [],
    checkpoint: [],
    lifecycle: [],
  };
  const productionTextSession = basisPinnedTestTextSession(
    options.productionTextSession ?? recordingProductionTextSession(calls, options),
  );
  const runtime = runtimeModule.createWorkspaceRuntime(mockRuntime({
    initialColumns: options.columns ?? DEFAULT_COLUMNS,
    initialRows: options.rows ?? DEFAULT_ROWS,
    initialModel: {
      titleSceneSeed: 0.5,
      jeditTheme: themes.resolveInitialJeditTheme(undefined),
      i18n: options.i18n ?? createI18nMock(),
      entries: options.entries ?? [{
        kind: fileSystem.FileEntryKinds.File,
        name: options.fileName ?? 'notes.md',
        path: options.filePath ?? '/repo/notes.md',
      }],
      nowMs: options.nowMs ?? DEFAULT_NOW_MS,
      textRuntimeProfile: profile.TEXT_RUNTIME_PROFILE_ECHO_HOSTED,
    },
    editorFile: {
      loadEditorFile: (filePath) => editorFileLoadResult(filePath, options),
      saveEditorFile: (filePath, lines) => {
        savedFiles.push({ filePath, lines });
      },
    },
    sourceHighlighter: options.sourceHighlighter ?? {
      highlight: async () => ({ path: '', partial: false, spans: [] }),
    },
    productionTextSession,
    nowMs: () => options.nowMs ?? DEFAULT_NOW_MS,
  }));
  const [initialModel] = runtime.init();
  let model = {
    ...initialModel,
    fileDrawerOpen: true,
    focusPane: focus.FocusPanes.Files,
  };

  return {
    calls,
    savedFiles,
    productionTextSession,
    runtime,
    get model() {
      return model;
    },
    setModel(nextModel) {
      model = nextModel;
    },
    async key(key, modifiers = {}) {
      const [nextModel, commands] = runtime.update(keyMsg(runtimeModule, key, modifiers), model);
      model = nextModel;
      return commands;
    },
    async run(command) {
      const message = await command();
      const [nextModel, commands] = runtime.update(message, model);
      model = nextModel;
      return { message, commands };
    },
    async runAll(commands) {
      const results = [];
      let pending = [...commands];
      while (pending.length > 0) {
        const result = await this.run(pending[0]);
        results.push(result);
        pending = [...pending.slice(1), ...result.commands];
      }
      return results;
    },
    async runFirst(commands) {
      assert.ok(commands[0], 'expected command');
      return this.run(commands[0]);
    },
    renderText() {
      return surfaceText(viewerContent.renderViewer(model, options.columns ?? DEFAULT_COLUMNS, options.rows ?? DEFAULT_ROWS));
    },
    renderWorkspaceText() {
      return surfaceText(viewer.renderWorkspace(model));
    },
  };
}

function editorFileLoadResult(filePath, options) {
  if (options.missingPaths?.has(filePath)) {
    return {
      kind: 'missing',
      filePath,
    };
  }
  return {
    lines: options.hostLinesByPath?.get(filePath) ?? options.hostLines ?? ['host import'],
    readOnly: false,
  };
}

function keyMsg(runtimeModule, key, modifiers) {
  return {
    type: runtimeModule.WorkspaceInputMessageTypes.Key,
    key,
    ctrl: modifiers.ctrl === true,
    alt: modifiers.alt === true,
    shift: modifiers.shift === true,
  };
}

function recordingProductionTextSession(calls, options) {
  const readings = options.readings ?? ['Echo opened text', 'Echo edited text'];
  return {
    openBuffer: async (request) => {
      calls.open.push(request);
      const textBasis = textBasisFor('head:opened', currentReading(readings, 1));
      return options.openObstruction ?? {
        kind: 'opened',
        bufferId: options.bufferIdByKey?.get(request.bufferKey) ?? options.bufferId ?? 'buffer:notes',
        textBasis,
      };
    },
    insertText: async (request) => {
      calls.insert.push(request);
      return options.editObstruction ?? {
        kind: 'applied',
        result: {
          receiptId: editReceiptId(options, 'insert', calls.insert.length),
          textBasis: nextTextBasis(readings, calls.observe.length, 'insert', calls.insert.length),
        },
      };
    },
    replaceRange: async (request) => {
      calls.replace.push(request);
      return options.editObstruction ?? {
        kind: 'applied',
        result: {
          receiptId: editReceiptId(options, 'replace', calls.replace.length),
          textBasis: nextTextBasis(readings, calls.observe.length, 'replace', calls.replace.length),
        },
      };
    },
    deleteRange: async (request) => {
      calls.delete.push(request);
      return options.editObstruction ?? {
        kind: 'applied',
        result: {
          receiptId: editReceiptId(options, 'delete', calls.delete.length),
          textBasis: nextTextBasis(readings, calls.observe.length, 'delete', calls.delete.length),
        },
      };
    },
    multiRangeEdit: async () => options.multiRangeObstruction ?? productionTextObstruction('multi-range unsupported'),
    checkpointBuffer: async (request) => {
      calls.checkpoint.push(request);
      return options.checkpointObstruction ?? {
        kind: 'checkpointed',
        result: {
          checkpointId: 'checkpoint:save',
          textBasis: textBasisFor(
            request.basisHeadId ?? 'head:checkpoint',
            currentReading(readings, calls.observe.length),
          ),
        },
      };
    },
    observeWindow: async (request) => {
      calls.observe.push(request);
      const text = currentReading(readings, calls.observe.length);
      const textBasis = {
        basisHeadId: request.basisHeadId,
        byteRange: request.byteRange,
      };
      return options.readObstruction ?? {
        kind: 'observed',
        observed: {
          value: {
            readingId: `reading:${calls.observe.length}`,
            textBasis,
            projection: {
              basisHeadId: textBasis.basisHeadId,
              byteRange: {
                startByte: textBasis.byteRange.startByte.value,
                endByte: textBasis.byteRange.endByte.value,
              },
              text,
              support: [],
            },
            lines: [{
              lineNumber: 0,
              startByte: 0,
              endByte: Buffer.byteLength(text, 'utf8'),
              text,
            }],
            startLine: 0,
            lineCount: 1,
            totalLineCount: 1,
            hasMoreBefore: false,
            hasMoreAfter: false,
            cursorLine: 0,
            viewportLineCount: 24,
            truncated: false,
          },
        },
      };
    },
    exportSnapshot: async (request) => {
      calls.export.push(request);
      return options.exportObstruction ?? {
        kind: 'exported',
        text: options.exportText ?? 'Echo exported text',
        readingId: 'reading:export',
        basisHeadId: options.exportBasisHeadId ?? 'head:export',
      };
    },
  };
}

function currentReading(readings, observationCount) {
  return readings[Math.min(observationCount - 1, readings.length - 1)] ?? '';
}

function editReceiptId(options, kind, callCount) {
  return options.editReceiptIds?.[kind]?.[callCount - 1] ?? `receipt:${kind}`;
}

function nextTextBasis(readings, observationCount, kind, callCount) {
  return textBasisFor(
    `head:${kind}:${callCount}`,
    currentReading(readings, observationCount + 1),
  );
}

function textBasisFor(basisHeadId, text) {
  return {
    basisHeadId,
    byteRange: {
      startByte: { kind: 'utf8-byte-offset', value: 0 },
      endByte: { kind: 'utf8-byte-offset', value: Buffer.byteLength(text, 'utf8') },
    },
  };
}

export function productionTextObstruction(message) {
  return {
    kind: 'obstructed',
    obstruction: {
      code: 'text-buffer-edit-obstructed',
      issue: {
        name: 'WorkspaceEchoHarnessObstruction',
        title: 'workspace Echo harness obstruction',
        message,
        level: 'error',
        source: 'command',
        atMs: DEFAULT_NOW_MS,
      },
    },
  };
}
