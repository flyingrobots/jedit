// SPDX-License-Identifier: Apache-2.0 OR LicenseRef-MIND-UCAL-1.0
// © James Ross Ω FLYING•ROBOTS <https://github.com/flyingrobots>
// Public primitive packages and their first unsupported source boundaries.
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { test } from 'node:test';

type Fact = { status: string; basis?: string };
type Observation = { name: string; source: Fact; core: Fact; target: Fact; providerLowerer: Fact;
    verifier: Fact; runtime: Fact; fullOperation: Fact; firstRefusal?: { kind: string; stage: string } };
type Stages = { schema: string; inventorySha256: string; cases: Observation[] };
class PrimitiveFailure extends Error {}

function required(name: string): string {
    const value = process.env[name];
    if (!value) throw new PrimitiveFailure('missing environment: ' + name);
    return value;
}

function sha(bytes: Buffer): string {
    return createHash('sha256').update(bytes).digest('hex');
}

if (!existsSync('/.dockerenv')) throw new PrimitiveFailure('run in the guarded Docker worker');
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
    assert.equal(value.cases.length, 15);
    const cases = value.cases.filter(item => item.name === name);
    assert.equal(cases.length, 1);
    return cases[0];
}

test('constrained subtraction, slicing, byte metrics and existing controls execute 28 inputs', () => {
    assert.equal(result.status, 0, result.stderr);
    assert.equal((result.stdout.match(/RUNTIME_CASE_OK/g) ?? []).length, 28);
    for (const name of ['subtraction-constrained', 'byte-slice-intent', 'byte-metrics']) {
        const item = selected(name);
        assert.deepEqual(item.verifier, { status: 'accepted', basis: 'bound-verification-report' });
        assert.deepEqual(item.runtime, { status: 'accepted', basis: 'generic-pure-boundary-witness' });
        assert.equal(item.fullOperation.status, 'unmeasured');
    }
});

const refusals = [['dynamic-fold-negative', 'InvalidBound', 'typeCheck'],
    ['unsafe-subtraction-negative', 'UnsupportedSourceShape', 'typeCheck'],
    ['function-precondition', 'ExpectedToken', 'parse'], ['pure-typed-failure', 'ExpectedToken', 'parse'],
    ['minimum', 'UnresolvedFunction', 'typeCheck'], ['maximum', 'UnresolvedFunction', 'typeCheck']];
for (const [name, kind, stage] of refusals) {
    test(name + ' preserves the first source refusal and leaves later stages unreached', () => {
        const item = selected(name);
        assert.equal(item.firstRefusal?.kind, kind);
        assert.equal(item.firstRefusal?.stage, stage);
        assert.deepEqual(item.source, { status: 'refused', basis: 'public-diagnostic' });
        for (const fact of [item.core, item.target, item.providerLowerer, item.verifier, item.runtime]) {
            assert.equal(fact.status, 'unreached');
        }
    });
}

for (const name of ['subtraction-helper', 'byte-slice-helper']) {
    test(name + ' reaches the provider while its verifier and runtime remain unreached', () => {
        const item = selected(name);
        assert.equal(item.firstRefusal?.kind, 'ProviderLowererRefused');
        for (const fact of [item.source, item.core, item.target]) {
            assert.deepEqual(fact, { status: 'accepted', basis: 'pinned-public-command-order' });
        }
        assert.deepEqual(item.providerLowerer, { status: 'refused', basis: 'public-diagnostic' });
        assert.equal(item.verifier.status, 'unreached');
        assert.equal(item.runtime.status, 'unreached');
    });
}
