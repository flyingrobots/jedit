import assert from "node:assert/strict";
import test from "node:test";
import { createNotificationState } from "@flyingrobots/bijou-tui";
import { deferred } from "./workspace-echo-test-utils.mjs";
import {
  fakeProductionTextSession,
  importDist,
  mockDeps,
  mockI18n,
  mockJeditTheme,
  mockKeyBindingContext,
  mockRuntime,
} from "./workspace-helpers.mjs";

const HOST_FINGERPRINT_A = Object.freeze({
  algorithm: "sha256",
  digest: "host-a",
  byteLength: 6,
});

test("TextEditResult refreshes highlighting without reloading saved-file Graft drawer", async () => {
  const [runtimeModule, modeModule, authority, profile, msgModule, results] =
    await Promise.all([
      importDist("app", "workspace", "runtime.js"),
      importDist("app", "workspace", "editor", "mode.js"),
      importDist("app", "workspace", "workspace-text-authority.js"),
      importDist("app", "text-runtime-profile.js"),
      importDist("app", "workspace", "msg.js"),
      importDist("app", "workspace", "workspace-text-results.js"),
    ]);
  let graftLoadCount = 0;
  let highlightCount = 0;
  let highlightInput;
  const model = {
    ...textWorkspaceModel(modeModule, authority, profile, {
      dirty: true,
      mode: modeModule.EditorModes.Insert,
      lines: ["abcd"],
      cursorRow: 0,
      cursorCol: 4,
    }),
    graftDrawerOpen: true,
    graftInfo: {
      path: "/repo/notes.txt",
      relativePath: "notes.txt",
      dirty: false,
      projectionSource: "saved-file",
      projectionPosture: "stale",
      outlineItems: [],
      changeLines: [],
    },
    textRequestId: 10,
    textAuthority: authority.openedWorkspaceTextAuthority({
      profile: profile.TEXT_RUNTIME_PROFILE_ECHO_HOSTED,
      filePath: "/repo/notes.txt",
      bufferId: "buffer:notes",
      readOnly: false,
      dirty: true,
      cache: workspaceReadingCache({ lines: ["abcd"] }),
    }),
  };
  const runtime = runtimeModule.createWorkspaceRuntime(mockRuntime({
    graftSession: {
      loadGraftInfo: async () => {
        graftLoadCount += 1;
        return {
          path: "/repo/notes.txt",
          relativePath: "notes.txt",
          dirty: false,
          outlineItems: [],
          changeLines: [],
        };
      },
      failedGraftInfo: () => ({
        path: "/repo/notes.txt",
        relativePath: "notes.txt",
        dirty: false,
        outlineItems: [],
        changeLines: [],
      }),
      closeConnection: async () => undefined,
    },
    sourceHighlighter: {
      highlight: async (input) => {
        highlightCount += 1;
        highlightInput = input;
        return { path: "/repo/notes.txt", partial: false, spans: [] };
      },
    },
  }));
  const [nextModel, commands] = runtime.update({
    type: msgModule.WorkspaceMessageTypes.TextEditResult,
    requestId: 10,
    result: {
      kind: results.WorkspaceTextResultKinds.Applied,
      filePath: "/repo/notes.txt",
      bufferId: "buffer:notes",
      receiptId: "receipt:edit",
      causalTransition: { admittedTickId: "tick:edit", nextHeadId: "head:edit" },
      cursorAfter: { row: 0, column: 4 },
      cache: workspaceReadingCache({
        readingId: "reading:edit",
        lines: ["abcd"],
      }),
    },
  }, model);

  for (const command of commands) {
    await command();
  }

  assert.equal(nextModel.graftLoading, false);
  assert.equal(graftLoadCount, 0);
  assert.equal(highlightCount, 1);
  assert.equal(highlightInput.text, "abcd");
  assert.equal(highlightInput.headId, "head:edit");
  assert.deepEqual(highlightInput.projection.byteRange, { startByte: 0, endByte: 4 });
  assert.deepEqual(nextModel.textAuthority.lastCausalTransition, {
    admittedTickId: "tick:edit",
    nextHeadId: "head:edit",
  });
});

