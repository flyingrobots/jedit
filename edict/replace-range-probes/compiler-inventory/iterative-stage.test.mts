// SPDX-License-Identifier: Apache-2.0 OR LicenseRef-MIND-UCAL-1.0
// © James Ross Ω FLYING•ROBOTS <https://github.com/flyingrobots>
// Exercise stage reporting against the real, hash-selected range inventory.
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { test } from 'node:test';

type Fact = { status: string; basis?: string };
type Observation = {
    name: string;
    source: Fact;
    core: Fact;
    target: Fact;
    providerLowerer: Fact;
    verifier: Fact;
    runtime: Fact;
    fullOperation: Fact;
    firstRefusal?: { kind: string; stage: string };
};
type Stages = { schema: string; inventorySha256: string; publishedComponents: Fact; cases: Observation[] };

class StageFailure extends Error {}

function required(name: string): string {
    const value = process.env[name];
    if (!value) throw new StageFailure('missing environment: ' + name);
    return value;
}

function sha(bytes: Buffer): string {
    return createHash('sha256').update(bytes).digest('hex');
}

if (!existsSync('/.dockerenv')) throw new StageFailure('run in the guarded Docker worker');
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

function stages(): Stages {
    assert.equal(result.error, undefined);
    assert.equal(result.signal, null);
    const line = result.stdout.split('\n').find(line => line.startsWith('STAGE_INVENTORY '));
    assert.ok(line, 'the consumer must emit per-case stage evidence');
    const value: Stages = JSON.parse(line.slice('STAGE_INVENTORY '.length));
    assert.equal(value.schema, 'jedit.iterative-stages/v1');
    assert.equal(value.inventorySha256, pin);
    assert.equal(value.cases.length, 12);
    return value;
}

function selected(value: Stages, name: string): Observation {
    const cases = value.cases.filter(item => item.name === name);
    assert.equal(cases.length, 1, 'exactly one observation for ' + name);
    return cases[0];
}

test('the constrained addition executes alongside the existing runtime controls', () => {
    assert.equal(result.status, 0, result.stderr);
    assert.equal((result.stdout.match(/RUNTIME_CASE_OK/g) ?? []).length, 7);
});

test('source refusals leave Core and all later execution stages unreached', () => {
    for (const [name, kind] of [['dynamic-fold-negative', 'InvalidBound'], ['unsafe-add-negative', 'UnsupportedSourceShape']]) {
        const item = selected(stages(), name);
        assert.deepEqual(item.firstRefusal?.kind, kind);
        assert.equal(item.firstRefusal?.stage, 'typeCheck');
        assert.deepEqual(item.source, { status: 'refused', basis: 'public-diagnostic' });
        for (const fact of [item.core, item.target, item.providerLowerer, item.verifier, item.runtime]) {
            assert.equal(fact.status, 'unreached');
        }
    }
});

test('provider refusals distinguish inferred earlier passage from observed rejection', () => {
    for (const name of ['indexed-record-fold', 'indexed-record-fold-nonstrict', 'indexed-record-fold-equality',
        'scalar-guarded-add', 'intent-guarded-add']) {
        const item = selected(stages(), name);
        assert.equal(item.firstRefusal?.kind, 'ProviderLowererRefused');
        for (const fact of [item.source, item.core, item.target]) {
            assert.deepEqual(fact, { status: 'accepted', basis: 'pinned-public-command-order' });
        }
        assert.deepEqual(item.providerLowerer, { status: 'refused', basis: 'public-diagnostic' });
        assert.equal(item.verifier.status, 'unreached');
        assert.equal(item.runtime.status, 'unreached');
    }
});

test('verified packages distinguish sampled execution from component regeneration and full operation', () => {
    const value = stages();
    assert.deepEqual(value.publishedComponents, { status: 'selected', basis: 'retained-provider-inventory' });
    for (const name of ['baseline', 'scalar-fold', 'bounded-list-fold', 'record-worklist-fold', 'constrained-add']) {
        const item = selected(value, name);
        assert.deepEqual(item.verifier, { status: 'accepted', basis: 'bound-verification-report' });
        assert.equal(item.runtime.status, name === 'baseline' ? 'unmeasured' : 'accepted');
        assert.equal(item.fullOperation.status, 'unmeasured');
    }
});
