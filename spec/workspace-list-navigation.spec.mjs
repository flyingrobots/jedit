import assert from "node:assert/strict";
import test from "node:test";
import { importDist } from "./dist-helpers.mjs";
import {
  mockKeyBindingContext,
  mockTitleScreenModel,
} from "./workspace-helpers.mjs";

const ENTRIES = Object.freeze([
  { name: "alpha.txt", isDirectory: false },
  { name: "beta.txt", isDirectory: false },
  { name: "gamma.txt", isDirectory: false },
]);
const LAST_INDEX = ENTRIES.length - 1;
const FIRST_INDEX = 0;

async function fileDrawerModel(overrides = {}) {
  const [titleScreen, panelFocus] = await Promise.all([
    importDist("ui", "title-screen.js"),
    importDist("ui", "panel-focus.js"),
  ]);
  return mockTitleScreenModel(titleScreen, {
    editor: undefined,
    entries: ENTRIES,
    selectedIndex: FIRST_INDEX,
    fileDrawerOpen: true,
    focusPane: panelFocus.FocusPanes.Files,
    startupIntroComplete: true,
    ...overrides,
  });
}

test("down arrow moves the file explorer selection", async () => {
  const keyBindings = await importDist("app", "workspace", "key-bindings.js");
  const model = await fileDrawerModel();

  const [next] = keyBindings.updateFromKey(
    { key: "down" },
    model,
    mockKeyBindingContext(),
  );

  assert.equal(next.selectedIndex, 1);
});

test("up arrow moves the file explorer selection", async () => {
  const keyBindings = await importDist("app", "workspace", "key-bindings.js");
  const model = await fileDrawerModel({ selectedIndex: 1 });

  const [next] = keyBindings.updateFromKey(
    { key: "up" },
    model,
    mockKeyBindingContext(),
  );

  assert.equal(next.selectedIndex, FIRST_INDEX);
});

test("arrow keys in the file explorer never start the ray-traced backdrop", async () => {
  const [keyBindings, titleScreen] = await Promise.all([
    importDist("app", "workspace", "key-bindings.js"),
    importDist("ui", "title-screen.js"),
  ]);
  const model = await fileDrawerModel();

  const [next] = keyBindings.updateFromKey(
    { key: "down" },
    model,
    mockKeyBindingContext(),
  );

  assert.notEqual(
    next.titleBackdropKind,
    titleScreen.TITLE_BACKDROP_KIND.LegacyScene,
  );
});

test("the file explorer selection wraps from the last entry to the first", async () => {
  const keyBindings = await importDist("app", "workspace", "key-bindings.js");
  const model = await fileDrawerModel({ selectedIndex: LAST_INDEX });

  const [next] = keyBindings.updateFromKey(
    { key: "j" },
    model,
    mockKeyBindingContext(),
  );

  assert.equal(next.selectedIndex, FIRST_INDEX);
});

test("the file explorer selection wraps from the first entry to the last", async () => {
  const keyBindings = await importDist("app", "workspace", "key-bindings.js");
  const model = await fileDrawerModel({ selectedIndex: FIRST_INDEX });

  const [next] = keyBindings.updateFromKey(
    { key: "k" },
    model,
    mockKeyBindingContext(),
  );

  assert.equal(next.selectedIndex, LAST_INDEX);
});

test("an empty file explorer stays put instead of wrapping onto nothing", async () => {
  const keyBindings = await importDist("app", "workspace", "key-bindings.js");
  const model = await fileDrawerModel({ entries: [], selectedIndex: 0 });

  const [next] = keyBindings.updateFromKey(
    { key: "j" },
    model,
    mockKeyBindingContext(),
  );

  assert.equal(next.selectedIndex, 0);
});