test("intermediate TextEditResult refreshes highlighting before queued save settles", async () => {
  const [
    keyBindings,
    runtimeModule,
    modeModule,
    authority,
    profile,
    msgModule,
    results,
    sequencer,
  ] = await Promise.all([
    importDist("app", "workspace", "key-bindings.js"),
    importDist("app", "workspace", "runtime.js"),
    importDist("app", "workspace", "editor", "mode.js"),
    importDist("app", "workspace", "workspace-text-authority.js"),
    importDist("app", "text-runtime-profile.js"),
    importDist("app", "workspace", "msg.js"),
    importDist("app", "workspace", "workspace-text-results.js"),
    importDist("app", "workspace", "workspace-text-operation-sequencer.js"),
  ]);
  const pendingEdit = deferred();
  const textOperationSequencer = sequencer.createWorkspaceTextOperationSequencer();
  const exportCalls = [];
  const savedFiles = [];
  let highlightCount = 0;
  const productionTextSession = fakeProductionTextSession({
    exportSnapshot: async (request) => {
      exportCalls.push(request);
      return {
        kind: "exported",
        text: "abcd",
        readingId: "reading:export",
      };
    },
    checkpointBuffer: async () => ({
      kind: "checkpointed",
      result: { checkpointId: "checkpoint:save" },
    }),
  });
  const model = {
    ...textWorkspaceModel(modeModule, authority, profile, {
      dirty: true,
      mode: modeModule.EditorModes.Insert,
      lines: ["abcd"],
      cursorRow: 0,
      cursorCol: 4,
    }),
    textRequestId: 10,
    textAuthority: authority.openedWorkspaceTextAuthority({
      profile: profile.TEXT_RUNTIME_PROFILE_ECHO_HOSTED,
      filePath: "/repo/notes.txt",
      bufferId: "buffer:notes",
      readOnly: false,
      dirty: true,
      hostFingerprint: HOST_FINGERPRINT_A,
      pendingClientSeq: 10,
      pendingIntentStatus: authority.WorkspaceTextIntentStatuses.Predicted,
      cache: workspaceReadingCache({ lines: ["abcd"] }),
    }),
  };
  const target = { filePath: "/repo/notes.txt", bufferId: "buffer:notes" };
  const queuedEdit = textOperationSequencer.sequenceEdit(
    productionTextSession,
    target,
    async () => {
      await pendingEdit.promise;
      return {
        kind: results.WorkspaceTextResultKinds.Applied,
        result: { receiptId: "receipt:edit" },
      };
    },
  );
  const context = {
    ...mockKeyBindingContext(),
    nowMs: () => 99,
    deps: mockDeps({
      editorFile: {
        loadEditorFile: () => ({
          lines: ["abcd"],
          readOnly: false,
          fingerprint: HOST_FINGERPRINT_A,
        }),
        saveEditorFile: (filePath, lines) => {
          savedFiles.push({ filePath, lines });
        },
      },
      productionTextSession,
      textOperationSequencer,
    }),
  };
  const runtime = runtimeModule.createWorkspaceRuntime(mockRuntime({
    productionTextSession,
    sourceHighlighter: {
      highlight: async () => {
        highlightCount += 1;
        return { path: "/repo/notes.txt", partial: false, spans: [] };
      },
    },
    textOperationSequencer,
  }));
  const [pendingSaveModel, saveCommands] = keyBindings.updateFromKey(
    { key: "s", ctrl: true, alt: false, shift: false },
    model,
    context,
  );
  assert.equal(saveCommands.length, 1);
  const saveMessage = saveCommands[0]();
  assert.equal(exportCalls.length, 0, "save export must wait behind the queued edit");
  const [nextModel, commands] = runtime.update({
    type: msgModule.WorkspaceMessageTypes.TextEditResult,
    requestId: 10,
    result: {
      kind: results.WorkspaceTextResultKinds.Applied,
      filePath: "/repo/notes.txt",
      bufferId: "buffer:notes",
      receiptId: "receipt:edit",
      cache: workspaceReadingCache({
        readingId: "reading:edit",
        lines: ["abcd"],
      }),
    },
  }, pendingSaveModel);

  for (const command of commands) {
    await command();
  }

  assert.equal(nextModel.textAuthority.pendingIntentStatus, authority.WorkspaceTextIntentStatuses.Admitted);
  assert.equal(highlightCount, 1);
  assert.equal(exportCalls.length, 0, "intermediate refresh should happen before save export starts");

  pendingEdit.resolve();
  await queuedEdit;
  const [exportedModel, checkpointCommands] = runtime.update(await saveMessage, nextModel);
  await Promise.all(checkpointCommands.map((command) => command()));

  assert.equal(exportCalls.length, 1);
  assert.deepEqual(savedFiles, [{ filePath: "/repo/notes.txt", lines: ["abcd"] }]);
  assert.equal(exportedModel.textAuthority.lastExportReadingId, "reading:export");
});

