import assert from "node:assert/strict";
import test from "node:test";
import { importDist } from "./dist-helpers.mjs";
import { mockJeditTheme, mockTitleScreenModel } from "./workspace-helpers.mjs";

// The Files drawer's ownership of its own input is covered; the Graft drawer
// takes the same branch in workspaceDrawerHasFocus but had no cases of its own.
// Without these, a change that narrowed the guard to Files only would keep
// every existing test green while arrow keys and the mouse silently went back
// to driving the title camera behind an open Graft drawer.

async function graftFocusedModel(overrides = {}) {
  const titleScreen = await importDist("ui", "title-screen.js");
  return mockTitleScreenModel(titleScreen, {
    graftDrawerOpen: true,
    focusPane: "graft",
    jeditTheme: mockJeditTheme(),
    ...overrides,
  });
}

test("a focused Graft drawer owns its input", async () => {
  const focused = await importDist("app", "workspace", "focused-pane-key-bindings.js");
  const model = await graftFocusedModel();

  assert.equal(focused.workspaceDrawerHasFocus(model), true);
});

test("a closed Graft drawer does not own input even when focused", async () => {
  const focused = await importDist("app", "workspace", "focused-pane-key-bindings.js");
  const model = await graftFocusedModel({ graftDrawerOpen: false });

  assert.equal(focused.workspaceDrawerHasFocus(model), false);
});

test("arrow keys behind a focused Graft drawer do not drive the title camera", async () => {
  const [keyBindings, titleKeys] = await Promise.all([
    importDist("app", "workspace", "key-bindings.js"),
    importDist("app", "workspace", "title-screen-key-bindings.js"),
  ]);
  const model = await graftFocusedModel();

  for (const key of ["up", "down", "left", "right"]) {
    const [next] = keyBindings.updateFromKey(
      { key, ctrl: false, alt: false, shift: false },
      model,
    );
    assert.equal(
      next.titleCamera?.yaw ?? 0,
      model.titleCamera?.yaw ?? 0,
      `${key} moved the title camera behind an open Graft drawer`,
    );
    assert.equal(
      next.titleBackdropKind,
      model.titleBackdropKind,
      `${key} switched the backdrop behind an open Graft drawer`,
    );
  }

  assert.equal(typeof titleKeys.updateTitleScreenKey, "function");
});

test("mouse look stays off behind a focused Graft drawer", async () => {
  const [mouse, titleScreen] = await Promise.all([
    importDist("app", "workspace", "mouse.js"),
    importDist("ui", "title-screen.js"),
  ]);
  const model = await graftFocusedModel();

  // Mouse-look is what switches the backdrop to the ray-traced scene, so the
  // observable effect of the guard failing is titleBackdropKind changing.
  const [next] = mouse.updateFromMouse(
    {
      type: "mouse",
      button: "none",
      action: "move",
      col: 40,
      row: 12,
      shift: false,
      alt: false,
      ctrl: false,
    },
    model,
  );

  assert.equal(
    next.titleBackdropKind,
    model.titleBackdropKind,
    "pointer movement switched the backdrop behind an open Graft drawer",
  );
  assert.notEqual(
    next.titleBackdropKind,
    titleScreen.TITLE_BACKDROP_KIND.LegacyScene,
    "pointer movement started the ray tracer behind an open Graft drawer",
  );
});
