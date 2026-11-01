// SPDX-License-Identifier: Apache-2.0 OR LicenseRef-MIND-UCAL-1.0
// © James Ross Ω FLYING•ROBOTS <https://github.com/flyingrobots>
import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const args = process.argv.slice(2);
assert.equal(args.length, 3, 'usage: check-retained-inputs.mjs RUNTIME OUTPUT EVIDENCE_SHA256');
const [runtime, output, evidence] = args;
const scratch = mkdtempSync(path.join(os.tmpdir(), 'jim-boundary-bindings-'));
function run(root) {
  const result = spawnSync(runtime, [root, evidence], {
    encoding: 'utf8', timeout: 120000, maxBuffer: 1024 * 1024,
  });
  assert.ifError(result.error);
  assert.equal(result.signal, null);
  return result;
}
try {
  const copied = path.join(scratch, 'copied');
  cpSync(output, copied, { recursive: true });
  const baseline = run(copied);
  assert.equal(baseline.status, 0, baseline.stderr);
  assert.ok(baseline.stdout.includes('JIM_TEXT_BOUNDARY_RUNTIME_OK 61 cases'));
  const cases = [
    ['src/Boundary.edict', 'selected source/configuration changed'],
    ['.build/echo-provider/components/lowerer.echo-dpo.component.wasm', 'selected provider/vendor bytes changed'],
    ['executable-operation-package.cbor', 'emitted artifacts changed'],
    ['verification-report.cbor', 'emitted artifacts changed'],
    ['evidence.json', 'compiler evidence substitution'],
  ];
  for (const [relative, reason] of cases) {
    const file = path.join(copied, relative);
    const original = readFileSync(file);
    try {
      writeFileSync(file, Buffer.concat([original, Buffer.from([0])]));
      const refusal = run(copied);
      assert.equal(refusal.status, 1, refusal.stderr);
      assert.ok(refusal.stderr.includes(reason), refusal.stderr);
      assert.ok(!refusal.stdout.includes('JIM_TEXT_BOUNDARY_RUNTIME_OK'));
      console.log('RETAINED_INPUT_REFUSED', relative, reason);
    } finally {
      writeFileSync(file, original);
    }
  }
  console.log('JIM_TEXT_BOUNDARY_INPUT_BINDINGS_OK 5 refused substitutions');
} finally {
  rmSync(scratch, { recursive: true, force: true });
}
