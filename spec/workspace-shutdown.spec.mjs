import assert from "node:assert/strict";
import test from "node:test";
import { importDist } from "./dist-helpers.mjs";

function fakeEchoHost(record) {
  return {
    openBuffer: async () => undefined,
    replaceRange: async () => undefined,
    declareCheckpoint: async () => undefined,
    observeWindow: async () => undefined,
    close: async () => {
      record.closed += 1;
    },
  };
}

test("production text dependencies expose a way to shut the host down", async () => {
  const deps = await importDist(
    "adapters",
    "workspace-production-text-dependencies.js",
  );
  const record = { closed: 0 };

  const created = await deps.createWorkspaceProductionTextDependencies(
    () => fakeEchoHost(record),
  );

  assert.equal(typeof created.closeProductionText, "function");
});

test("shutting the dependencies down closes the native Echo host", async () => {
  const deps = await importDist(
    "adapters",
    "workspace-production-text-dependencies.js",
  );
  const record = { closed: 0 };
  const created = await deps.createWorkspaceProductionTextDependencies(
    () => fakeEchoHost(record),
  );

  await created.closeProductionText();

  assert.equal(record.closed, 1);
});

test("shutting down tolerates a host that cannot close", async () => {
  const deps = await importDist(
    "adapters",
    "workspace-production-text-dependencies.js",
  );
  const created = await deps.createWorkspaceProductionTextDependencies(() => ({
    openBuffer: async () => undefined,
    replaceRange: async () => undefined,
    declareCheckpoint: async () => undefined,
    observeWindow: async () => undefined,
  }));

  await assert.doesNotReject(() => created.closeProductionText());
});
