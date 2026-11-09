// SPDX-License-Identifier: Apache-2.0 OR LicenseRef-MIND-UCAL-1.0
// © James Ross Ω FLYING•ROBOTS <https://github.com/flyingrobots>
// Derive refusal inputs from retained public output; never synthesize programs.
import assert from 'node:assert/strict';
import { existsSync, linkSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, unlinkSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { after, test } from 'node:test';

type FileEntry = { path: string; bytes: number; sha256: string };
type Case = { name: string; exitCode: number; diagnostics: object[]; files: FileEntry[] };
type Evidence = {
    schema: string;
    measurement?: string;
    selectedInputs: { compilerBinarySha256?: string; compilerCommit?: string; provider: FileEntry[];
        group?: string; sourceClosures?: FileEntry[] };
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

function shareInputs(source: string, destination: string): void {
    mkdirSync(destination);
    for (const item of readdirSync(source, { withFileTypes: true })) {
        const from = path.join(source, item.name);
        const to = path.join(destination, item.name);
        if (item.isDirectory()) shareInputs(from, to);
        else if (item.isFile()) linkSync(from, to);
        else throw new AdmissionFailure('nonregular evidence input');
    }
}

function writeDetached(file: string, bytes: Buffer): void {
    const replacement = file + '.replacement';
    writeFileSync(replacement, bytes, { flag: 'wx' });
    renameSync(replacement, file);
}

if (!existsSync('/.dockerenv')) throw new AdmissionFailure('run in the guarded Docker worker');
const input = required('INVENTORY_INPUT');
const expected = required('INVENTORY_REPORT_SHA256');
const executable = required('INVENTORY_RUNTIME');
const output = required('INVENTORY_TEST_OUTPUT');
const original = readFileSync(path.join(input, 'report.json'));
assert.equal(sha(original), expected, 'test input must be the selected public evidence');
const originalTree = tree(input);
mkdirSync(output);
const copy = path.join(output, 'working-copy');
shareInputs(input, copy);
writeFileSync(path.join(output, 'runtime.sha256'), sha(readFileSync(executable)) + '\n', { flag: 'wx' });

function evidence(): Evidence {
    return JSON.parse(original.toString('utf8'));
}

function scalar(value: Evidence): Case {
    return named(value, 'scalar-fold');
}

function named(value: Evidence, name: string): Case {
    const selected = value.results.find(item => item.name === name);
    if (!selected) throw new AdmissionFailure('missing case: ' + name);
    return selected;
}

function run(name: string, value: Evidence, pin?: string) {
    const bytes = Buffer.from(JSON.stringify(value, null, 2) + '\n');
    writeDetached(path.join(copy, 'report.json'), bytes);
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

function changedFile(name: string, relative: string, changed: Buffer, message: string, caseName = 'scalar-fold'): void {
    const value = evidence();
    const selected = named(value, caseName).files.find(file => file.path === relative);
    assert.ok(selected);
    const file = path.join(copy, caseName, relative);
    const saved = readFileSync(file);
    selected.bytes = changed.length;
    selected.sha256 = sha(changed);
    writeFileSync(path.join(output, name + '.changed-file'), changed, { flag: 'wx' });
    try {
        writeDetached(file, changed);
        refused(name, value, message);
    } finally {
        writeDetached(file, saved);
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
    writeDetached(path.join(copy, 'report.json'), original);
    assert.deepEqual(tree(input), originalTree, 'mutations must never change retained input bytes');
    assert.deepEqual(tree(copy), tree(input), 'restored derivative must match retained public evidence');
    rmSync(copy, { recursive: true });
    console.log('RECLAIMED_VERIFIED_DUPLICATE; all changed reports/files and process logs retained');
});

test('the exact public artifact set executes', () => {
    const result = run('positive-control', evidence());
    assert.equal(result.status, 0);
    const group = evidence().selectedInputs.group;
    const counts = new Map([['lists', 30], ['ranges', 7], ['modules', 6]]);
    const count = counts.get(group ?? '') ?? 4;
    assert.equal((result.stdout.match(/RUNTIME_CASE_OK/g) ?? []).length, count);
});

test('unsupported groups cannot silently omit selected runtime witnesses', () => {
    const value = evidence();
    value.selectedInputs.group = 'unrecognized';
    refused('unknown-group', value, 'unsupported inventory group');
});

test('reported refusal stages must match the retained compiler diagnostics', () => {
    const value = evidence();
    named(value, 'dynamic-fold-negative').diagnostics[0] = {
        type: 'diagnostic', severity: 'error', stage: 'cli', kind: 'ProviderLowererRefused',
    };
    refused('forged-stage', value, 'compiler diagnostics mismatch');
});

test('reported process status must match the public CLI status event', () => {
    const value = evidence();
    named(value, 'dynamic-fold-negative').exitCode = 1;
    refused('forged-status', value, 'compiler status mismatch');
});

test('the baseline package must bind its accepted verifier report', () => {
    const relative = '.build/application/verification-report.cbor';
    const other = readFileSync(path.join(copy, 'scalar-fold', relative));
    changedFile('baseline-report-substitution', relative, other, 'package/report mismatch', 'baseline');
});

test('uninspected compiler revisions cannot inherit earlier-stage inference', () => {
    const value = evidence();
    value.selectedInputs.compilerCommit = '0'.repeat(40);
    const result = run('uninspected-compiler', value);
    assert.equal(result.status, 0, result.stderr);
    const line = result.stdout.split('\n').find(line => line.startsWith('STAGE_INVENTORY '));
    assert.ok(line);
    const stages: { cases: { name: string; source: { status: string }; core: { status: string };
        target: { status: string }; verifier: { status: string } }[] } = JSON.parse(line.slice('STAGE_INVENTORY '.length));
    const scalar = stages.cases.find(item => item.name === 'scalar-fold');
    assert.ok(scalar);
    for (const stage of [scalar.source, scalar.core, scalar.target]) assert.equal(stage.status, 'unmeasured');
    assert.equal(scalar.verifier.status, 'accepted');
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

test('the application must select its retained source closure', () => {
    const relative = 'edict.application.json';
    const config = JSON.parse(readFileSync(path.join(copy, 'scalar-fold', relative), 'utf8'));
    config.sources = [];
    changedFile('omitted-application-source', relative, Buffer.from(JSON.stringify(config) + '\n'),
        'application source closure mismatch');
});

const modulesOnly = { skip: evidence().selectedInputs.group !== 'modules' };

test('an imported leaf cannot be substituted with self-consistent case metadata', modulesOnly, () => {
    const relative = 'src/modules/Leaf.edict';
    const source = readFileSync(path.join(copy, 'module-fold', relative));
    changedFile('imported-leaf-substitution', relative, Buffer.concat([source, Buffer.from('\n')]),
        'source closure selection mismatch', 'module-fold');
});

test('an imported leaf cannot be omitted from both the case and its file list', modulesOnly, () => {
    const value = evidence();
    const relative = 'src/modules/Leaf.edict';
    const selected = named(value, 'module-fold');
    selected.files = selected.files.filter(file => file.path !== relative);
    const file = path.join(copy, 'module-fold', relative);
    const saved = readFileSync(file);
    try {
        unlinkSync(file);
        refused('omitted-imported-leaf', value, 'source closure selection mismatch');
    } finally {
        writeDetached(file, saved);
    }
});

test('the selected root must remain first in the application source list', modulesOnly, () => {
    const relative = 'edict.application.json';
    const config = JSON.parse(readFileSync(path.join(copy, 'module-fold', relative), 'utf8'));
    config.sources.reverse();
    changedFile('reordered-source-root', relative, Buffer.from(JSON.stringify(config) + '\n'),
        'application source closure mismatch', 'module-fold');
});

test('a v3 inventory cannot downgrade its required source closure', modulesOnly, () => {
    const value = evidence();
    delete value.selectedInputs.sourceClosures;
    refused('missing-source-closure', value, 'file inventory');
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
