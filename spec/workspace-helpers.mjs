import path from "node:path";
import { createNotificationState } from "@flyingrobots/bijou-tui";
import { REPO_ROOT, ensureDistBuilt, importDist } from "./dist-helpers.mjs";

const MOCK_I18N_TRANSLATIONS = Object.freeze({
  "footer.command.details.edit": "Open a file",
  "footer.command.details.write": "Write the current file",
  "footer.command.details.quit": "Quit jedit",
  "footer.command.details.wq": "Write and quit",
  "footer.command.details.ttd": "Observe a causal tick without moving canonical head",
  "footer.command.details.strand": "Create, switch, or list copy-on-write strands",
  "footer.command.details.braid": "View, preview, or admit braid candidates",
  "footer.command.details.why": "Explain the last meaningful command",
  "footer.command.details.help": "Show command help",
  "footer.command.hints.tab_accept": "tab accept",
  "footer.command.hints.enter_run": "enter run",
  "footer.command.hints.esc_cancel": "esc cancel",
  "startupFileModal.title": "Open file",
  "startupFileModal.current_directory": "Current directory",
  "startupFileModal.empty": "No files in this directory",
  "settings.sections.appearance": "Appearance",
  "settings.sections.editor": "Editor",
  "settings.sections.runtime": "Runtime",
  "settings.rows.theme.label": "Theme",
  "settings.rows.theme.description": "Switch between installed data-driven themes.",
  "settings.rows.theme_mode.label": "Light/dark",
  "settings.rows.theme_mode.description": "Switch the current theme to its light or dark companion.",
  "settings.rows.footer.label": "Footer",
  "settings.rows.footer.description": "Show mode, focus, and command hints at the bottom edge.",
  "settings.rows.line_numbers.label": "Line numbers",
  "settings.rows.line_numbers.description": "Switch between absolute and cursor-relative editor line numbers.",
  "settings.rows.causal_gutter_basis.label": "Causal markers",
  "settings.rows.causal_gutter_basis.description": "Choose the causal basis used by gutter change markers.",
  "settings.rows.markdown_preview.label": "Markdown preview",
  "settings.rows.markdown_preview.description": "Switch the active Markdown buffer between source and preview.",
  "settings.rows.diagnostics.label": "Diagnostics",
  "settings.rows.diagnostics.description": "Inspect Graft, parser, and Colorful runtime wiring.",
  "settings.toast.changed_title": "Settings changed",
  "settings.values.on": "On",
  "settings.values.off": "Off",
  "settings.values.theme_mode_dark": "Dark",
  "settings.values.theme_mode_light": "Light",
  "settings.values.line_numbers_absolute": "Absolute",
  "settings.values.line_numbers_relative": "Relative",
  "settings.values.causal_gutter_last_save": "Last save",
  "settings.values.causal_gutter_import": "Import",
  "settings.values.causal_gutter_selected_checkpoint": "Selected checkpoint",
  "settings.values.causal_gutter_selected_tick": "Selected tick",
  "settings.values.source": "Source",
  "settings.values.preview": "Preview",
  "settings.values.current": "Current",
  "settings.values.open": "Open",
  "why.range_obstructed_title": "Why range obstructed",
  "worldline.title": "Worldlines",
  "worldline.empty": "No worldlines yet",
  "worldline.header": "kind      name           basis          head  delta     conflict",
});
const MOCK_HEAP_USED_BYTES = 10;
const MOCK_HEAP_TOTAL_BYTES = 20;
const MOCK_RSS_BYTES = 30;
const MOCK_EXTERNAL_BYTES = 40;
const MOCK_ARRAY_BUFFERS_BYTES = 50;

export { REPO_ROOT, ensureDistBuilt, importDist };

