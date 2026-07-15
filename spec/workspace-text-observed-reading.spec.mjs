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
    () => readingCache("buffer:notes", {
      readingId: "reading:invalid-range",
      projection: {
        basisHeadId: "head:notes",
        byteRange: { startByte: 4, endByte: 6 },
        text: "causal",
        support: [],
      },
      lines: [{ lineNumber: 1, text: "causal" }],
      startLine: 1,
      lineCount: 1,
      totalLineCount: 3,
      hasMoreBefore: true,
      hasMoreAfter: true,
      cursorLine: 1,
      viewportLineCount: 1,
      truncated: false,
    }),
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

function observedReading(overrides = {}) {
  return {
    readingId: "reading:support",
    projection: {
      basisHeadId: "head:notes",
      byteRange: { startByte: 4, endByte: 10 },
      text: "causal",
      support: overrides.support ?? [],
    },
    lines: [{ lineNumber: 1, text: "causal" }],
    startLine: 1,
    lineCount: 1,
    totalLineCount: 3,
    hasMoreBefore: true,
    hasMoreAfter: true,
    cursorLine: 1,
    viewportLineCount: 1,
    truncated: false,
  };
}
