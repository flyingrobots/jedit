import assert from "node:assert/strict";
import test from "node:test";
import { importDist, discoverRepoRoot } from "./dist-helpers.mjs";
import { mockI18n, mockJeditTheme } from "./workspace-helpers.mjs";

// A scene load that returns no scene -- cancelled, or a RuntimeIssue -- must
// leave the backdrop as it found it. Switching to LegacyScene with no scene to
// draw does two things: it drops the static logo, and because
// workspaceAnimationIsActive treats LegacyScene as animating, it puts the
// workspace back into a 60Hz render loop. That is the idle-render regression
// from #320, resurrected on the failure path.

async function initialModel() {
  const init = await importDist("app", "workspace", "init.js");
  return init.createInitialModel(discoverRepoRoot(), 120, 40, {
    entries: [],
    jeditTheme: mockJeditTheme(),
    i18n: mockI18n(),
    nowMs: 0,
  });
}

test("a cancelled scene load leaves the backdrop alone", async () => {
  const [state, screen, init] = await Promise.all([
    importDist("app", "workspace", "workspace-title-scene-state.js"),
    importDist("ui", "title-screen.js"),
    importDist("app", "workspace", "init.js"),
  ]);
  const model = { ...(await initialModel()), startupIntroComplete: true };

  assert.equal(
    model.titleBackdropKind,
    screen.TITLE_BACKDROP_KIND.StaticLogo,
    "precondition: the workspace starts on the static logo",
  );

  const next = state.applyWorkspaceTitleSceneLoadResult(model, {
    type: "loadSceneResult",
    scene: null,
    sceneName: "continuum-gate",
  });

  assert.equal(next.titleBackdropKind, screen.TITLE_BACKDROP_KIND.StaticLogo);
  assert.equal(
    init.workspaceAnimationIsActive(next),
    false,
    "a failed load must not restart the render loop",
  );
});

test("a successful scene load does switch to the legacy backdrop", async () => {
  const [state, screen] = await Promise.all([
    importDist("app", "workspace", "workspace-title-scene-state.js"),
    importDist("ui", "title-screen.js"),
  ]);
  const model = await initialModel();

  const scene = { camera: { position: [0, 0, 1], target: [0, 0, 0], up: [0, 1, 0], fov: 60 } };
  const next = state.applyWorkspaceTitleSceneLoadResult(model, {
    type: "loadSceneResult",
    scene,
    sceneName: "continuum-gate",
  });

  assert.equal(next.titleBackdropKind, screen.TITLE_BACKDROP_KIND.LegacyScene);
  assert.equal(next.titleSceneName, "continuum-gate");
  assert.notEqual(next.sceneOverride, null);
});
