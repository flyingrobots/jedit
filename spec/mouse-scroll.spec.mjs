import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';
import { REPO_ROOT, ensureDistBuilt } from './dist-helpers.mjs';

const MODULE_PATH = path.join(REPO_ROOT, 'dist', 'ui', 'mouse-scroll.js');
const TERMINAL_MOUSE_PATH = path.join(REPO_ROOT, 'dist', 'ui', 'terminal-mouse.js');

async function loadMouseModules() {
  await ensureDistBuilt();

  return {
    mouseScroll: await import(pathToFileURL(MODULE_PATH).href),
    terminalMouse: await import(pathToFileURL(TERMINAL_MOUSE_PATH).href),
  };
}

function mouse(action) {
  return {
    type: 'mouse',
    action,
    button: 'none',
    col: 0,
    row: 0,
    shift: false,
    alt: false,
    ctrl: false,
  };
}

test('jedit enables terminal mouse reporting so scrollback does not consume the wheel', async () => {
  const { terminalMouse } = await loadMouseModules();

  assert.equal(terminalMouse.JEDIT_TERMINAL_MOUSE_OPTIONS.mouse, true);
});

test('mouse wheel events become stable jedit scroll deltas', async () => {
  const { mouseScroll } = await loadMouseModules();

  assert.equal(mouseScroll.mouseScrollDeltaRows(mouse('scroll-up')), -mouseScroll.MOUSE_SCROLL_LINE_STEP);
  assert.equal(mouseScroll.mouseScrollDeltaRows(mouse('scroll-down')), mouseScroll.MOUSE_SCROLL_LINE_STEP);
  assert.equal(mouseScroll.mouseScrollDeltaRows(mouse('press')), 0);
});
