import assert from "node:assert/strict";
import test from "node:test";
import {
  importDist,
  mockEditor,
  mockKeyBindingContext,
  mockTitleScreenModel,
  surfaceText,
} from "./workspace-helpers.mjs";
import { createI18nMock } from "./i18n-mock.mjs";
import { createWorkspaceEchoAppHarness, productionTextObstruction } from "./workspace-echo-app-harness.mjs";

test("ttd commands move the observer without mutating canonical worldline posture", async () => {
  const [keyBindings, titleScreen, editorMode, worldline] = await Promise.all([
    importDist("app", "workspace", "key-bindings.js"),
    importDist("ui", "title-screen.js"),
    importDist("app", "workspace", "editor", "mode.js"),
    importDist("app", "workspace", "worldline-state.js"),
  ]);
  const base = mockTitleScreenModel(titleScreen, {
    editor: mockEditor(editorMode),
    focusPane: "editor",
    worldline: worldlineWithHead(3),
    commandLine: activeCommandLine("ttd -1"),
  });

  const [observing, commands] = keyBindings.updateFromKey(
    enterKey(),
    base,
    mockKeyBindingContext(),
  );
  const [head] = keyBindings.updateFromKey(
    enterKey(),
    {
      ...observing,
      commandLine: activeCommandLine("ttd head"),
    },
    mockKeyBindingContext(),
  );

  assert.deepEqual(commands, []);
  assert.equal(observing.commandLine.active, false);
  assert.equal(observing.worldline.canonicalHeadTick, 3);
  assert.equal(observing.worldline.posture.kind, "historical");
  assert.equal(observing.worldline.posture.observedTick, 2);
  assert.equal(worldline.workspaceWorldlinePostureLabel(observing.worldline.posture), "observe:t2");
  assert.equal(head.worldline.posture.kind, "canonical");
  assert.equal(worldline.workspaceWorldlinePostureLabel(head.worldline.posture), "main");
});

test("strand commands fork from the current observer basis and open the worldline graph", async () => {
  const [keyBindings, titleScreen, editorMode] = await Promise.all([
    importDist("app", "workspace", "key-bindings.js"),
    importDist("ui", "title-screen.js"),
    importDist("app", "workspace", "editor", "mode.js"),
  ]);
  const base = mockTitleScreenModel(titleScreen, {
    editor: mockEditor(editorMode),
    focusPane: "editor",
    worldline: {
      ...worldlineWithHead(4),
      posture: {
        kind: "historical",
        name: "main",
        basisTick: 4,
        observedTick: 2,
        headTick: 4,
        admissionTarget: "main",
      },
    },
    commandLine: activeCommandLine("strand new from here"),
  });

  const [forked, commands] = keyBindings.updateFromKey(
    enterKey(),
    base,
    mockKeyBindingContext(),
  );
  const strand = forked.worldline.graph.find((node) => node.name === "strand-1");

  assert.deepEqual(commands, []);
  assert.equal(forked.commandLine.active, false);
  assert.equal(forked.historyDrawerOpen, true);
  assert.equal(forked.historyDrawerView, "worldlines");
  assert.equal(forked.focusPane, "history");
  assert.equal(forked.worldline.posture.kind, "strand");
  assert.equal(forked.worldline.posture.name, "strand-1");
  assert.equal(strand.basis, "observe:t2");
  assert.equal(strand.basisTick, 2);
  assert.equal(strand.behind, 2);
});

test("braid preview commands add a braid candidate with ahead behind posture", async () => {
  const [keyBindings, titleScreen, editorMode, worldline] = await Promise.all([
    importDist("app", "workspace", "key-bindings.js"),
    importDist("ui", "title-screen.js"),
    importDist("app", "workspace", "editor", "mode.js"),
    importDist("app", "workspace", "worldline-state.js"),
  ]);
  const forkedWorldline = worldline.createWorkspaceStrand(worldlineWithHead(3), "draft");
  const base = mockTitleScreenModel(titleScreen, {
    editor: mockEditor(editorMode),
    focusPane: "editor",
    worldline: forkedWorldline,
    commandLine: activeCommandLine("braid preview draft"),
  });

  const [previewing] = keyBindings.updateFromKey(
    enterKey(),
    base,
    mockKeyBindingContext(),
  );
  const lines = worldline.renderWorldlineGraphLines(
    previewing.worldline,
    90,
    8,
    createI18nMock(),
  ).join("\n");

  assert.equal(previewing.worldline.posture.kind, "braid-preview");
  assert.equal(previewing.worldline.posture.name, "braid-1");
  assert.equal(previewing.historyDrawerView, "worldlines");
  assert.match(lines, /braid\s+braid-1\s+main\+draft/);
  assert.match(lines, /preview/);
});

