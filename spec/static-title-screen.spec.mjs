import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { pathToFileURL } from 'node:url';
import { importDist, mockRuntime, mockJeditTheme, REPO_ROOT } from './workspace-helpers.mjs';

async function setup() {
  const module = await importDist('app', 'workspace', 'runtime.js');
  const deps = mockRuntime();
  const { BijouI18nAdapter } = await importDist('adapters', 'bijou-i18n-adapter.js');
  deps.initialModel.i18n = new BijouI18nAdapter();
  deps.initialModel.jeditTheme = mockJeditTheme();
  const runtime = module.createWorkspaceRuntime(deps);
  const model = { ...runtime.init()[0], startupIntroComplete: true };
  return { runtime, model };
}

function cells(surface) {
  return Array.from({ length: surface.height }, (_, y) => (
    Array.from({ length: surface.width }, (_, x) => surface.get(x, y))
  ));
}

test('former title camera, shader, material, and scene-picker keys leave the static logo unchanged', async () => {
  const { runtime, model } = await setup();
  const baseline = cells(runtime.view(model));
  for (const [key, modifiers] of [
    ['space', {}], [' ', {}], ['w', {}], ['a', {}], ['s', {}], ['d', {}],
    ['up', {}], ['down', {}], ['left', {}], ['right', {}], ['shift', {}],
    ['1', {}], ['2', {}], ['.', {}], ['m', {}], ['M', {}], ['l', { ctrl: true }],
  ]) {
    const [next, commands] = runtime.update({ type: 'key', key, ...modifiers }, model);
    assert.deepEqual(cells(runtime.view(next)), baseline, key);
    assert.deepEqual(commands, [], key);
    assert.equal(next, model, `${key} should not change idle title state`);
  }
});

test('pointer movement does not activate a camera or change the title logo', async () => {
  const { runtime, model } = await setup();
  const baseline = cells(runtime.view(model));
  let next = model;
  for (const [col, row] of [[20, 10], [24, 12], [70, 15]]) {
    const [updated, commands] = runtime.update({ type: 'mouse', action: 'move', button: 'none', col, row }, next);
    assert.equal(updated, next);
    assert.deepEqual(commands, []);
    assert.deepEqual(cells(runtime.view(updated)), baseline);
    next = updated;
  }
});

test('stale scene and camera messages cannot change the workspace or reactivate animation', async () => {
  const { runtime, model } = await setup();
  for (const message of [
    { type: 'load-scene-result', scene: { camera: { position: [0, 0, 1], target: [0, 0, 0], up: [0, 1, 0], fov: 60 } } },
    { type: 'title-camera-frame', motionId: 1, value: 1 },
  ]) {
    const [next, commands] = runtime.update(message, model);
    assert.equal(next, model);
    assert.deepEqual(commands, []);
  }
  const [idle] = runtime.update({ type: 'time-tick', time: 30 }, model);
  assert.equal(idle, model);
});

test('legacy scene properties cannot select a ray-traced viewer', async () => {
  const { model } = await setup();
  const { renderViewer } = await importDist('app', 'workspace', 'viewer-content.js');
  const baseline = cells(renderViewer(model, 100, 28));
  const stale = { ...model, titleBackdropKind: 'legacy-scene', sceneOverride: undefined, titleRenderMode: 'ascii' };
  assert.deepEqual(cells(renderViewer(stale, 100, 28)), baseline);
});

test('the static title retains Settings, Files, and quit confirmation without advertising scene selection', async () => {
  const { runtime, model } = await setup();
  assert.equal(runtime.update({ type: 'key', key: 'f2' }, model)[0].settingsOpen, true);
  assert.equal(runtime.update({ type: 'key', key: 'b', ctrl: true }, model)[0].fileDrawerOpen, true);
  assert.equal(runtime.update({ type: 'key', key: 'escape' }, model)[0].quitConfirmOpen, true);
  const rendered = cells(runtime.view(model)).map((row) => row.map((cell) => cell.char).join('')).join('\n');
  assert.doesNotMatch(rendered, /scene picker|ctrl\+l/i);
});

test('the production workspace module graph does not load the ray tracer or scene loader', async (t) => {
  await importDist('adapters', 'workspace-app.js');
  const directory = mkdtempSync(path.join(tmpdir(), 'jim-static-modules-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const log = path.join(directory, 'loaded.txt');
  const loader = path.join(directory, 'loader.mjs');
  writeFileSync(loader, `import { appendFileSync } from 'node:fs';
export async function load(url, context, nextLoad) {
  appendFileSync(${JSON.stringify(log)}, url + '\\n');
  return nextLoad(url, context);
}\n`);
  const entry = pathToFileURL(path.join(REPO_ROOT, 'dist', 'adapters', 'workspace-app.js')).href;
  const result = spawnSync(process.execPath, ['--no-warnings', '--experimental-loader', loader,
    '--input-type=module', '-e', `await import(${JSON.stringify(entry)});`], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  const loaded = readFileSync(log, 'utf8');
  for (const forbidden of ['/ui/title-screen.js', '/ui/title-scene.js', '/app/title-camera-session.js', '/adapters/title-scene-loader.js']) {
    assert.equal(loaded.includes(forbidden), false, forbidden);
  }
});
