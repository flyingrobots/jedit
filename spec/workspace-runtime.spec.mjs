import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { stringToSurface } from "@flyingrobots/bijou";
import {
  importDist,
  mockI18n,
  mockJeditTheme,
  mockRuntime,
  REPO_ROOT,
  surfaceText,
} from "./workspace-helpers.mjs";

test("runtime toggle-perf message flips perf visibility state", async () => {
  const runtimeModule = await importDist("app", "workspace", "runtime.js");
  const runtime = runtimeModule.createWorkspaceRuntime(mockRuntime());

  const [toggledOn] = runtime.update(
    { type: "toggle-perf" },
    { perfVisible: false },
  );
  const [toggledOff] = runtime.update({ type: "toggle-perf" }, toggledOn);

  assert.equal(toggledOn.perfVisible, true);
  assert.equal(toggledOff.perfVisible, false);
});

test("workspace runtime exposes message constants for central dispatch", async () => {
  const runtimeModule = await importDist("app", "workspace", "runtime.js");
  const runtime = runtimeModule.createWorkspaceRuntime(mockRuntime());

  assert.equal(runtimeModule.WorkspaceMessageTypes.TogglePerf, "toggle-perf");
  assert.equal(runtimeModule.WorkspaceInputMessageTypes.Key, "key");

  const [nextModel] = runtime.update(
    { type: runtimeModule.WorkspaceMessageTypes.TogglePerf },
    { perfVisible: false },
  );

  assert.equal(nextModel.perfVisible, true);
});

test("workspace app animation commands emit centralized message types", async () => {
  const source = readFileSync(
    path.join(REPO_ROOT, "src", "adapters", "workspace-app.ts"),
    "utf8",
  );

  assert.doesNotMatch(source, /type: 'time-tick'/);
  assert.doesNotMatch(source, /type: 'drawer-progress'/);
});

test("raytracer profiler uses centralized runtime issue tokens", async () => {
  const source = readFileSync(
    path.join(REPO_ROOT, "src", "app", "raytracer-profiler.ts"),
    "utf8",
  );

  assert.doesNotMatch(source, /const ISSUE_LEVEL_ERROR/);
  assert.doesNotMatch(source, /const ISSUE_LEVEL_WARNING/);
  assert.doesNotMatch(source, /const ISSUE_SOURCE_COMMAND/);
});

test("runtime load-scene-result applies the loaded scene camera to title camera state", async () => {
  const runtimeModule = await importDist("app", "workspace", "runtime.js");
  const runtime = runtimeModule.createWorkspaceRuntime(mockRuntime());
  const scene = {
    camera: {
      angle: 1.25,
      radius: 6.75,
      position: [0.8, 1.05, 2.5],
      target: [0, 0.8, 0],
    },
    objects: [],
  };

  const [nextModel] = runtime.update(
    { type: "load-scene-result", scene },
    {
      sceneOverride: undefined,
      titleCamera: {
        angle: 9,
        angleTarget: 9,
        angleMotionId: 3,
        radius: 9,
        radiusTarget: 9,
        radiusMotionId: 4,
        position: [0, 2.65, 9],
        target: [0, 0.78, 0],
        eyeY: 2.65,
      },
    },
  );

  assert.equal(nextModel.sceneOverride, scene);
  assert.equal(nextModel.titleCamera.angle, scene.camera.angle);
  assert.equal(nextModel.titleCamera.angleTarget, scene.camera.angle);
  assert.equal(nextModel.titleCamera.radius, scene.camera.radius);
  assert.equal(nextModel.titleCamera.radiusTarget, scene.camera.radius);
  assert.deepEqual(nextModel.titleCamera.position, scene.camera.position);
  assert.deepEqual(nextModel.titleCamera.target, scene.camera.target);
  assert.equal(nextModel.titleCamera.eyeY, scene.camera.position[1]);
});

test("workspace app renders perf overlay after toggle when perf starts disabled", async () => {
  const [workspaceApp, themes] = await Promise.all([
    importDist("adapters", "workspace-app.js"),
    importDist("ui", "jedit-themes.js"),
  ]);
  const app = workspaceApp.createWorkspaceApp({
    initialColumns: 120,
    initialRows: 24,
    initialWorkingDirectory: "/repo",
    perfEnabled: false,
    nowMs: () => 0,
    random: () => 0.5,
    seed: {
      titleSceneSeed: 0.5,
      jeditTheme: themes.resolveInitialJeditTheme(undefined),
      i18n: mockI18n(),
      entries: [],
      nowMs: 0,
    },
  });

  const [initialModel] = app.init();
  const [visibleModel] = app.update({ type: "toggle-perf" }, initialModel);
  const surface = app.view({
    ...visibleModel,
    lastFrameMs: 123456789,
    frameTimeMs: 20,
    frameTimeHistory: [16, 20],
  });
  const text = surfaceText(surface);

  assert.match(text, /jedit perf/);
  assert.match(text, /FPS\s+50/);
  assert.match(text, /frame\s+20\.00 ms/);
  assert.match(text, /heap\s+\d+\.\d MB/);
  assert.match(text, /rss\s+\d+\.\d MB/);
});

