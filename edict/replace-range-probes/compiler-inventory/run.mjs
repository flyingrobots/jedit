// SPDX-License-Identifier: Apache-2.0 OR LicenseRef-MIND-UCAL-1.0
// © James Ross Ω FLYING•ROBOTS <https://github.com/flyingrobots>
import { cpSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { encode } from 'cbor-x';
import { fileURLToPath } from 'node:url';
import { buildCompiler } from '../../replace-range/tests/compiler.mjs';
import { adapterTargets, withAdapterTargets, withImportDigest, lawpackManifestDigest } from '../../../scripts/deps/echo-edict-relock.mjs';
const applicationRoot = fileURLToPath(new URL('../../replace-range/', import.meta.url));
const args = process.argv.slice(2);
if (args.length !== 4 || args[0] !== '--provider' || args[2] !== '--output') {
    throw new Error('usage: run.mjs --provider DIR --output NEW_DIR');
}
const provider = path.resolve(args[1]);
const destination = path.resolve(args[3]);
const compilerRepository = process.env.EDICT_REPO;
const echoRepository = process.env.ECHO_REPO;
if (!compilerRepository || !echoRepository)
    throw new Error('EDICT_REPO and ECHO_REPO are required');
for (const repository of [compilerRepository, echoRepository]) {
    const status = run('git', ['-C', repository, 'status', '--porcelain=v1', '--untracked-files=all']);
    if (status.status !== 0 || status.stdout !== '')
        throw new Error('producer checkout must be clean');
}
const toolchain = JSON.parse(readFileSync(path.join(applicationRoot, 'edict.toolchain-lock.json'))).rust.toolchain;
const compiler = buildCompiler(compilerRepository, toolchain);
mkdirSync(destination);
const application = path.join(destination, 'basis');
cpSync(applicationRoot, application, { recursive: true, filter: source => !source.startsWith(path.join(applicationRoot, '.build')) });
cpSync(provider, path.join(application, '.build/echo-provider'), { recursive: true });
const lawpackPath = path.join(application, 'edict.lawpack.json');
const lawpack = withAdapterTargets(JSON.parse(readFileSync(lawpackPath)), adapterTargets(provider));
writeFileSync(lawpackPath, JSON.stringify(lawpack, null, 2) + '\n');
const publication = run(compiler, [], { cwd: application, input: JSON.stringify({
        schema: 'edict.compiler.settings/v1', type: 'compilerSettings', operation: 'build', lawpack: 'edict.lawpack.json',
    }) + '\n' });
if (publication.status !== 0)
    throw new Error(publication.stderr);
const publicationOutput = JSON.parse(readFileSync(path.join(application, 'vendor/jedit-text/edict.lawpack-output.json')));
const originalSource = readFileSync(path.join(application, 'src/ReplaceRange.edict'), 'utf8');
const baseline = withImportDigest(originalSource, 'jedit.text@1', lawpackManifestDigest(publicationOutput));
writeFileSync(path.join(application, 'src/ReplaceRange.edict'), baseline);
const cases = [
    ['baseline', ''],
    ['bytes-escapes', 'fn probe() -> Bytes<exact=3> { return b"\\n\\r\\x00"; }'],
    ['unsigned-addition', 'fn probe() -> U64 { return 1u64 + 2u64; }'],
    ['unproved-overflow', 'fn probe(v: U64) -> U64 { return v + 1u64; }'],
    ['variant', 'type Probe = variant { Leaf(Bytes<max=4>), Branch(U64) };'],
    ['enum', 'enum Probe { Empty }'],
    ['recursive-type', 'type Probe = { next: Probe, };'],
    ['recursive-function', 'fn probe(v: U64) -> U64 { return probe(v); }'],
    ['option', 'fn probe() -> Option<U64> { return none; }'],
    ['list-literal', 'fn probe() -> List<U64,max=2> { return [1u64, 2u64]; }'],
    ['list-length', 'fn probe(v: List<U64,max=2>) -> U64 { return len(v); }'],
    ['list-concat', 'fn probe(a: List<U64,max=2>, b: List<U64,max=2>) -> List<U64,max=4> { return a ++ b; }'],
    ['function-precondition', 'fn probe(v: U64) -> U64 where v <= 4u64 { return v; }'],
    ['typed-pure-failure', 'fn probe(v: U64) -> U64 fails Missing { return v; }'],
    ['division', 'fn probe() -> U64 { return 4u64 / 2u64; }'],
    ['minimum', 'fn probe() -> U64 { return min(1u64, 2u64); }'],
    ['maximum', 'fn probe() -> U64 { return max(1u64, 2u64); }'],
    ['u8', 'type Probe = U8;'],
    ['count-bytes', 'fn probe(v: Bytes<max=4>) -> U64 { return count(v, b"\\n"); }'],
    ['utf8', 'fn probe(v: Bytes<max=4>) -> Bool { return isUtf8(v); }'],
    ['byte-at', 'fn probe(v: Bytes<exact=1>) -> U32 { return at(v, 0u64); }'],
    ['generic-helper', 'fn probe<T>(v: T) -> T { return v; }'],
];
function run(cmd, args, options = {}) {
    const result = spawnSync(cmd, args, {
        encoding: 'utf8', timeout: 120000, maxBuffer: 2 * 1024 * 1024, ...options,
    });
    if (result.error || result.signal) throw result.error ?? new Error(result.signal);
    return result;
}
function hash(value) { return createHash('sha256').update(value).digest('hex'); }
function record(name, source, sources = ['src/ReplaceRange.edict'], extra) {
    const root = path.join(destination, name);
    mkdirSync(root, { recursive: true });
    for (const item of ['vendor', 'src'])
        cpSync(path.join(application, item), path.join(root, item), { recursive: true });
    cpSync(path.join(application, '.build/echo-provider'), path.join(root, '.build/echo-provider'), { recursive: true });
    const config = JSON.parse(readFileSync(path.join(application, 'edict.application.json')));
    config.sources = sources;
    writeFileSync(path.join(root, 'edict.application.json'), JSON.stringify(config, null, 2) + '\n');
    if (source !== null)
        writeFileSync(path.join(root, 'src/ReplaceRange.edict'), source);
    if (extra)
        extra(root);
    const request = { schema: 'edict.compiler.settings/v1', type: 'compilerSettings', operation: 'build', application: 'edict.application.json' };
    const r = run(compiler, [], { cwd: root, input: JSON.stringify(request) + '\n' });
    writeFileSync(path.join(root, 'stdout.jsonl'), r.stdout);
    writeFileSync(path.join(root, 'stderr.jsonl'), r.stderr);
    const rawDiagnostics = r.stderr.split('\n').filter(Boolean).map(line => JSON.parse(line)).filter(value => value.type === 'diagnostic');
    const diagnostics = JSON.parse(JSON.stringify(rawDiagnostics).replaceAll(destination, '.'));
    const result = { name, status: r.status, sourceSha256: hash(readFileSync(path.join(root, sources[0]))), diagnostics };
    console.log(JSON.stringify(result));
    return result;
}
mkdirSync(destination, { recursive: true });
const results = [];
for (const [name, addition] of cases)
    results.push(record(name, baseline + '\n' + addition + '\n'));
const library = 'package jedit.probe.library@1;\nfn value() -> U64 { return 1u64; }\n';
const digest = 'sha256:' + hash(encode(['edict.digest/v1', 'edict.source/v1', Buffer.from(library)]));
const moduleSource = baseline.replace('\n\nuse lawpack', `\nuse module jedit.probe.library@1 digest "${digest}" as library;\n\nuse lawpack`);
results.push(record('source-module', moduleSource, ['src/ReplaceRange.edict', 'src/Library.edict'], root => writeFileSync(path.join(root, 'src/Library.edict'), library)));
for (const name of ['Text', 'Reference', 'Rope', 'ReplaceRange']) {
    results.push(record('draft-' + name, null, ['draft/' + name + '.edict'], root => cpSync(path.join(application, 'draft'), path.join(root, 'draft'), { recursive: true })));
}
const report = {
    schema: 'jedit.compiler-inventory/v1',
    compilerCommit: run('git', ['-C', compilerRepository, 'rev-parse', 'HEAD']).stdout.trim(),
    echoCheckoutCommit: run('git', ['-C', echoRepository, 'rev-parse', 'HEAD']).stdout.trim(),
    compilerBinarySha256: hash(readFileSync(compiler)),
    compilerVersion: JSON.parse(run(compiler, ['--version']).stdout),
    lawpackSha256: hash(readFileSync(path.join(application, 'edict.lawpack.json'))),
    providerManifestSha256: hash(readFileSync(path.join(application, '.build/echo-provider/provider-manifest.echo.json'))),
    results,
};
writeFileSync(path.join(destination, 'report.json'), JSON.stringify(report, null, 2) + '\n');
if (results[0].status !== 0)
    throw new Error('baseline did not build; probe results do not establish new language blockers');
