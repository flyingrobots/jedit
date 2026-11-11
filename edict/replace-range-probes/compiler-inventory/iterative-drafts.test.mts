// SPDX-License-Identifier: Apache-2.0 OR LicenseRef-MIND-UCAL-1.0
// © James Ross Ω FLYING•ROBOTS <https://github.com/flyingrobots>
// Measure unchanged drafts without substituting their requested lawpack version.
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { test } from 'node:test';

type Fact = { status: string; basis?: string };
type Observation = { name: string; source: Fact; core: Fact; target: Fact; providerLowerer: Fact;
    verifier: Fact; runtime: Fact; fullOperation: Fact; firstRefusal?: { kind: string; stage: string; message: string } };
type Stages = { schema: string; inventorySha256: string; cases: Observation[] };
class DraftFailure extends Error {}

function required(name: string): string {
    const value = process.env[name];
    if (!value) throw new DraftFailure('missing environment: ' + name);
    return value;
}

function sha(bytes: Buffer): string {
    return createHash('sha256').update(bytes).digest('hex');
}

if (!existsSync('/.dockerenv')) throw new DraftFailure('run in the guarded Docker worker');
const input = required('INVENTORY_INPUT');
const pin = required('INVENTORY_REPORT_SHA256');
const binary = required('INVENTORY_RUNTIME');
const output = required('INVENTORY_TEST_OUTPUT');
assert.equal(sha(readFileSync(path.join(input, 'report.json'))), pin);
mkdirSync(output);
const result = spawnSync(binary, [input, pin], { encoding: 'utf8', timeout: 30_000, maxBuffer: 256 * 1024 });
writeFileSync(path.join(output, 'stdout.log'), result.stdout ?? '', { flag: 'wx' });
writeFileSync(path.join(output, 'stderr.log'), result.stderr ?? '', { flag: 'wx' });
writeFileSync(path.join(output, 'process.json'), JSON.stringify({ status: result.status, signal: result.signal,
    error: result.error?.message, input, pin, binary, binarySha256: sha(readFileSync(binary)) }, null, 2) + '\n', { flag: 'wx' });

function selected(name: string): Observation {
    assert.equal(result.error, undefined);
    assert.equal(result.signal, null);
    const line = result.stdout.split('\n').find(line => line.startsWith('STAGE_INVENTORY '));
    assert.ok(line, 'the consumer must emit per-case stage evidence');
    const value: Stages = JSON.parse(line.slice('STAGE_INVENTORY '.length));
    assert.equal(value.schema, 'jedit.iterative-stages/v1');
    assert.equal(value.inventorySha256, pin);
    assert.equal(value.cases.length, 10);
    const cases = value.cases.filter(item => item.name === name);
    assert.equal(cases.length, 1);
    return cases[0];
}

test('existing generic controls execute alongside the unchanged authored drafts', () => {
    assert.equal(result.status, 0, result.stderr);
    assert.equal((result.stdout.match(/RUNTIME_CASE_OK/g) ?? []).length, 4);
    assert.equal(selected('scalar-fold').runtime.status, 'accepted');
});

const closures = [
    ['draft-text', ['Text', 'Boundary']],
    ['draft-reference', ['Reference', 'Text', 'Boundary']],
    ['draft-rope', ['Rope', 'Text', 'Boundary']],
    ['draft-replace-range', ['ReplaceRange', 'Text', 'Boundary', 'Rope']],
] satisfies [string, string[]][];

for (const [name, modules] of closures) {
    test(name + ' preserves its entire source closure and first parse refusal', () => {
        const item = selected(name);
        assert.equal(item.firstRefusal?.stage, 'parse');
        assert.equal(item.source.status, 'refused');
        for (const stage of [item.core, item.target, item.providerLowerer, item.verifier, item.runtime]) {
            assert.equal(stage.status, 'unreached');
        }
        assert.equal(item.fullOperation.status, 'unmeasured');
        const paths = modules.map((module, index) => index === 0 ? 'src/Probe.edict' : 'src/drafts/' + module + '.edict');
        const config = JSON.parse(readFileSync(path.join(input, name, 'edict.application.json'), 'utf8'));
        assert.deepEqual(config.sources, paths);
        for (const [index, module] of modules.entries()) {
            assert.deepEqual(readFileSync(path.join(input, name, paths[index])),
                readFileSync(path.join(input, 'fixture-sources/drafts', module + '.edict')));
        }
    });
}

test('the draft lawpack import reaches its own undigested-import refusal', () => {
    const item = selected('missing-draft-lawpack');
    assert.equal(item.firstRefusal?.kind, 'TargetLoweringFailed');
    assert.ok(item.firstRefusal?.message.includes('UndigestedCoreImport'));
    assert.ok(item.firstRefusal?.message.includes('jedit.text@2'));
    assert.deepEqual(item.target, { status: 'refused', basis: 'public-diagnostic' });
    for (const stage of [item.providerLowerer, item.verifier, item.runtime]) assert.equal(stage.status, 'unreached');
    assert.equal(item.fullOperation.status, 'unmeasured');
});