export function mockDeps(overrides = {}) {
  return {
    fileSystem: {
      loadEntries: () => [],
      describeDirectoryIssue: () => ({
        title: "test",
        message: "not implemented",
      }),
      dirname: () => "",
      join: (...parts) => parts.join(path.sep),
      resolve: (...parts) => path.resolve(...parts),
    },
    editorFile: {
      loadEditorFile: () => ({ lines: [], readOnly: false }),
      saveEditorFile: () => undefined,
    },
    sourceHighlighter: {
      highlight: async () => ({ path: "", partial: false, spans: [] }),
    },
    graftDiagnostics: {
      loadDiagnostics: async () => ({
        title: "Graft diagnostics",
        summary: "test diagnostics",
        rows: [],
      }),
      failedDiagnostics: ({ message }) => ({
        title: "Graft diagnostics",
        summary: message,
        rows: [],
      }),
    },
    graftSession: {
      loadGraftInfo: async () => ({
        path: "/repo/main.md",
        relativePath: "main.md",
        dirty: false,
        outlineItems: [],
        changeLines: [],
      }),
      failedGraftInfo: () => ({
        path: "/repo/main.md",
        relativePath: "main.md",
        dirty: false,
        outlineItems: [],
        changeLines: [],
      }),
      closeConnection: async () => undefined,
    },
    titleSceneLoader: {
      loadTitleSceneFromFile: async () => undefined,
      loadBuiltInTitleScene: async () => undefined,
    },
    productionTextSession: fakeProductionTextSession(),
    ...overrides,
  };
}

export function fakeProductionTextSession(overrides = {}) {
  return basisPinnedTestTextSession({
    openBuffer: async () => ({
      kind: "obstructed",
      obstruction: fakeProductionTextObstruction(),
    }),
    insertText: async () => ({
      kind: "obstructed",
      obstruction: fakeProductionTextObstruction(),
    }),
    replaceRange: async () => ({
      kind: "obstructed",
      obstruction: fakeProductionTextObstruction(),
    }),
    deleteRange: async () => ({
      kind: "obstructed",
      obstruction: fakeProductionTextObstruction(),
    }),
    multiRangeEdit: async () => ({
      kind: "obstructed",
      obstruction: fakeProductionTextObstruction(),
    }),
    checkpointBuffer: async () => ({
      kind: "obstructed",
      obstruction: fakeProductionTextObstruction(),
    }),
    observeWindow: async () => ({
      kind: "obstructed",
      obstruction: fakeProductionTextObstruction(),
    }),
    exportSnapshot: async () => ({
      kind: "obstructed",
      obstruction: fakeProductionTextObstruction(),
    }),
    explainRange: async () => ({
      kind: "obstructed",
      obstruction: fakeProductionTextObstruction(),
    }),
    ...overrides,
  });
}

