import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { importDist } from './dist-helpers.mjs';

test('filesystem previews bound bytes and lines and report binary or unavailable files', async () => {
  const { filePreviewSource } = await importDist('adapters', 'file-preview.js');
  const dir = mkdtempSync(join(tmpdir(), 'jedit-preview-spec-'));
  const large = join(dir, 'large.txt');
  writeFileSync(large, '界'.repeat(40000));
  const truncated = filePreviewSource.loadFilePreview(large);
  assert.equal(truncated.kind, 'loaded');
  assert.equal(truncated.truncated, true);
  assert.ok(Buffer.byteLength(truncated.lines.join('\n')) <= 65536);
  assert.ok(!truncated.lines.join('').includes('�'));
  const many = join(dir, 'many.txt');
  writeFileSync(many, 'line\n'.repeat(250));
  const lines = filePreviewSource.loadFilePreview(many);
  assert.equal(lines.lines.length, 200);
  assert.equal(lines.truncated, true);
  const binary = join(dir, 'binary');
  writeFileSync(binary, Buffer.from([0, 1, 2]));
  assert.equal(filePreviewSource.loadFilePreview(binary).kind, 'binary');
  assert.equal(filePreviewSource.loadFilePreview(join(dir, 'missing')).kind, 'unavailable');
  assert.equal(filePreviewSource.loadFilePreview(dir).kind, 'unavailable');
});

 test('a named pipe cannot block the preview reader', async (context) => {
  const { filePreviewSource } = await importDist('adapters', 'file-preview.js');
  const dir = mkdtempSync(join(tmpdir(), 'jedit-preview-pipe-'));
  const pipe = join(dir, 'pipe');
  const created = spawnSync('mkfifo', [pipe]);
  if (created.error?.code === 'ENOENT') { context.skip('mkfifo unavailable'); return; }
  assert.equal(created.status, 0);
  const script = `import {filePreviewSource} from ${JSON.stringify(new URL('../dist/adapters/file-preview.js', import.meta.url).href)};` +
    `process.stdout.write(JSON.stringify(filePreviewSource.loadFilePreview(${JSON.stringify(pipe)})));`;
  const result = spawnSync(process.execPath, ['--input-type=module', '-e', script], { timeout: 1000, encoding: 'utf8' });
  assert.equal(result.error, undefined);
  assert.equal(JSON.parse(result.stdout).kind, 'unavailable');
  assert.equal(filePreviewSource.loadFilePreview(dir).kind, 'unavailable');
});
