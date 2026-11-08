import assert from 'node:assert/strict';
import test from 'node:test';
import { importDist, mockRuntime } from './workspace-helpers.mjs';
const entry = { kind: 'file', name: 'main.ts', path: '/repo/main.ts' };
const key = (key, flags = {}) => ({ type: 'key', key, ...flags });
async function setup(options = {}) {
  const { createWorkspaceRuntime } = await importDist('app', 'workspace', 'runtime.js');
  const { BijouI18nAdapter } = await importDist('adapters', 'bijou-i18n-adapter.js');
  const { availableJeditThemes } = await importDist('ui', 'jedit-themes.js');
  const { createGraftSourceHighlighter } = await importDist('adapters', 'graft-source-highlighter.js');
  const deps = mockRuntime(); const reads = [];
  deps.initialModel.entries = [entry]; deps.initialModel.i18n = new BijouI18nAdapter();
  deps.initialModel.jeditTheme = availableJeditThemes()[0];
  deps.previewHighlighter = options.highlighter ?? createGraftSourceHighlighter();
  deps.filePreviewSource = { loadFilePreview: (path) => {
    reads.push(path); return { kind: 'loaded', lines: options.lines ?? ['export const answer = 42;'], truncated: options.truncated ?? false };
  } };
  const runtime = createWorkspaceRuntime(deps);
  return { runtime, reads, model: { ...runtime.init()[0], ...options.model }, deps };
}
async function preview(fixture) {
  const [opened, commands] = fixture.runtime.update(key('b', { ctrl: true }), fixture.model);
  const message = await commands.at(-1)();
  return fixture.runtime.update(message, { ...opened, fileDrawerProgress: 1 })[0];
}
const rowText = (surface, row) => Array.from({ length: surface.width }, (_, x) => surface.get(x, row).char).join('');

test('Real Graft syntax colors reach the read-only preview without opening an Echo buffer', async () => {
  const fixture = await setup(); const next = await preview(fixture);
  assert.ok(next.fileExplorerPreview.highlight.spans.length > 0);
  const { renderFileExplorerPreview } = await importDist('app', 'workspace', 'file-explorer-preview-view.js');
  const { JEDIT_SOURCE_TOKEN } = await importDist('ui', 'jedit-theme.js');
  const surface = renderFileExplorerPreview(next, 60, 12);
  assert.match(rowText(surface, 3), /export const answer = 42/);
  assert.equal(surface.get(1, 3).fg, next.jeditTheme.source.get(JEDIT_SOURCE_TOKEN.Keyword).fg);
  assert.equal(surface.get(23, 3).fg, next.jeditTheme.source.get(JEDIT_SOURCE_TOKEN.Number).fg);
  assert.equal(next.textAuthority, fixture.model.textAuthority); assert.equal(next.textRequestId, fixture.model.textRequestId);
});

test('Preview Graft projections omit an editor-head basis', async () => {
  const { createGraftSourceHighlighter } = await importDist('adapters', 'graft-source-highlighter.js');
  const calls = [];
  const highlighter = createGraftSourceHighlighter({ loadRuntime: async () => ({ ensureParserReady: async () => {},
    createProjectionBundle: (path, content, options) => { calls.push({ path, content, options }); return { syntax: { spans: [] } }; } }) });
  await highlighter.highlightPreview({ path: entry.path, text: 'const x = 1', startLine: 0, lineCount: 1 });
  assert.equal('basis' in calls[0].options, false);
  await highlighter.highlight({ path: entry.path, text: 'const x = 1', startLine: 0, lineCount: 1, headId: 'real-head', tick: 2 });
  assert.deepEqual(calls[1].options.basis, { kind: 'editor_head', headId: 'real-head', tick: 2 });
});

test('Unsaved preview text is highlighted without disk reads and parser failure keeps readable text', async () => {
  const inputs = [];
  const editor = { path: entry.path, lines: ['\tconst unsaved = 7;\u001b'], dirty: true };
  const fixture = await setup({ model: { editor }, highlighter: { highlightPreview: async (input) => {
    inputs.push(input); throw new Error('parser unavailable');
  } } });
  const next = await preview(fixture);
  assert.deepEqual(fixture.reads, []); assert.equal(inputs[0].text, '    const unsaved = 7;');
  assert.equal(next.editor, editor); assert.equal(next.textAuthority, fixture.model.textAuthority);
  const { renderFileExplorerPreview } = await importDist('app', 'workspace', 'file-explorer-preview-view.js');
  assert.match(rowText(renderFileExplorerPreview(next, 60, 12), 3), /const unsaved = 7/);
});

