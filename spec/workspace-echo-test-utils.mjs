import assert from 'node:assert/strict';
import { createWorkspaceEchoAppHarness } from './workspace-echo-app-harness.mjs';

export async function openedHarness(options = {}) {
  const harness = await createWorkspaceEchoAppHarness({
    readings: ['before edit', 'after edit'],
    ...options,
  });
  await harness.runFirst(await harness.key('enter'));
  harness.setModel({
    ...harness.model,
    focusPane: 'editor',
    fileDrawerOpen: false,
  });
  return harness;
}

export async function twoFileHarness(options = {}) {
  return createWorkspaceEchoAppHarness({
    filePath: '/repo/a.txt',
    fileName: 'a.txt',
    entries: [
      { kind: 'file', name: 'a.txt', path: '/repo/a.txt' },
      { kind: 'file', name: 'b.txt', path: '/repo/b.txt' },
    ],
    bufferIdByKey: new Map([
      ['/repo/a.txt', 'buffer:a'],
      ['/repo/b.txt', 'buffer:b'],
    ]),
    ...options,
  });
}

export async function openFileDrawerIndex(harness, selectedIndex) {
  harness.setModel({
    ...harness.model,
    fileDrawerOpen: true,
    focusPane: 'files',
    selectedIndex,
  });
}

export function echoTextDocument(initialText) {
  let text = initialText;
  return {
    insert(startByte, insertText) {
      text = `${text.slice(0, startByte)}${insertText}${text.slice(startByte)}`;
    },
    replace(nextText) {
      text = nextText;
    },
    lines() {
      return text.split('\n');
    },
  };
}

export function observedDocumentWindow(document, sequence, request) {
  const lines = document.lines();
  const startLine = Math.max(0, request.aperture.cursorLine);
  const visibleLines = lines.slice(startLine, startLine + request.aperture.viewportLineCount);
  return {
    kind: 'observed',
    observed: {
      value: {
        readingId: `reading:${sequence}`,
        lines: visibleLines.map((text, index) => ({
          lineNumber: startLine + index,
          startByte: byteOffsetAtLine(lines, startLine + index),
          endByte: byteOffsetAtLine(lines, startLine + index) + Buffer.byteLength(text, 'utf8'),
          text,
        })),
        startLine,
        lineCount: visibleLines.length,
        totalLineCount: lines.length,
        hasMoreBefore: startLine > 0,
        hasMoreAfter: startLine + visibleLines.length < lines.length,
        cursorLine: request.aperture.cursorLine,
        viewportLineCount: request.aperture.viewportLineCount,
        truncated: false,
      },
    },
  };
}

export function deferred() {
  let resolve;
  const promise = new Promise((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

export async function waitForPendingInsertCount(pendingInserts, count) {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    if (pendingInserts.length >= count) {
      return;
    }
    await Promise.resolve();
  }
  assert.equal(pendingInserts.length, count);
}

export async function applyWorkspaceMessage(harness, message) {
  const [nextModel] = harness.runtime.update(message, harness.model);
  harness.setModel(nextModel);
}

export function byteOffsetAtLine(lines, targetLine) {
  let offset = 0;
  for (let line = 0; line < targetLine; line += 1) {
    offset += Buffer.byteLength(lines[line] ?? '', 'utf8') + 1;
  }
  return offset;
}