test("workspace perf overlay adds title-scene facts only on title screen", async () => {
  const [workspacePerfApp, titleScreen] = await Promise.all([
    importDist("adapters", "workspace-perf-app.js"),
    importDist("ui", "title-screen.js"),
  ]);
  const model = mockPerfTitleModel(titleScreen);
  const app = workspacePerfApp.createPerfApp(surfaceOnlyApp(), {
    initialPerfVisible: true,
  });
  const titleText = surfaceText(app.view(model));
  const editorText = surfaceText(app.view({ ...model, editor: { path: "x" } }));

  assert.match(titleText, /title scene/);
  assert.match(titleText, /scene\s+default-scene/);
  assert.match(titleText, /objects\s+1/);
  assert.match(titleText, /triangles\s+3/);
  assert.match(titleText, /rays\s+5120/);
  assert.doesNotMatch(editorText, /title scene/);
});

test("workspace app rejects stale non-Echo seeded text runtime profile", async () => {
  const [workspaceApp, themes, profile] = await Promise.all([
    importDist("adapters", "workspace-app.js"),
    importDist("ui", "jedit-themes.js"),
    importDist("app", "text-runtime-profile.js"),
  ]);
  const app = workspaceApp.createWorkspaceApp({
    initialColumns: 120,
    initialRows: 24,
    initialWorkingDirectory: "/repo",
    perfEnabled: false,
    nowMs: () => 0,
    random: () => 0.5,
    seed: {
      titleSceneSeed: 0.5,
      jeditTheme: themes.resolveInitialJeditTheme(undefined),
      i18n: mockI18n(),
      entries: [],
      nowMs: 0,
      textRuntimeProfile: "testLocal",
    },
  });

  const [initialModel] = app.init();

  assert.equal(
    initialModel.textRuntimeProfile,
    profile.TEXT_RUNTIME_PROFILE_ECHO_HOSTED,
  );
});

test("initial workspace model separates text authority from render cache", async () => {
  const [initModule, themes, profile, authority] = await Promise.all([
    importDist("app", "workspace", "init.js"),
    importDist("ui", "jedit-themes.js"),
    importDist("app", "text-runtime-profile.js"),
    importDist("app", "workspace", "workspace-text-authority.js"),
  ]);
  const model = initModule.createInitialModel("/repo", 120, 24, {
    titleSceneSeed: 0.5,
    jeditTheme: themes.resolveInitialJeditTheme(undefined),
    i18n: mockI18n(),
    entries: [],
    nowMs: 0,
  });

  assert.equal(
    model.textRuntimeProfile,
    profile.TEXT_RUNTIME_PROFILE_ECHO_HOSTED,
  );
  assert.equal(
    model.textAuthority.kind,
    authority.WorkspaceTextAuthorityKinds.None,
  );
  assert.equal(
    model.textAuthority.profile,
    profile.TEXT_RUNTIME_PROFILE_ECHO_HOSTED,
  );
  assert.equal(model.editor, undefined);
  assert.equal("requestRunUntilIdle" in model.textAuthority, false);
  assert.equal("requestStart" in model.textAuthority, false);
  assert.equal("requestStop" in model.textAuthority, false);
});

test("initial workspace scene picker lists authored scene assets that exist on disk", async () => {
  const initModule = await importDist("app", "workspace", "init.js");
  const model = initModule.createInitialModel("/repo", 120, 24, {
    titleSceneSeed: 0.5,
    jeditTheme: mockJeditTheme(),
    i18n: mockI18n(),
    entries: [],
    nowMs: 0,
  });

  assert.deepEqual(model.availableScenes, [
    "bunny.jedit-scene",
    "neon-dispersion.jedit-scene",
    "teapot-cornell.jedit-scene",
    "teapot-gallery.jedit-scene",
    "neon-orbit.jedit-scene",
    "mirror-hall.jedit-scene",
    "eclipse-gate.jedit-scene",
    "prism-garden.jedit-scene",
    "aurora-vault.jedit-scene",
    "ember-court.jedit-scene",
    "material-lab.jedit-scene",
    "sphere.jedit-scene",
    "column.jedit-scene",
    "sphere-ground.jedit-scene",
  ]);
  assert.equal(
    model.availableScenes.every((scene) =>
      existsSync(path.join(REPO_ROOT, "scenes", scene)),
    ),
    true,
  );
});

