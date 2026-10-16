import assert from "node:assert/strict";
import test from "node:test";
import { importDist } from "./dist-helpers.mjs";

// The native Echo host owns a child process holding stdio pipes open. Anything
// that escapes startup without closing it leaves the terminal unrestored and
// the event loop alive, which is the failure #306 was filed for. Building the
// app is the part that can throw, so it has to be inside the guard.

function recordingDependencies() {
  const closed = [];
  return {
    closed,
    dependencies: {
      closeProductionText: async () => {
        closed.push("closed");
      },
    },
  };
}

test("the Echo host is closed after a normal run", async () => {
  const { closingProductionText } = await importDist(
    "adapters",
    "workspace-production-text-dependencies.js",
  );
  const { closed, dependencies } = recordingDependencies();

  const result = await closingProductionText(dependencies, async () => "ran");

  assert.equal(result, "ran");
  assert.deepEqual(closed, ["closed"]);
});

test("the Echo host is closed when app construction throws", async () => {
  const { closingProductionText } = await importDist(
    "adapters",
    "workspace-production-text-dependencies.js",
  );
  const { closed, dependencies } = recordingDependencies();

  await assert.rejects(
    closingProductionText(dependencies, async () => {
      throw new Error("createWorkspaceApp failed");
    }),
    /createWorkspaceApp failed/,
  );

  assert.deepEqual(closed, ["closed"], "the host must close even on a failed startup");
});

test("the original failure is not masked by the close", async () => {
  const { closingProductionText } = await importDist(
    "adapters",
    "workspace-production-text-dependencies.js",
  );

  await assert.rejects(
    closingProductionText(
      { closeProductionText: async () => undefined },
      async () => {
        throw new Error("the real cause");
      },
    ),
    /the real cause/,
  );
});