function textWorkspaceModel(modeModule, authority, profile, editorOverrides) {
  return {
    editor: {
      path: "/repo/notes.txt",
      lines: ["abc"],
      cursorRow: 0,
      cursorCol: 0,
      scrollRow: 0,
      scrollCol: 0,
      dirty: false,
      readOnly: false,
      mode: modeModule.EditorModes.Normal,
      undoStack: [],
      redoStack: [],
      ...editorOverrides,
    },
    textAuthority: authority.openedWorkspaceTextAuthority({
      profile: profile.TEXT_RUNTIME_PROFILE_ECHO_HOSTED,
      filePath: "/repo/notes.txt",
      bufferId: "buffer:notes",
      readOnly: false,
      dirty: false,
      cache: workspaceReadingCache({
        bufferId: "buffer:notes",
        readingId: "reading:initial",
        lines: ["abc"],
      }),
    }),
    textRuntimeProfile: profile.TEXT_RUNTIME_PROFILE_ECHO_HOSTED,
    textRequestId: 0,
    time: 12,
    focusPane: "editor",
    fileDrawerOpen: false,
    graftDrawerOpen: false,
    historyDrawerOpen: false,
    historyDrawerProgress: 0,
    echoHistory: [],
    echoHistorySelectedIndex: 0,
    graftInfo: undefined,
    graftLoading: false,
    graftRequestId: 0,
    graftSelectedIndex: 0,
    sourceHighlight: undefined,
    sourceHighlightLoading: false,
    sourceHighlightRequestId: 0,
    columns: 80,
    rows: 24,
    viewMode: "source",
    notifications: createNotificationState(),
    notificationLoopActive: false,
    workspaceRoot: "/repo",
    cwd: "/repo",
    entries: [],
    selectedIndex: 0,
    i18n: mockI18n(),
    jeditTheme: mockJeditTheme(),
  };
}

function workspaceReadingCache(overrides = {}) {
  const lines = overrides.lines ?? ["abc"];
  const startLine = overrides.startLine ?? 0;
  const returnedLineCount = overrides.returnedLineCount ?? lines.length;
  const totalLineCount = overrides.totalLineCount ?? lines.length;
  const truncated = overrides.truncated ?? false;
  const hasMoreBefore = overrides.hasMoreBefore ?? startLine > 0;
  const hasMoreAfter = overrides.hasMoreAfter ?? startLine + returnedLineCount < totalLineCount;
  const coverage = overrides.coverage
    ?? (
      startLine === 0 &&
      hasMoreBefore !== true &&
      hasMoreAfter !== true &&
      truncated !== true &&
      returnedLineCount === totalLineCount
        ? "full"
        : "window"
    );
  return {
    bufferId: "buffer:notes",
    readingId: "reading:test",
    projection: {
      basisHeadId: "head:edit",
      byteRange: { startByte: 0, endByte: Buffer.byteLength(lines.join("\n"), "utf8") },
      text: lines.join("\n"),
      support: [],
    },
    lines,
    coverage,
    lineCount: totalLineCount,
    startLine,
    returnedLineCount,
    totalLineCount,
    hasMoreBefore,
    hasMoreAfter,
    cursorLine: startLine,
    viewportLineCount: 24,
    truncated,
    ...overrides,
  };
}
