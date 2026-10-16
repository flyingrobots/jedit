import assert from "node:assert/strict";
import test from "node:test";
import { importDist } from "./dist-helpers.mjs";

const NO_ENV = Object.freeze({});
const ENABLED = "1";
const DISABLED = "0";

test("a plain launch enables no perf overlay", async () => {
  const main = await importDist("main-workspace.js");

  assert.equal(main.workspaceInstrumentationFromEnv(NO_ENV).perfEnabled, false);
});

test("a plain launch starts no profiler trace", async () => {
  const main = await importDist("main-workspace.js");

  assert.equal(
    main.workspaceInstrumentationFromEnv(NO_ENV).profileEnabled,
    false,
  );
});

test("instrumentation still turns on when explicitly asked for", async () => {
  const main = await importDist("main-workspace.js");
  const enabled = main.workspaceInstrumentationFromEnv({
    [main.WORKSPACE_INSTRUMENTATION_ENV.Perf]: ENABLED,
    [main.WORKSPACE_INSTRUMENTATION_ENV.Profile]: ENABLED,
  });

  assert.equal(enabled.perfEnabled, true);
  assert.equal(enabled.profileEnabled, true);
});

test("instrumentation stays off when explicitly disabled", async () => {
  const main = await importDist("main-workspace.js");
  const disabled = main.workspaceInstrumentationFromEnv({
    [main.WORKSPACE_INSTRUMENTATION_ENV.Perf]: DISABLED,
    [main.WORKSPACE_INSTRUMENTATION_ENV.Profile]: DISABLED,
  });

  assert.equal(disabled.perfEnabled, false);
  assert.equal(disabled.profileEnabled, false);
});