export function basisPinnedTestTextSession(delegate) {
  let sequence = 0;
  let basis = fakeTextBasis("", "head:test:unopened");
  return {
    ...delegate,
    async openBuffer(request) {
      const outcome = await delegate.openBuffer(request);
      if (outcome.kind !== "opened") return outcome;
      basis = outcome.textBasis ?? fakeTextBasis(request.initialText, "head:test:opened");
      return {
        ...outcome,
        textBasis: basis,
      };
    },
    insertText: basisAdvancingEdit(delegate.insertText, insertedByteLength),
    replaceRange: basisAdvancingEdit(delegate.replaceRange, replacementByteLength),
    deleteRange: basisAdvancingEdit(delegate.deleteRange, deletedByteLength),
    async checkpointBuffer(request) {
      const outcome = await delegate.checkpointBuffer(request);
      return outcome.kind === "checkpointed"
        ? { ...outcome, result: { ...outcome.result, textBasis: outcome.result.textBasis ?? basis } }
        : outcome;
    },
    async observeWindow(request) {
      const outcome = await delegate.observeWindow(request);
      if (outcome.kind !== "observed") return outcome;
      const value = outcome.observed.value;
      const textBasis = value.textBasis ?? requestTextBasis(request);
      const lines = value.lines;
      const projectionText = lines.map((line) => line.text).join("\n");
      const projection = fixtureProjectionBasis(
        value.projection ?? fakeProjection(textBasis, lines, projectionText),
        value.totalLineCount ?? lines.length,
      );
      const materialization = value.materialization
        ?? fixtureTextWindowMaterialization(projection, value.readingId);
      return {
        ...outcome,
        observed: {
          ...outcome.observed,
          value: { ...value, textBasis, projection, materialization },
        },
      };
    },
    async observeCausalLineDiff(request) {
      if (delegate.observeCausalLineDiff != null) {
        return delegate.observeCausalLineDiff(request);
      }
      return {
        kind: 'causal-line-diff-observed',
        reading: {
          worldlineId: 'fixture:worldline',
          basisHeadId: request.basisHeadId,
          nextHeadId: request.nextHeadId,
          insertedLineCount: 0,
          deletedLineCount: 0,
          tickReceiptIds: [],
          rewriteIds: [],
          diffIds: [],
          markers: [],
          deletions: [],
          observerVersion: 'test-fixture',
        },
      };
    },
  };

  function basisAdvancingEdit(edit, byteLengthDelta) {
    return async (request) => {
      const outcome = await edit(request);
      if (outcome.kind !== "applied") return outcome;
      sequence += 1;
      basis = outcome.result.textBasis ?? nextBasis(byteLengthDelta(request), sequence);
      return {
        ...outcome,
        result: {
          ...outcome.result,
          textBasis: basis,
          causalTransition: outcome.result.causalTransition ?? {
            admittedTickId: `fixture:tick:${sequence}`,
            nextHeadId: basis.basisHeadId,
          },
        },
      };
    };
  }

  function nextBasis(delta, nextSequence) {
    const currentLength = basis.byteRange.endByte.value - basis.byteRange.startByte.value;
    return fakeTextBasisForByteLength(currentLength + delta, `head:test:edit:${nextSequence}`);
  }
}

export function fixtureTextWindowMaterialization(projection, readingId = "fixture:reading") {
  const startByte = projection.byteRange.startByte;
  const endByte = projection.byteRange.endByte;
  return {
    key: {
      schemaVersion: 1,
      materializerVersion: "jedit.text-window.materializer.v1",
      basis: {
        worldlineId: projection.basis.worldlineId,
        headId: projection.basisHeadId,
        requestFrontierRef: `fixture:request-frontier:${readingId}`,
      },
      coverage: {
        startByte: { kind: "utf8-byte-offset", value: startByte },
        endByte: { kind: "utf8-byte-offset", value: endByte },
      },
      observerPlanId: "fixture:text-window-observer-plan",
      policyDigest: "fixture:text-window-policy",
      coordinateDigest: `fixture:text-window-coordinate:${readingId}`,
      cacheKeyDigest: `fixture:text-window-cache-key:${readingId}`,
    },
    completeness: "complete",
    materializedProjectionBytes: Buffer.byteLength(projection.text, "utf8"),
  };
}

export function fixtureProjectionBasis(projection, totalLineCount) {
  if (projection.basis != null) {
    return projection;
  }
  return {
    ...projection,
    basis: {
      worldlineId: "fixture:test-worldline",
      headId: projection.basisHeadId,
      rootNodeId: `fixture:test-root:${projection.basisHeadId}`,
      byteLength: projection.byteRange.endByte,
      lineCount: totalLineCount,
    },
  };
}

function fakeProjection(textBasis, lines, text) {
  const startByte = lines[0]?.startByte ?? textBasis.byteRange.startByte.value;
  return {
    basisHeadId: textBasis.basisHeadId,
    byteRange: {
      startByte,
      endByte: lines.at(-1)?.endByte ?? startByte + Buffer.byteLength(text, "utf8"),
    },
    text,
    support: [],
  };
}

function requestTextBasis(request) {
  return { basisHeadId: request.basisHeadId, byteRange: request.byteRange };
}

function insertedByteLength(request) {
  return Buffer.byteLength(request.insertText, "utf8");
}

function replacementByteLength(request) {
  return insertedByteLength(request) - deletedByteLength(request);
}

function deletedByteLength(request) {
  return request.endByte.value - request.startByte.value;
}

function fakeTextBasis(text, basisHeadId = "head:test") {
  return fakeTextBasisForByteLength(Buffer.byteLength(text, "utf8"), basisHeadId);
}