test("workspace footer separates unavailable causal evidence from filesystem materialization", async () => {
  const [viewer, titleScreen, editorMode, authority, worldline] = await Promise.all([
    importDist("app", "workspace", "viewer.js"),
    importDist("ui", "title-screen.js"),
    importDist("app", "workspace", "editor", "mode.js"),
    importDist("app", "workspace", "workspace-text-authority.js"),
    importDist("app", "workspace", "worldline-state.js"),
  ]);
  const model = mockTitleScreenModel(titleScreen, {
    columns: 200,
    rows: 12,
    editor: mockEditor(editorMode, {
      dirty: true,
    }),
    textAuthority: authority.openedWorkspaceTextAuthority({
      profile: "echoHosted",
      filePath: "/repo/notes.md",
      bufferId: "buffer:notes",
      readOnly: false,
      dirty: true,
      cache: {
        bufferId: "buffer:notes",
        readingId: "reading:notes",
        lines: ["hello world"],
        lineCount: 1,
        cursorLine: 0,
        viewportLineCount: 24,
        truncated: false,
      },
    }),
    worldline: worldline.createWorkspaceStrand(worldlineWithHead(1), "draft"),
    footerVisible: true,
    jeditTheme: workspaceRenderTheme(),
  });

  const rendered = surfaceText(viewer.renderWorkspace(model));
  const footerContext = rendered.split("\n").at(-1);

  assert.equal(footerContext.startsWith("/repo/notes.md"), true);
  assert.match(footerContext, /\[intent:idle \| causal:unavailable \| file:unknown \| git:unknown \| remote:unknown \| strand:draft \| fs:unmaterialized \| target:main/);
  assert.equal(footerContext.endsWith("+0/-0]"), true);
});

test("worldline drawer shows unconfirmed optimistic braid while Echo edit is in flight", async () => {
  const drawers = await importDist("app", "workspace", "viewer-drawers.js");
  const harness = await openedEchoHarness({ readings: [""] });

  await harness.key("i");
  await harness.key("X", { shift: true });
  harness.setModel(worldlineDrawerModel(harness.model));

  const rendered = surfaceText(drawers.renderDrawer("history", harness.model, 96, 9));

  assert.match(rendered, /projection:\s+canonical@t0 \+ local optimistic \| braid active \| phase:unconfirmed/);
  assert.match(rendered, />\s+settled\s+C\s+main\s+main\s+0\s+\+0\/-0\s+canonical@t0/);
  assert.match(rendered, /unconfirmed\s+L\s+local\s+canonical@t0\s+-\s+\+local\/-0\s+request:2\s+optimistic/);
  assert.match(rendered, /unconfirmed\s+B\s+visible braid\s+main\+local\s+-\s+\+local\/-0\s+canonical@t0\s+active/);
});

test("worldline drawer keeps conflicted optimistic braid visible after obstruction", async () => {
  const drawers = await importDist("app", "workspace", "viewer-drawers.js");
  const harness = await openedEchoHarness({
    readings: [""],
    editObstruction: productionTextObstruction("footprint changed"),
  });

  await harness.key("i");
  await harness.runFirst(await harness.key("X", { shift: true }));
  harness.setModel(worldlineDrawerModel(harness.model));

  const rendered = surfaceText(drawers.renderDrawer("history", harness.model, 96, 9));

  assert.match(rendered, /phase:conflicted/);
  assert.match(rendered, /conflicted\s+L\s+local\s+canonical@t0\s+-\s+\+local\/-0\s+\/repo\/notes\.md:/);
  assert.match(rendered, /conflicted\s+B\s+visible braid\s+main\+local\s+-\s+\+local\/-0\s+canonical@t0\s+active/);
  assert.match(harness.renderText(), /X/);
});

function activeCommandLine(input) {
  return {
    active: true,
    input,
    cursorIndex: input.length,
    anchorCursorIndex: 0,
    selectedCompletionIndex: 0,
  };
}

async function openedEchoHarness(options = {}) {
  const harness = await createWorkspaceEchoAppHarness({
    ...options,
    readings: options.readings ?? [""],
  });
  await harness.runFirst(await harness.key("enter"));
  harness.setModel({
    ...harness.model,
    focusPane: "editor",
    fileDrawerOpen: false,
  });
  return harness;
}

function worldlineDrawerModel(model) {
  return {
    ...model,
    historyDrawerOpen: true,
    historyDrawerProgress: 1,
    historyDrawerView: "worldlines",
  };
}

function enterKey() {
  return { type: "key", key: "enter", ctrl: false, alt: false, shift: false };
}

function worldlineWithHead(headTick) {
  return {
    canonicalHeadTick: headTick,
    posture: {
      kind: "canonical",
      name: "main",
      basisTick: headTick,
      headTick,
      admissionTarget: "main",
    },
    graph: [{
      id: "worldline:main",
      kind: "canonical",
      name: "main",
      basis: "main",
      basisTick: headTick,
      headTick,
      ahead: 0,
      behind: 0,
      conflict: "clear",
    }],
    selectedGraphIndex: 0,
    nextStrandOrdinal: 1,
    nextBraidOrdinal: 1,
  };
}

function workspaceRenderTheme() {
  const workspace = themeToken("#f0f6fc", "#0d1117");
  const drawer = themeToken("#c9d1d9", "#0b1016");
  const edge = { ...themeToken("#58a6ff", "#0d1117"), char: "|" };
  return {
    name: "test",
    mode: "dark",
    familyName: "test",
    variantSource: "authored",
    variables: new Map(),
    source: new Map(),
    sourceRoleMap: new Map(),
    markdown: new Map(),
    surface: { workspace, drawer, footer: drawer },
    cursor: { normal: workspace, insert: workspace },
    chrome: {
      activeEdge: edge,
      titleLogo: workspace,
      titleLogoShadow: workspace,
      titleSceneNear: workspace,
      titleSceneFar: workspace,
    },
  };
}

function themeToken(fg, bg) {
  return {
    fg,
    bg,
    foregroundVariables: [],
    backgroundVariables: [],
  };
}