test('Preview highlights align after tabs, wide Unicode and a truncation notice without coloring the notice', async () => {
  const fixture = await setup({ lines: ['\tconst 界 = 42;'], truncated: true }); const next = await preview(fixture);
  const { renderFileExplorerPreview } = await importDist('app', 'workspace', 'file-explorer-preview-view.js');
  const { JEDIT_SOURCE_TOKEN } = await importDist('ui', 'jedit-theme.js');
  const surface = renderFileExplorerPreview(next, 60, 12);
  assert.match(rowText(surface, 3), /truncated/i); assert.match(rowText(surface, 4), /const.*42/);
  assert.equal(surface.get(5, 4).fg, next.jeditTheme.source.get(JEDIT_SOURCE_TOKEN.Keyword).fg);
  const x = Array.from({ length: surface.width }, (_, x) => x).find((x) => surface.get(x, 4).char === '4');
  assert.equal(surface.get(x, 4).fg, next.jeditTheme.source.get(JEDIT_SOURCE_TOKEN.Number).fg);
});

test('A late highlighted preview cannot repaint a closed drawer or a different selection', async () => {
  const fixture = await setup(); const [opened, commands] = fixture.runtime.update(key('b', { ctrl: true }), fixture.model);
  const [closed] = fixture.runtime.update(key('b', { ctrl: true }), opened); const message = await commands.at(-1)();
  assert.ok(message.highlight.spans.length > 0);
  const [late] = fixture.runtime.update(message, closed); assert.equal(late.fileExplorerPreview, undefined);
  assert.equal(late.textAuthority, fixture.model.textAuthority);
  const other = { kind: 'file', name: 'other.ts', path: '/repo/other.ts' };
  const two = await setup({ model: { entries: [entry, other] } });
  const [first, firstCommands] = two.runtime.update(key('b', { ctrl: true }), two.model);
  const [moved] = two.runtime.update(key('j'), { ...first, fileDrawerProgress: 1 });
  assert.equal(moved.entries[moved.selectedIndex], other);
  const [stale] = two.runtime.update(await firstCommands.at(-1)(), moved);
  assert.equal(stale.fileExplorerPreview.entry, other); assert.equal(stale.fileExplorerPreview.result, undefined);
});

test('A modified open buffer with an off-head reading window reports unsaved changes instead of previewing disk', async () => {
  const fixture = await setup();
  const { WorkspaceTextAuthorityKinds } = await importDist('app', 'workspace', 'workspace-text-authority.js');
  const opened = (dirty, cache) => ({
    ...fixture.model.textAuthority, kind: WorkspaceTextAuthorityKinds.Opened, filePath: entry.path, bufferId: 'b1', dirty, cache,
  });
  const window = { startLine: 500, lines: ['CACHE line 501'], totalLineCount: 1000, truncated: true };
  const dirty = await preview({ ...fixture, model: { ...fixture.model, textAuthority: opened(true, window) } });
  assert.deepEqual(fixture.reads, []); assert.equal(dirty.fileExplorerPreview.result.kind, 'unsaved-buffer');
  const { renderFileExplorerPreview } = await importDist('app', 'workspace', 'file-explorer-preview-view.js');
  assert.match(rowText(renderFileExplorerPreview(dirty, 60, 12), 3), /unsaved/i);
  const clean = await preview({ ...fixture, model: { ...fixture.model, textAuthority: opened(false, undefined) } });
  assert.deepEqual(fixture.reads, [entry.path]); assert.equal(clean.fileExplorerPreview.result.kind, 'loaded');
});

test('A dirty dormant buffer or a dirty editor projection also reports unsaved changes instead of disk', async () => {
  const fixture = await setup();
  const { WorkspaceTextAuthorityKinds } = await importDist('app', 'workspace', 'workspace-text-authority.js');
  const window = { startLine: 500, lines: ['CACHE line 501'], totalLineCount: 1000, truncated: true };
  const opened = (path, dirty) => ({
    ...fixture.model.textAuthority, kind: WorkspaceTextAuthorityKinds.Opened, filePath: path, bufferId: path, dirty, cache: window,
  });
  const record = { bufferId: entry.path, pathBinding: entry.path, textAuthority: opened(entry.path, true),
    editorProjection: { path: entry.path, lines: ['PROJECTED'], dirty: true }, materializationState: 0, graftSelectedIndex: 0, lastActivatedAt: 0 };
  const dormant = await preview({ ...fixture, model: { ...fixture.model, textAuthority: opened('/repo/other.ts', false), buffers: { [entry.path]: record } } });
  assert.deepEqual(fixture.reads, []); assert.equal(dormant.fileExplorerPreview.result.kind, 'unsaved-buffer');
  const editor = { path: entry.path, lines: ['EDITED'], dirty: true };
  const projected = await preview({ ...fixture, model: { ...fixture.model, textAuthority: opened(entry.path, false), editor } });
  assert.deepEqual(fixture.reads, []); assert.equal(projected.fileExplorerPreview.result.kind, 'unsaved-buffer');
});
