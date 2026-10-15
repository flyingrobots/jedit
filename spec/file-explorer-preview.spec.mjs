import assert from 'node:assert/strict';
import test from 'node:test';
import { importDist, mockRuntime } from './workspace-helpers.mjs';

const entries = [
  { kind: 'file', name: 'alpha.txt', path: '/repo/alpha.txt' },
  { kind: 'file', name: 'beta.txt', path: '/repo/beta.txt' },
];
const key = (key, flags = {}) => ({ type: 'key', key, ...flags });
async function setup() {
  const { createWorkspaceRuntime } = await importDist('app', 'workspace', 'runtime.js');
  const { BijouI18nAdapter } = await importDist('adapters', 'bijou-i18n-adapter.js');
  const reads = [];
  const deps = mockRuntime();
  deps.initialModel.entries = entries;
  deps.initialModel.i18n = new BijouI18nAdapter();
  const { availableJeditThemes } = await importDist('ui', 'jedit-themes.js');
  deps.initialModel.jeditTheme = availableJeditThemes()[0];
  deps.filePreviewSource = { loadFilePreview: (path) => {
    reads.push(path);
    return { kind: 'loaded', lines: [`PREVIEW ${path}`], truncated: false };
  } };
  const runtime = createWorkspaceRuntime(deps);
  const model = { ...runtime.init()[0], startupIntroComplete: true };
  return { runtime, model, reads };
}
function text(surface) {
  return Array.from({ length: surface.height }, (_, y) => (
    Array.from({ length: surface.width }, (_, x) => surface.get(x, y).char).join('')
  )).join('\n');
}

test('selection previews in the main viewer without replacing editor state or opening an Echo buffer', async () => {
  const { runtime, model, reads } = await setup();
  const [opened, commands] = runtime.update(key('b', { ctrl: true }), model);
  assert.equal(opened.focusPane, 'files');
  assert.equal(opened.textAuthority, model.textAuthority);
  assert.ok(commands.length > 0);
  const message = await commands.at(-1)();
  const [preview] = runtime.update(message, { ...opened, fileDrawerProgress: 1 });
  assert.match(text(runtime.view(preview)), /Preview.*alpha.txt/);
  assert.match(text(runtime.view(preview)), /PREVIEW.*alpha.txt/);
  assert.deepEqual(reads, ['/repo/alpha.txt']);
  assert.equal(preview.editor, model.editor);
  assert.equal(preview.textAuthority, model.textAuthority);
  assert.equal(preview.textRequestId, model.textRequestId);
  assert.equal(preview.focusPane, 'files');
  const [closed] = runtime.update(key('b', { ctrl: true }), preview);
  assert.doesNotMatch(text(runtime.view(closed)), /PREVIEW/);
});

test('late preview results cannot paint a different selection and hover never reads a file', async () => {
  const { runtime, model, reads } = await setup();
  const [opened, first] = runtime.update(key('b', { ctrl: true }), model);
  const [next, second] = runtime.update(key('j'), opened);
  const firstMessage = await first.at(-1)();
  const [late] = runtime.update(firstMessage, next);
  assert.equal(late.fileExplorerPreview.entry.path, '/repo/beta.txt');
  assert.equal(late.fileExplorerPreview.result, undefined);
  const secondMessage = await second.at(-1)();
  const [loaded] = runtime.update(secondMessage, next);
  assert.equal(loaded.fileExplorerPreview.result.lines[0], 'PREVIEW /repo/beta.txt');
  const [, hoverCommands] = runtime.update({ type: 'mouse', action: 'move', button: 'none', col: 5, row: 5 }, {
    ...loaded, fileDrawerProgress: 1,
  });
  assert.deepEqual(hoverCommands, []);
  assert.equal(reads.length, 2);
});

test('the active unsaved buffer projection is previewed without filesystem reads or mutation', async () => {
  const { runtime, model, reads } = await setup();
  const editor = { path: '/repo/alpha.txt', lines: ['UNSAVED CONTENT'], dirty: true };
  const initial = { ...model, editor };
  const [opened] = runtime.update(key('b', { ctrl: true }), initial);
  assert.equal(opened.fileExplorerPreview.result.lines[0], 'UNSAVED CONTENT');
  assert.deepEqual(reads, []);
  assert.equal(opened.editor, editor);
  assert.equal(opened.textAuthority, initial.textAuthority);
});

 test('click selection previews without opening and closing rejects its outstanding result', async () => {
  const { runtime, model } = await setup();
  const [opened] = runtime.update(key('b', { ctrl: true }), model);
  const [selected, commands] = runtime.update({ type: 'mouse', action: 'press', button: 'left', col: 5, row: 5 }, {
    ...opened, fileDrawerProgress: 1,
  });
  assert.equal(selected.selectedIndex, 1);
  assert.equal(selected.focusPane, 'files');
  assert.equal(selected.textRequestId, model.textRequestId);
  const message = await commands.at(-1)();
  const [closed] = runtime.update(key('b', { ctrl: true }), selected);
  const [late] = runtime.update(message, closed);
  assert.equal(late.fileExplorerPreview, undefined);
  assert.equal(late.textAuthority, model.textAuthority);
});
