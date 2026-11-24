// SPDX-License-Identifier: Apache-2.0 OR LicenseRef-MIND-UCAL-1.0
// © James Ross Ω FLYING•ROBOTS <https://github.com/flyingrobots>
// Stage boundaries of structured effects through the standalone effect lawpack.
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
class EffectStageFailure extends Error {}

const CASE_COUNT = 11;
const CONTROL_RUNTIME_INPUTS = 4;
const EFFECT_VENDOR = 'vendor/jedit-inventory-effects/';

function required(name: string): string {
    const value = process.env[name];
    if (!value) throw new EffectStageFailure('missing environment: ' + name);
    return value;
}

function sha(bytes: Buffer): string {
    return createHash('sha256').update(bytes).digest('hex');
}

if (!existsSync('/.dockerenv')) throw new EffectStageFailure('run in the guarded Docker worker');
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
    assert.equal(value.cases.length, CASE_COUNT);
    const cases = value.cases.filter(item => item.name === name);
    assert.equal(cases.length, 1);
    return cases[0];
}

function accepted(stages: Fact[]): void {
    for (const stage of stages) assert.equal(stage.status, 'accepted');
}

function unreachedAfter(item: Observation, stages: Fact[]): void {
    for (const stage of [...stages, item.runtime]) assert.equal(stage.status, 'unreached');
    assert.equal(item.fullOperation.status, 'unmeasured');
}

test('generic controls still execute beside the effect cases', () => {
    assert.equal(result.status, 0, result.stderr);
    assert.equal((result.stdout.match(/RUNTIME_CASE_OK/g) ?? []).length, CONTROL_RUNTIME_INPUTS);
    assert.equal(selected('scalar-fold').runtime.status, 'accepted');
});

test('one create effect publishes through the standalone lawpack; its runtime is not measured here', () => {
    const item = selected('effect-linear');
    accepted([item.source, item.core, item.target, item.providerLowerer]);
    assert.deepEqual(item.verifier, { status: 'accepted', basis: 'bound-verification-report' });
    assert.equal(item.runtime.status, 'unmeasured');
    assert.equal(item.fullOperation.status, 'unmeasured');
    const config = JSON.parse(readFileSync(path.join(input, 'effect-linear', 'edict.application.json'), 'utf8'));
    for (const field of ['manifest', 'exports', 'adapter', 'targetConfiguration']) {
        assert.ok(config.lawpacks[0][field].startsWith(EFFECT_VENDOR));
    }
});

test('a second effect in one intent stops in the provider lowerer', () => {
    const item = selected('effect-repeated');
    assert.equal(item.firstRefusal?.kind, 'ProviderLowererRefused');
    assert.ok(item.firstRefusal?.message.includes('operation Core body must contain exactly one node'));
    accepted([item.source, item.core, item.target]);
    assert.deepEqual(item.providerLowerer, { status: 'refused', basis: 'public-diagnostic' });
    unreachedAfter(item, [item.verifier]);
});

for (const [name, node] of [['effect-branch', 'branch'], ['effect-loop', 'for'], ['effect-nested', 'for']]) {
    test(name + ' stops at Target on its first structured ' + node + ' node', () => {
        const item = selected(name);
        assert.equal(item.firstRefusal?.kind, 'TargetLoweringFailed');
        assert.ok(item.firstRefusal?.message.includes('UnsupportedCoreNode'));
        assert.ok(item.firstRefusal?.message.includes('detail: "' + node + '"'));
        accepted([item.source, item.core]);
        assert.deepEqual(item.target, { status: 'refused', basis: 'public-diagnostic' });
        unreachedAfter(item, [item.providerLowerer, item.verifier]);
    });
}

test('a loop bound read from input refuses in source checking', () => {
    const item = selected('effect-dynamic-bound');
    assert.equal(item.firstRefusal?.stage, 'typeCheck');
    assert.equal(item.firstRefusal?.kind, 'MissingContextFact');
    assert.equal(item.source.status, 'refused');
    unreachedAfter(item, [item.core, item.target, item.providerLowerer, item.verifier]);
});
