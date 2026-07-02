import assert from 'node:assert/strict';
import { setImmediate as waitForTurn } from 'node:timers/promises';
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
      const startIndex = stringIndexFromUtf8ByteOffset(text, startByte);
      text = `${text.slice(0, startIndex)}${insertText}${text.slice(startIndex)}`;
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
  await waitForItemCount(pendingInserts, count, 'pending insert');
}

export async function waitForItemCount(items, count, label = 'item') {
  for (let attempt = 0; attempt < 25; attempt += 1) {
    if (items.length === count) {
      return;
    }
    if (items.length > count) {
      break;
    }
    await waitForTurn();
  }
  assert.equal(items.length, count, `expected ${count} ${label} entries`);
}

export async function applyWorkspaceMessage(harness, message) {
  const [nextModel, commands] = harness.runtime.update(message, harness.model);
  harness.setModel(nextModel);
  let pendingCommands = [...commands];
  while (pendingCommands.length > 0) {
    const followUpMessage = await pendingCommands[0]();
    pendingCommands = pendingCommands.slice(1);
    if (followUpMessage == null) {
      continue;
    }
    const [followUpModel, followUpCommands] = harness.runtime.update(
      followUpMessage,
      harness.model,
    );
    harness.setModel(followUpModel);
    pendingCommands = [...pendingCommands, ...followUpCommands];
  }
}

export function byteOffsetAtLine(lines, targetLine) {
  let offset = 0;
  for (let line = 0; line < targetLine; line += 1) {
    offset += Buffer.byteLength(lines[line] ?? '', 'utf8') + 1;
  }
  return offset;
}

function stringIndexFromUtf8ByteOffset(text, byteOffset) {
  if (byteOffset <= 0) {
    return 0;
  }
  let bytes = 0;
  for (let index = 0; index < text.length;) {
    const codePoint = text.codePointAt(index);
    const character = String.fromCodePoint(codePoint);
    const nextBytes = bytes + Buffer.byteLength(character, 'utf8');
    if (nextBytes > byteOffset) {
      return index;
    }
    bytes = nextBytes;
    index += character.length;
    if (bytes === byteOffset) {
      return index;
    }
  }
  return text.length;
}