function fakeTextBasisForByteLength(byteLength, basisHeadId) {
  return {
    basisHeadId,
    byteRange: {
      startByte: { kind: "utf8-byte-offset", value: 0 },
      endByte: { kind: "utf8-byte-offset", value: byteLength },
    },
  };
}

export function fakeProductionTextObstruction() {
  return {
    code: "test-obstruction",
    issue: {
      name: "TestProductionTextIssue",
      title: "test production text issue",
      message: "test production text issue",
      level: "error",
      source: "command",
      atMs: 0,
    },
  };
}

export function mockKeyBindingContext(overrides = {}) {
  const { deps: depsOverride, ...contextOverrides } = overrides;
  return {
    nowMs: () => 0,
    createDrawerAnimationCmd: () => [],
    createStartupFileDrawerAnimationCmd: () => [],
    createNotificationTickCmd: noopNotificationTickCmd,
    deps: mockDeps(depsOverride ?? {}),
    ...contextOverrides,
  };
}

export function mockI18n(overrides = {}) {
  return {
    locale: "en",
    localeLabel: "English",
    direction: "ltr",
    locales: [
      {
        locale: "en",
        label: "English",
        direction: "ltr",
      },
    ],
    t: (key, values) =>
      applyMockTranslationValues(
        overrides.translations?.[key] ?? MOCK_I18N_TRANSLATIONS[key] ?? "",
        values,
      ),
    setLocale: () => undefined,
    withLocale: (locale) => mockI18n({ ...overrides, locale }),
    ...overrides,
  };
}

function applyMockTranslationValues(template, values) {
  let result = template;
  for (const [key, value] of Object.entries(values ?? {})) {
    result = result.replace(`{${key}}`, String(value));
  }
  return result;
}

export function mockRuntime(overrides = {}) {
  return {
    initialColumns: 120,
    initialRows: 24,
    initialWorkingDirectory: "/repo",
    ...mockDeps(),
    profiler: {
      nowMs: () => 0,
      memoryUsage: () => ({
        heapUsedBytes: MOCK_HEAP_USED_BYTES,
        heapTotalBytes: MOCK_HEAP_TOTAL_BYTES,
        rssBytes: MOCK_RSS_BYTES,
        externalBytes: MOCK_EXTERNAL_BYTES,
        arrayBuffersBytes: MOCK_ARRAY_BUFFERS_BYTES,
      }),
      beginTrace: async () => ({
        filePath: "/tmp/profile.json",
        append: async () => undefined,
        close: async () => undefined,
      }),
      appendTraceFrame: async () => undefined,
      endTrace: async () => undefined,
    },
    profileOnStartup: false,
    createTimeTickCmd: () => () => undefined,
    createNotificationTickCmd: () => () => undefined,
    createDrawerAnimationCmd: () => [],
    createStartupFileDrawerAnimationCmd: () => [],
    initialModel: {
      titleSceneSeed: 0.5,
      jeditTheme: {
        perf: {
          foreground: "white",
          background: "black",
        },
      },
      i18n: mockI18n(),
      entries: [],
      nowMs: 0,
    },
    nowMs: () => 0,
    ...overrides,
  };
}

export function noopNotificationTickCmd() {
  return () => undefined;
}

export function mockJeditTheme() {
  const workspace = {
    fg: "#f0f6fc",
    bg: "#0d1117",
  };
  const drawer = {
    fg: "#f0f6fc",
    bg: "#161b22",
  };
  const accent = {
    fg: "#58a6ff",
    bg: "#0d1117",
  };
  return {
    variables: new Map(),
    surface: {
      workspace,
      currentLine: drawer,
      drawer,
      header: drawer,
      footer: drawer,
    },
    cursor: {
      normal: {
        bg: "#58a6ff",
      },
      insert: accent,
    },
    chrome: {
      activeEdge: accent,
      titleLogo: accent,
      titleLogoShadow: workspace,
      titleSceneNear: workspace,
      titleSceneFar: workspace,
    },
    gutter: {
      normal: mockGutterTokens(workspace, accent),
      dimmed: mockGutterTokens(workspace, accent),
    },
    source: new Map(),
    sourceRoleMap: new Map(),
    markdown: new Map(),
  };
}

