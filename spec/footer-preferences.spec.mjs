import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtempSync, readFileSync, writeFileSync, statSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { importDist } from './workspace-helpers.mjs';

async function fixture() {
  const { createFooterPreferences } = await importDist('adapters', 'footer-preferences.js');
  const path = join(mkdtempSync(join(tmpdir(), 'jim-footer-prefs-')), '.jimrc');
  return { path, create: () => createFooterPreferences(path) };
}
test('Footer layout survives a fresh preferences instance and preserves unrelated JSON bytes', async () => {
  const { path, create } = await fixture();
  assert.equal(create().load(), 'focused');
  const source = '{\n  "leader": " ", "counter": 9007199254740993123, "nested": {"footerLayout":"other"}\n}\n';
  writeFileSync(path, source, { mode: 0o640 });
  assert.deepEqual(create().save('compact'), { ok: true });
  assert.equal(create().load(), 'compact');
  assert.ok(readFileSync(path, 'utf8').includes('"counter": 9007199254740993123'));
  assert.ok(readFileSync(path, 'utf8').includes('"nested": {"footerLayout":"other"}'));
  assert.equal(statSync(path).mode & 0o777, 0o640);
  const before = readFileSync(path, 'utf8');
  assert.deepEqual(create().save('per-pane'), { ok: true });
  assert.equal(readFileSync(path, 'utf8'), before.replace('"compact"', '"per-pane"'));
});
test('Missing preferences can be created with private permissions', async () => {
  const { path, create } = await fixture();
  assert.deepEqual(create().save('compact'), { ok: true });
  assert.equal(create().load(), 'compact');
  assert.equal(statSync(path).mode & 0o777, 0o600);
});
test('Malformed, non-object and duplicate footer preferences are never overwritten', async () => {
  const { path, create } = await fixture();
  for (const source of ['{bad', '[]', 'null', '{"footerLayout":"compact","footerLayout":"focused"}']) {
    writeFileSync(path, source);
    assert.equal(create().load(), 'focused');
    assert.equal(create().save('per-pane').ok, false);
    assert.equal(readFileSync(path, 'utf8'), source);
  }
});
test('Escaped keys and nested values are handled without replacing unrelated content', async () => {
  const { path, create } = await fixture();
  writeFileSync(path, '{"footer\\u004cayout": {"a":["}","\\\""]}, "keep": [1,2]}');
  assert.deepEqual(create().save('compact'), { ok: true });
  assert.equal(readFileSync(path, 'utf8'), '{"footer\\u004cayout": "compact", "keep": [1,2]}');
});
test('An existing jimrc symlink retains its target and identity', async () => {
  const { path, create } = await fixture();
  const target = `${path}.target`;
  writeFileSync(target, '{"leader":"\\\\"}');
  symlinkSync(target, path);
  assert.deepEqual(create().save('compact'), { ok: true });
  assert.equal(create().load(), 'compact');
  assert.equal(JSON.parse(readFileSync(target, 'utf8')).footerLayout, 'compact');
});

test('The application loads a saved layout again after a new launch', async () => {
  const { path, create } = await fixture();
  const { createWorkspaceApp } = await importDist('adapters', 'workspace-app.js');
  const { mockRuntime } = await import('./workspace-helpers.mjs');
  const deps = mockRuntime();
  const options = { initialColumns: 100, initialRows: 32, initialWorkingDirectory: '/repo', perfEnabled: false,
    footerPreferences: create(), seed: deps.initialModel };
  const production = { productionTextSession: deps.productionTextSession };
  const app = createWorkspaceApp(options, production);
  let model = app.init()[0];
  assert.equal(model.footerLayout, 'focused');
  model = app.update({ type: 'key', key: 'f2' }, model)[0];
  const { settingsRows } = await importDist('app', 'workspace', 'settings.js');
  model = { ...model, settingsFocusIndex: settingsRows(model).findIndex((row) => row.id === 'footer-layout') };
  model = app.update({ type: 'key', key: 'left' }, model)[0];
  assert.equal(model.footerLayout, 'compact');
  assert.equal(JSON.parse(readFileSync(path, 'utf8')).footerLayout, 'compact');
  assert.deepEqual(create().saveFilepaths('absolute'), { ok: true });
  const restarted = createWorkspaceApp({ ...options, footerPreferences: create() }, production);
  assert.equal(restarted.init()[0].footerLayout, 'compact');
  assert.equal(restarted.init()[0].filepathStyle, 'absolute');
});
