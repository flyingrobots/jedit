// SPDX-License-Identifier: Apache-2.0 OR LicenseRef-MIND-UCAL-1.0
// © James Ross Ω FLYING•ROBOTS <https://github.com/flyingrobots>
// Derive refusal inputs from retained public output; never synthesize programs.
import assert from 'node:assert/strict';
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { after, test } from 'node:test';

type FileEntry = { path: string; bytes: number; sha256: string };
type Case = { name: string; exitCode: number; diagnostics: object[]; files: FileEntry[] };
type Evidence = {
    schema: string;
    measurement?: string;
    selectedInputs: { compilerBinarySha256?: string; provider: FileEntry[] };
    results: Case[];
};

class AdmissionFailure extends Error {}

function required(name: string): string {
    const value = process.env[name];
    if (!value) throw new AdmissionFailure('missing environment: ' + name);
    return value;
}

function sha(bytes: Buffer): string {
    return createHash('sha256').update(bytes).digest('hex');
}

if (!existsSync('/.dockerenv')) throw new AdmissionFailure('run in the guarded Docker worker');
const input = required('INVENTORY_INPUT');
const expected = required('INVENTORY_REPORT_SHA256');
const executable = required('INVENTORY_RUNTIME');
const output = required('INVENTORY_TEST_OUTPUT');
const original = readFileSync(path.join(input, 'report.json'));
assert.equal(sha(original), expected, 'test input must be the selected public evidence');
mkdirSync(output);
const copy = path.join(output, 'working-copy');
cpSync(input, copy, { recursive: true });
writeFileSync(path.join(output, 'runtime.sha256'), sha(readFileSync(executable)) + '\n', { flag: 'wx' });

function evidence(): Evidence {
    return JSON.parse(original.toString('utf8'));
}

function scalar(value: Evidence): Case {
    const selected = value.results.find(item => item.name === 'scalar-fold');
    if (!selected) throw new AdmissionFailure('missing scalar control');
    return selected;
}

function run(name: string, value: Evidence, pin?: string) {
    const bytes = Buffer.from(JSON.stringify(value, null, 2) + '\n');
    writeFileSync(path.join(copy, 'report.json'), bytes);
    writeFileSync(path.join(output, name + '.report.json'), bytes, { flag: 'wx' });
    const result = spawnSync(executable, [copy, pin ?? sha(bytes)], {
        encoding: 'utf8', timeout: 30_000, maxBuffer: 256 * 1024,
    });
    writeFileSync(path.join(output, name + '.stdout.log'), result.stdout ?? '', { flag: 'wx' });
    writeFileSync(path.join(output, name + '.stderr.log'), result.stderr ?? '', { flag: 'wx' });
    writeFileSync(path.join(output, name + '.process.json'), JSON.stringify({
        status: result.status, signal: result.signal, error: result.error?.message,
    }, null, 2) + '\n', { flag: 'wx' });
    assert.equal(result.error, undefined, 'runtime process starts');
    assert.equal(result.signal, null, 'runtime process completes');
    return result;
}

function refused(name: string, value: Evidence, message: string): void {
    const result = run(name, value);
    assert.equal(result.status, 1, name + ' must refuse');
    assert.ok(result.stderr.includes(message), name + ' must identify the admission boundary');
    assert.equal(result.stdout, '', name + ' must refuse before any runtime result');
}

function changedFile(name: string, relative: string, changed: Buffer, message: string): void {
    const value = evidence();
    const selected = scalar(value).files.find(file => file.path === relative);
    assert.ok(selected);
    const file = path.join(copy, 'scalar-fold', relative);
    const saved = readFileSync(file);
    selected.bytes = changed.length;
    selected.sha256 = sha(changed);
    writeFileSync(path.join(output, name + '.changed-file'), changed, { flag: 'wx' });
    try {
        writeFileSync(file, changed);
        refused(name, value, message);
    } finally {
        writeFileSync(file, saved);
    }
}

function tree(root: string, relative = ''): string[] {
    const result: string[] = [];
    for (const item of readdirSync(path.join(root, relative), { withFileTypes: true })) {
        const name = path.join(relative, item.name);
        if (item.isDirectory()) result.push(...tree(root, name));
        else if (item.isFile()) result.push(name + ':' + sha(readFileSync(path.join(root, name))));
        else throw new AdmissionFailure('nonregular evidence entry');
    }
    return result.sort();
}

after(() => {
    writeFileSync(path.join(copy, 'report.json'), original);
    assert.deepEqual(tree(copy), tree(input), 'restored derivative must match retained public evidence');
    rmSync(copy, { recursive: true });
    console.log('RECLAIMED_VERIFIED_DUPLICATE; all changed reports/files and process logs retained');
});

test('the exact public artifact set executes', () => {
    const result = run('positive-control', evidence());
    assert.equal(result.status, 0);
    assert.equal((result.stdout.match(/RUNTIME_CASE_OK/g) ?? []).length, 4);
});

test('an invalid baseline invalidates the whole measurement', () => {
    const value = evidence();
    const baseline = value.results.find(item => item.name === 'baseline');
    assert.ok(baseline);
    baseline.exitCode = 2;
    refused('invalid-baseline', value, 'invalid positive control');
});

test('missing compiler identity is invalid evidence', () => {
    const value = evidence();
    delete value.selectedInputs.compilerBinarySha256;
    refused('missing-compiler-identity', value, 'compiler identity');
});

test('a provider component cannot be omitted from the file inventory', () => {
    const value = evidence();
    const selected = scalar(value);
    selected.files = selected.files.filter(file => !file.path.endsWith('verifier.echo-dpo.component.wasm'));
    refused('omitted-provider-component', value, 'inventory does not cover');
});

test('a lawpack resource cannot be omitted from the file inventory', () => {
    const value = evidence();
    const selected = scalar(value);
    selected.files = selected.files.filter(file => file.path !== 'vendor/jedit-text/exports.cbor');
    refused('omitted-lawpack-resource', value, 'inventory does not cover');
});

test('duplicate artifact paths are invalid evidence', () => {
    const value = evidence();
    const selected = scalar(value);
    const component = selected.files.find(file => file.path.endsWith('verifier.echo-dpo.component.wasm'));
    assert.ok(component);
    selected.files.push({ ...component });
    refused('duplicate-component', value, 'duplicate selected path');
});

test('incomplete measurements cannot produce runtime claims', () => {
    const value = evidence();
    value.measurement = 'incomplete';
    refused('incomplete-measurement', value, 'incomplete inventory');
});

test('self-consistent source substitution disagrees with the selected authored source', () => {
    const relative = 'src/Probe.edict';
    const source = readFileSync(path.join(copy, 'scalar-fold', relative));
    changedFile('source-substitution', relative, Buffer.concat([source, Buffer.from('\n')]), 'source selection mismatch');
});

test('self-consistent provider substitution disagrees with the selected provider', () => {
    const relative = '.build/echo-provider/components/verifier.echo-dpo.component.wasm';
    const component = readFileSync(path.join(copy, 'scalar-fold', relative));
    component[0] ^= 1;
    changedFile('provider-substitution', relative, component, 'provider selection mismatch');
});

test('a substituted report hash refuses before execution', () => {
    const result = run('wrong-report-pin', evidence(), '0'.repeat(64));
    assert.equal(result.status, 1);
    assert.ok(result.stderr.includes('compiler evidence substitution'));
    assert.equal(result.stdout, '');
});