export function mockTitleScreenModel(titleScreen, overrides = {}) {
  return {
    editor: undefined,
    workspaceRoot: "/repo",
    cwd: "/repo",
    entries: [],
    selectedIndex: 0,
    textRuntimeProfile: "echoHosted",
    textAuthority: {
      kind: "none",
      profile: "echoHosted",
    },
    textRequestId: 0,
    viewMode: "source",
    focusPane: "editor",
    fileDrawerOpen: false,
    fileDrawerProgress: 0,
    graftDrawerOpen: false,
    graftDrawerProgress: 0,
    lineNumberMode: "absolute",
    gutterDimmed: false,
    causalGutterBasis: { kind: "last-save" },
    settingsOpen: false,
    settingsFocusIndex: 0,
    settingsDiagnosticsOpen: false,
    scenePickerOpen: false,
    scenePickerFocusIndex: 0,
    availableScenes: [],
    columns: 120,
    rows: 24,
    notifications: createNotificationState(),
    notificationLoopActive: false,
    quitConfirmOpen: false,
    quitAfterSaveRequestId: undefined,
    commandLine: {
      active: false,
      input: "",
      cursorIndex: 0,
      anchorCursorIndex: 0,
      selectedCompletionIndex: 0,
    },
    commandLineFilePreview: undefined,
    commandLineFilePreviewRequestId: 0,
    commandLineFilePreviewRequest: undefined,
    inlinePanel: undefined,
    startupIntroComplete: false,
    startupFileModalOpen: false,
    startupFileDrawerProgress: 0,
    startupFileModalInput: "",
    startupFileModalSelectedIndex: 0,
    jeditTheme: mockJeditTheme(),
    graftDiagnostics: undefined,
    graftDiagnosticsLoading: false,
    graftDiagnosticsRequestId: 0,
    i18n: mockI18n(),
    time: 0,
    titleSceneSeed: 0.5,
    titleMeshes: {},
    titleCamera: {
      angle: 0,
      angleTarget: 0,
      angleMotionId: 0,
      radius: 8.5,
      radiusTarget: 8.5,
      radiusMotionId: 0,
      position: [0, 2.65, 8.5],
      target: [0, 0.78, 0],
      eyeY: 2.65,
      crouching: false,
    },
    titleMouseLook: undefined,
    titleBackdropKind: titleScreen.TITLE_BACKDROP_KIND.StaticLogo,
    titleRenderMode: titleScreen.TITLE_RENDER_MODE.Braille,
    titleAsciiPalette: titleScreen.TITLE_ASCII_PALETTE.Dense,
    titleMeshMaterialIndex: 0,
    ...overrides,
  };
}

export function mockGutterTokens(background, accent) {
  return {
    background,
    lineNumber: background,
    currentLineNumber: accent,
    rule: accent,
    inserted: accent,
    modified: accent,
    deleted: accent,
    pending: accent,
    obstructed: accent,
  };
}

export function mockEditor(modeModule, overrides = {}) {
  return {
    path: "/repo/notes.md",
    lines: ["hello world"],
    cursorRow: 0,
    cursorCol: 0,
    scrollRow: 0,
    scrollCol: 0,
    dirty: false,
    readOnly: false,
    mode: modeModule.EditorModes.Normal,
    ...overrides,
  };
}

export function hasNotification(model, title, message) {
  return model.notifications.items.some(
    (item) => item.title === title && item.message === message,
  );
}

export function notification(model, title, message) {
  return model.notifications.items.find(
    (item) => item.title === title && item.message === message,
  );
}

export function surfaceText(surface) {
  const lines = [];
  for (let row = 0; row < surface.height; row += 1) {
    let line = "";
    for (let col = 0; col < surface.width; col += 1) {
      line += surface.get(col, row).char;
    }
    lines.push(line);
  }
  return lines.join("\n");
}
