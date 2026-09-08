import assert from "node:assert/strict";
import test from "node:test";
import { importDist } from "./dist-helpers.mjs";

const HEIGHT = 10;

test("a list shorter than the drawer never scrolls", async () => {
  const viewport = await importDist("app", "workspace", "viewport.js");

  assert.equal(viewport.listScrollOffset(0, 4, HEIGHT), 0);
  assert.equal(viewport.listScrollOffset(3, 4, HEIGHT), 0);
});

test("an early selection keeps the list at the top", async () => {
  const viewport = await importDist("app", "workspace", "viewport.js");

  assert.equal(viewport.listScrollOffset(0, 100, HEIGHT), 0);
  assert.equal(viewport.listScrollOffset(2, 100, HEIGHT), 0);
});

test("the window follows a selection past the visible rows", async () => {
  const viewport = await importDist("app", "workspace", "viewport.js");
  const offset = viewport.listScrollOffset(50, 100, HEIGHT);

  assert.ok(offset > 0);
  assert.ok(50 >= offset && 50 < offset + HEIGHT);
});

test("the last entry is reachable and the window stops there", async () => {
  const viewport = await importDist("app", "workspace", "viewport.js");
  const offset = viewport.listScrollOffset(99, 100, HEIGHT);

  assert.equal(offset, 100 - HEIGHT);
  assert.ok(99 >= offset && 99 < offset + HEIGHT);
});

test("the selection is always inside the window for every position", async () => {
  const viewport = await importDist("app", "workspace", "viewport.js");
  const total = 57;
  const offenders = [];

  for (let index = 0; index < total; index += 1) {
    const offset = viewport.listScrollOffset(index, total, HEIGHT);
    const visible = index >= offset && index < offset + HEIGHT;
    const bounded = offset >= 0 && offset <= Math.max(0, total - HEIGHT);
    if (!visible || !bounded) {
      offenders.push(`index=${index} offset=${offset}`);
    }
  }

  assert.deepEqual(offenders, []);
});

test("a click maps through the scroll offset to the right entry", async () => {
  const [mouse, viewport, panelFocus, titleScreen] = await Promise.all([
    importDist("app", "workspace", "mouse.js"),
    importDist("app", "workspace", "viewport.js"),
    importDist("ui", "panel-focus.js"),
    importDist("ui", "title-screen.js"),
  ]);
  const { mockTitleScreenModel } = await import("./workspace-helpers.mjs");
  const entries = Array.from({ length: 100 }, (_, index) => ({
    kind: "file",
    name: `entry-${index}.txt`,
    path: `/w/entry-${index}.txt`,
    isDirectory: false,
  }));
  const model = mockTitleScreenModel(titleScreen, {
    editor: undefined,
    entries,
    selectedIndex: 60,
    fileDrawerOpen: true,
    fileDrawerProgress: 1,
    focusPane: panelFocus.FocusPanes.Files,
    startupIntroComplete: true,
    columns: 100,
    rows: 30,
  });
  const bodyHeight = viewport.workspaceBodyHeight({
    rows: model.rows,
    footerVisible: model.footerVisible,
  });
  const listHeight = bodyHeight - (viewport.DRAWER_INNER_PAD * 2);
  const offset = viewport.listScrollOffset(60, entries.length, listHeight);
  const firstRow =
    viewport.WORKSPACE_BODY_TOP_OFFSET + viewport.DRAWER_INNER_PAD;

  const [next] = mouse.updateFromMouse(
    {
      type: "mouse",
      button: "left",
      action: "press",
      col: 2,
      row: firstRow,
      shift: false,
      alt: false,
      ctrl: false,
    },
    model,
    { highlight: () => undefined },
  );

  assert.equal(next.selectedIndex, offset);
});

test("clicking a file opens it, not just selects it", async () => {
  const [mouse, viewport, panelFocus, titleScreen] = await Promise.all([
    importDist("app", "workspace", "mouse.js"),
    importDist("app", "workspace", "viewport.js"),
    importDist("ui", "panel-focus.js"),
    importDist("ui", "title-screen.js"),
  ]);
  const { mockTitleScreenModel } = await import("./workspace-helpers.mjs");
  const opened = [];
  const model = mockTitleScreenModel(titleScreen, {
    editor: undefined,
    entries: [
      { kind: "file", name: "alpha.txt", path: "/w/alpha.txt", isDirectory: false },
      { kind: "file", name: "beta.txt", path: "/w/beta.txt", isDirectory: false },
    ],
    selectedIndex: 0,
    fileDrawerOpen: true,
    fileDrawerProgress: 1,
    focusPane: panelFocus.FocusPanes.Files,
    startupIntroComplete: true,
    columns: 100,
    rows: 30,
  });
  const row = viewport.WORKSPACE_BODY_TOP_OFFSET + viewport.DRAWER_INNER_PAD + 1;

  mouse.updateFromMouse(
    { type: "mouse", button: "left", action: "press", col: 2, row, shift: false, alt: false, ctrl: false },
    model,
    { highlight: () => undefined },
    {
      nowMs: () => 0,
      openEntry: (nextModel, entry) => {
        opened.push(entry.path);
        return [nextModel, []];
      },
    },
  );

  assert.deepEqual(opened, ["/w/beta.txt"]);
});