test("runtime trims frame history to the configured window", async () => {
  const runtimeModule = await importDist("app", "workspace", "runtime.js");
  const runtime = runtimeModule.createWorkspaceRuntime({
    ...mockRuntime(),
    nowMs: () => 200,
  });
  const [initialModel] = runtime.init();
  const [nextModel] = runtime.update(
    { type: "time-tick", time: 2 },
    {
      ...initialModel,
      lastFrameMs: 100,
      frameTimeHistory: Array.from({ length: 55 }, (_, index) => index),
    },
  );

  assert.equal(nextModel.frameTimeHistory.length, 50);
  assert.deepEqual(nextModel.frameTimeHistory.slice(-1), [100]);
});

test("runtime opens the startup file modal when the title intro completes", async () => {
  const drawerCommands = ["drawer-animation"];
  const runtimeModule = await importDist("app", "workspace", "runtime.js");
  const runtime = runtimeModule.createWorkspaceRuntime({
    ...mockRuntime(),
    createStartupFileDrawerAnimationCmd: (from, to) => {
      drawerCommands.push(`${from}:${to}`);
      return [() => ({ type: "startup-file-drawer-progress", value: to })];
    },
    nowMs: () => 7000,
  });
  const [initialModel] = runtime.init();
  const [nextModel, commands] = runtime.update(
    { type: "time-tick", time: 7 },
    {
      ...initialModel,
      lastFrameMs: 6500,
    },
  );

  assert.equal(nextModel.startupIntroComplete, true);
  assert.equal(nextModel.startupFileModalOpen, true);
  assert.deepEqual(drawerCommands, ["drawer-animation", "0:1"]);
  assert.equal(commands.length, 1);
});

test("startup file drawer animation uses a critically damped Bijou spring", async () => {
  const animation = await importDist(
    "adapters",
    "workspace-animation-commands.js",
  );

  assert.equal(
    animation.STARTUP_FILE_DRAWER_SPRING.damping,
    2 *
      Math.sqrt(
        animation.STARTUP_FILE_DRAWER_SPRING.stiffness *
          animation.STARTUP_FILE_DRAWER_SPRING.mass,
      ),
  );
});

test("stopping a failed profile trace emits only the close failure issue", async () => {
  const profiler = await importDist("app", "raytracer-profiler.js");
  const activeHandle = {
    filePath: "/tmp/profile.json",
    append: async () => undefined,
    close: async () => undefined,
  };
  const [, commands] = profiler.toggleProfiler(
    {
      active: true,
      filePath: activeHandle.filePath,
      fileHandle: activeHandle,
    },
    "/repo",
    {
      nowMs: () => 123,
      beginTrace: async () => activeHandle,
      appendTraceFrame: async () => undefined,
      endTrace: async () => {
        throw new Error("close failed");
      },
    },
  );

  assert.equal(commands.length, 1);
  const message = await commands[0]();

  assert.equal(message.type, "runtime-issue");
  assert.equal(message.issue.level, "error");
  assert.equal(message.issue.source, "command");
  assert.equal(message.issue.atMs, 123);
});

function surfaceOnlyApp() {
  return {
    init: () => [mockPerfTitleModel(), []],
    update: (_, model) => [model, []],
    view: (model) => stringToSurface("workspace", model.columns, model.rows),
    routeRuntimeIssue: (issue) => issue,
  };
}

function mockPerfTitleModel(titleScreen = titleScreenFallback()) {
  return {
    editor: undefined,
    columns: 40,
    rows: 20,
    footerVisible: true,
    fileDrawerProgress: 0,
    graftDrawerProgress: 0,
    historyDrawerProgress: 0,
    perfVisible: true,
    frameTimeMs: 20,
    frameTimeHistory: [16, 20],
    titleSceneSeed: 0.5,
    titleSceneName: "default-scene",
    titleRenderMode: titleScreen.TITLE_RENDER_MODE.Braille,
    titleMeshes: {},
    sceneOverride: {
      camera: { angle: 0, radius: 8 },
      objects: [
        {
          kind: "mesh",
          mesh: {
            triangles: [
              [0, 1, 2],
              [0, 2, 3],
              [0, 3, 1],
            ],
          },
          radius: 1,
          footprintRadius: 1,
          height: 1,
          color: [255, 255, 255],
          reflectivity: 0,
        },
      ],
    },
  };
}

function titleScreenFallback() {
  return {
    TITLE_RENDER_MODE: {
      Braille: "braille",
    },
  };
}
