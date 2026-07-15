import assert from "node:assert/strict";
import test from "node:test";
import { importDist } from "./workspace-helpers.mjs";

test("reading cache rejects projection text outside its declared UTF-8 byte range", async () => {
  const { readingCache, WorkspaceTextProjectionError } = await importDist(
    "app",
    "workspace",
    "workspace-text-observed-reading.js",
  );

  assert.throws(
    () => readingCache("buffer:notes", observedReading({
      readingId: "reading:invalid-range",
      projection: projection({ byteRange: { startByte: 4, endByte: 6 } }),
      materialization: materialization({ startByte: 4, endByte: 6, projectionBytes: 2 }),
    })),
    WorkspaceTextProjectionError,
  );
});

test("reading cache rejects provenance support outside the projected range", async () => {
  const { readingCache, WorkspaceTextProjectionError } = await importDist(
    "app",
    "workspace",
    "workspace-text-observed-reading.js",
  );

  assert.throws(
    () => readingCache("buffer:notes", observedReading({
      support: [{
        leafId: "leaf:outside",
        blobId: "blob:outside",
        contentHash: "hash:outside",
        byteRange: { startByte: 3, endByte: 10 },
      }],
    })),
    WorkspaceTextProjectionError,
  );
});

test("reading cache rejects stale materializer provenance", async () => {
  const { readingCache, WorkspaceTextProjectionError } = await importDist(
    "app",
    "workspace",
    "workspace-text-observed-reading.js",
  );

  const currentMaterialization = materialization();
  assert.throws(
    () => readingCache("buffer:notes", observedReading({
      materialization: {
        ...currentMaterialization,
        key: {
          ...currentMaterialization.key,
          materializerVersion: "jedit.text-window.materializer.v0",
        },
      },
    })),
    WorkspaceTextProjectionError,
  );
});

test("reading cache fails closed when materialization provenance is missing", async () => {
  const { readingCache, WorkspaceTextProjectionError } = await importDist(
    "app",
    "workspace",
    "workspace-text-observed-reading.js",
  );

  assert.throws(
    () => readingCache("buffer:notes", observedReading({ materialization: undefined })),
    WorkspaceTextProjectionError,
  );
});

function observedReading(overrides = {}) {
  return {
    readingId: "reading:support",
    textBasis: {
      basisHeadId: "head:notes",
      byteRange: {
        startByte: { kind: "utf8-byte-offset", value: 0 },
        endByte: { kind: "utf8-byte-offset", value: 10 },
      },
    },
    projection: overrides.projection ?? projection({ support: overrides.support ?? [] }),
    materialization: overrides.materialization ?? materialization(),
    lines: [{ lineNumber: 1, text: "causal" }],
    startLine: 1,
    lineCount: 1,
    totalLineCount: 3,
    hasMoreBefore: true,
    hasMoreAfter: true,
    cursorLine: 1,
    viewportLineCount: 1,
    truncated: false,
    ...overrides,
  };
}

function projection(overrides = {}) {
  return {
    basisHeadId: "head:notes",
    basis: {
      worldlineId: "wl:notes",
      headId: "head:notes",
      rootNodeId: "node:notes",
      byteLength: 10,
      lineCount: 3,
    },
    byteRange: { startByte: 4, endByte: 10 },
    text: "causal",
    support: [],
    ...overrides,
  };
}

function materialization(overrides = {}) {
  const startByte = overrides.startByte ?? 4;
  const endByte = overrides.endByte ?? 10;
  return {
    key: {
      schemaVersion: 1,
      materializerVersion: "jedit.text-window.materializer.v1",
      basis: {
        worldlineId: "wl:notes",
        headId: "head:notes",
        requestFrontierRef: "frontier:notes:1",
      },
      coverage: {
        startByte: { kind: "utf8-byte-offset", value: startByte },
        endByte: { kind: "utf8-byte-offset", value: endByte },
      },
      observerPlanId: "observer-plan:textWindow:test",
      policyDigest: "policy:test",
      coordinateDigest: "coordinate:test",
      cacheKeyDigest: "cache-key:test",
    },
    completeness: "complete",
    materializedProjectionBytes: overrides.projectionBytes ?? 6,
  };
}
