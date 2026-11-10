// SPDX-License-Identifier: Apache-2.0 OR LicenseRef-MIND-UCAL-1.0
// © James Ross Ω FLYING•ROBOTS <https://github.com/flyingrobots>
// Public application builds only; no Core, Target, package, or report synthesis.
import { cpSync, existsSync, linkSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildCompiler } from '../../replace-range/tests/compiler.mjs';
import { DRAFT_CASES, MODULE_CASES, moduleSources } from './iterative-closures.mts';
import { CREATE_CONFIGURATION, EFFECT_CASES, EFFECT_GROUP, withEffectAdditions } from './iterative-effects.mts';
import { adapterTargets, withAdapterTargets, withImportDigest, lawpackManifestDigest }
    from '../../../scripts/deps/echo-edict-relock.mjs';

const applicationRoot = fileURLToPath(new URL('../../replace-range/', import.meta.url));
const fixtureRoot = fileURLToPath(new URL('./iterative/', import.meta.url));
const MAX_PROCESS_BYTES = 2 * 1024 * 1024;
const MAX_PROCESS_MS = 120_000;
const MAX_EVIDENCE_BYTES = 20 * 1024 * 1024;
const BUILD = { schema: 'edict.compiler.settings/v1', type: 'compilerSettings', operation: 'build' };
const CASES = ['scalar-fold', 'bounded-list-fold', 'record-worklist-fold', 'dynamic-fold-negative'];
const GROUPS = [
    { name: 'controls', cases: CASES },
    { name: 'modules', cases: [...CASES, ...MODULE_CASES] },
    { name: 'drafts', cases: [...CASES, ...DRAFT_CASES, 'missing-draft-lawpack'] },
    { name: 'primitives', cases: [...CASES, 'subtraction-constrained', 'subtraction-helper',
        'unsafe-subtraction-negative', 'byte-slice-intent', 'byte-slice-helper', 'function-precondition',
        'pure-typed-failure', 'minimum', 'maximum', 'byte-metrics'] },
    { name: 'lists', cases: [...CASES, 'guarded-list-at', 'list-concat', 'record-state-fold',
        'list-rebuild-fold', 'variant-state-fold', 'indexed-record-fold', 'record-list-select', 'guarded-list-transfer',
        'list-rebuild-nested-guards'] },
    { name: 'ranges', cases: [...CASES, 'indexed-record-fold', 'indexed-record-fold-nonstrict',
        'indexed-record-fold-equality', 'scalar-guarded-add', 'intent-guarded-add', 'constrained-add',
        'unsafe-add-negative'] },
    { name: EFFECT_GROUP, cases: [...CASES, ...EFFECT_CASES] },
];

class InventoryFailure extends Error {}

function hash(bytes: Buffer): string {
    return createHash('sha256').update(bytes).digest('hex');
}

function inventory(root: string): { path: string; bytes: number; sha256: string }[] {
    const result: { path: string; bytes: number; sha256: string }[] = [];
    function visit(relative: string): void {
        for (const item of readdirSync(path.join(root, relative), { withFileTypes: true })) {
            const name = path.join(relative, item.name);
            if (item.isDirectory()) visit(name);
            else if (item.isFile()) {
                const bytes = readFileSync(path.join(root, name));
                result.push({ path: name, bytes: bytes.length, sha256: hash(bytes) });
            } else throw new InventoryFailure('nonregular evidence input: ' + name);
        }
    }
    visit('');
    return result.sort((left, right) => left.path.localeCompare(right.path, 'en'));
}

function producerCommit(directory: string): string {
    const git = (args: string[]) => spawnSync('git', ['-C', directory, ...args], {
        encoding: 'utf8', timeout: MAX_PROCESS_MS, maxBuffer: MAX_PROCESS_BYTES,
    });
    const status = git(['status', '--porcelain=v1', '--untracked-files=all']);
    const head = git(['rev-parse', 'HEAD']);
    if (status.status !== 0 || status.stdout !== '' || head.status !== 0) {
        throw new InventoryFailure('producer checkout must be clean');
    }
    return head.stdout.trim();
}

function groupName(args: string[]): string {
    if (args.length === 4) return 'controls';
    if (args.length === 6 && args[4] === '--group') return args[5];
    throw new InventoryFailure('usage: iterative.mts --provider DIR --output NEW_DIR [--group NAME]');
}

function commandLine() {
    const args = process.argv.slice(2);
    if (args[0] !== '--provider' || args[2] !== '--output') throw new InventoryFailure('provider and output are required');
    const name = groupName(args);
    const group = GROUPS.find(group => group.name === name);
    if (!group) throw new InventoryFailure('unknown probe group');
    return { provider: path.resolve(args[1]), output: path.resolve(args[3]), group };
}

function configuration() {
    if (!existsSync('/.dockerenv')) throw new InventoryFailure('run in the guarded Docker worker');
    const arguments_ = commandLine();
    const compilerRepository = process.env.EDICT_REPO;
    const echoRepository = process.env.ECHO_REPO;
    if (!compilerRepository || !echoRepository) throw new InventoryFailure('EDICT_REPO and ECHO_REPO are required');
    const compilerCommit = producerCommit(compilerRepository);
    const echoCheckoutCommit = producerCommit(echoRepository);
    const toolchain = JSON.parse(readFileSync(path.join(applicationRoot, 'edict.toolchain-lock.json'), 'utf8')).rust.toolchain;
    const compiler = buildCompiler(compilerRepository, toolchain);
    return { compiler, compilerCommit, echoCheckoutCommit, compilerRepository, echoRepository, ...arguments_,
        compilerSha256: hash(readFileSync(compiler)), providerFiles: inventory(arguments_.provider) };
}

const selected = configuration();

function run(cwd: string, request: object): { exitCode: number; diagnostics: object[] } {
    const result = spawnSync(selected.compiler, [], { cwd, encoding: 'utf8',
        input: JSON.stringify(request) + '\n', timeout: MAX_PROCESS_MS, maxBuffer: MAX_PROCESS_BYTES });
    writeFileSync(path.join(cwd, 'stdout.jsonl'), result.stdout ?? '', { flag: 'wx' });
    writeFileSync(path.join(cwd, 'stderr.jsonl'), result.stderr ?? '', { flag: 'wx' });
    if (result.error || result.signal || result.status === null) throw new InventoryFailure('compiler process failed');
    const diagnostics = result.stderr.split('\n').filter(Boolean).map(line => JSON.parse(line));
    return { exitCode: result.status, diagnostics };
}

function writeBasisLawpack(lawpackFile: string): void {
    const bound = withAdapterTargets(JSON.parse(readFileSync(lawpackFile, 'utf8')), adapterTargets(selected.provider));
    if (selected.group.name === EFFECT_GROUP) {
        writeFileSync(path.join(selected.output, 'effect-driver.mts'),
            readFileSync(fileURLToPath(new URL('./iterative-effects.mts', import.meta.url))), { flag: 'wx' });
    }
    const lawpack = selected.group.name === EFFECT_GROUP
        ? withEffectAdditions(bound, path.join(selected.output, 'fixture-sources')) : bound;
    writeFileSync(lawpackFile, JSON.stringify(lawpack, null, 2) + '\n');
}

function publishBasis(): { root: string; baseline: string; digest: string } {
    mkdirSync(selected.output);
    writeFileSync(path.join(selected.output, 'driver.mts'), readFileSync(fileURLToPath(import.meta.url)), { flag: 'wx' });
    writeFileSync(path.join(selected.output, 'closure-driver.mts'),
        readFileSync(fileURLToPath(new URL('./iterative-closures.mts', import.meta.url))), { flag: 'wx' });
    cpSync(fixtureRoot, path.join(selected.output, 'fixture-sources'), { recursive: true });
    if (selected.group.name === 'drafts') {
        const drafts = path.join(applicationRoot, 'draft');
        cpSync(drafts, path.join(selected.output, 'fixture-sources/drafts'), { recursive: true,
            filter: source => source === drafts || source.endsWith('.edict') });
        writeFileSync(path.join(selected.output, 'draft-driver.mjs'),
            readFileSync(fileURLToPath(new URL('./draft-modules.mjs', import.meta.url))), { flag: 'wx' });
    }
    mkdirSync(path.join(selected.output, 'authored-sources'));
    const root = path.join(selected.output, 'basis');
    cpSync(applicationRoot, root, { recursive: true,
        filter: source => !source.startsWith(path.join(applicationRoot, '.build')) });
    cpSync(selected.provider, path.join(root, '.build/echo-provider'), { recursive: true });
    writeBasisLawpack(path.join(root, 'edict.lawpack.json'));
    const publication = run(root, { ...BUILD, lawpack: 'edict.lawpack.json' });
    if (publication.exitCode !== 0) throw new InventoryFailure('lawpack publication failed; no feature inference');
    const published = JSON.parse(readFileSync(path.join(root, 'vendor/jedit-text/edict.lawpack-output.json'), 'utf8'));
    const digest = lawpackManifestDigest(published);
    const baseline = withImportDigest(readFileSync(path.join(root, 'src/ReplaceRange.edict'), 'utf8'), 'jedit.text@1', digest);
    return { root, baseline, digest };
}

const basis = publishBasis();
const authored = ['baseline', ...selected.group.cases].map(name => {
    const fixture = MODULE_CASES.includes(name) ? 'module-fold' : name;
    const source = DRAFT_CASES.includes(name) ? '' : name === 'baseline' ? basis.baseline : withImportDigest(
        readFileSync(path.join(selected.output, 'fixture-sources', fixture + '.edict'), 'utf8'), 'jedit.text@1', basis.digest);
    const sources = moduleSources(path.join(selected.output, 'fixture-sources'), name, source);
    for (const file of sources) {
        const target = path.join(selected.output, 'source-closures', name, file.path);
        mkdirSync(path.dirname(target), { recursive: true });
        writeFileSync(target, file.source, { flag: 'wx' });
    }
    writeFileSync(path.join(selected.output, 'authored-sources', name + '.edict'), sources[0].source, { flag: 'wx' });
    return { name, source: sources[0].source, sources: sources.map(file => file.path) };
});
const selectedInputs = {
    group: selected.group.name,
    compilerCommit: selected.compilerCommit, echoCheckoutCommit: selected.echoCheckoutCommit,
    compilerBinarySha256: selected.compilerSha256,
    driverSha256: hash(readFileSync(path.join(selected.output, 'driver.mts'))),
    closureDriverSha256: hash(readFileSync(path.join(selected.output, 'closure-driver.mts'))),
    ...(selected.group.name === 'drafts' ? {
        draftDriverSha256: hash(readFileSync(path.join(selected.output, 'draft-driver.mjs'))),
    } : {}),
    ...(selected.group.name === EFFECT_GROUP ? {
        effectDriverSha256: hash(readFileSync(path.join(selected.output, 'effect-driver.mts'))),
    } : {}),
    probeSources: inventory(path.join(selected.output, 'fixture-sources')), provider: selected.providerFiles,
    authoredSources: inventory(path.join(selected.output, 'authored-sources')),
    sourceClosures: inventory(path.join(selected.output, 'source-closures')),
    lawpackSourceSha256: hash(readFileSync(path.join(basis.root, 'edict.lawpack.json'))),
    lawpackClosure: inventory(path.join(basis.root, 'vendor')),
};

function shareInputs(source: string, destination: string): void {
    mkdirSync(destination, { recursive: true });
    for (const file of inventory(source)) {
        const target = path.join(destination, file.path);
        mkdirSync(path.dirname(target), { recursive: true });
        linkSync(path.join(source, file.path), target);
    }
}

function measure(name: string, source: string, sources: string[]) {
    const root = path.join(selected.output, name);
    mkdirSync(root);
    // Public application builds only read these copied, fixed dependency inputs.
    shareInputs(path.join(basis.root, 'vendor'), path.join(root, 'vendor'));
    shareInputs(path.join(basis.root, '.build/echo-provider'), path.join(root, '.build/echo-provider'));
    shareInputs(path.join(selected.output, 'source-closures', name), root);
    const coordinate = source.match(/^package ([^;]+);/m);
    if (!coordinate) throw new InventoryFailure('missing source package coordinate');
    const config = JSON.parse(readFileSync(path.join(basis.root, 'edict.application.json'), 'utf8'));
    config.coordinate = coordinate[1];
    config.sources = sources;
    if (EFFECT_CASES.includes(name)) config.lawpacks[0].targetConfiguration = CREATE_CONFIGURATION;
    writeFileSync(path.join(root, 'edict.application.json'), JSON.stringify(config, null, 2) + '\n', { flag: 'wx' });
    const result = run(root, { ...BUILD, application: 'edict.application.json' });
    console.log(JSON.stringify({ name, ...result }));
    return { name, ...result, files: inventory(root) };
}

const results: object[] = [];

function writeReport(measurement: 'incomplete' | 'complete'): void {
    writeFileSync(path.join(selected.output, 'report.json'), JSON.stringify({
        schema: 'jedit.iterative-inventory/v3', measurement, selectedInputs, results,
        runtime: 'unmeasured', fullOperation: 'unmeasured',
    }, null, 2) + '\n');
}

for (const { name, source, sources } of authored) {
    const result = measure(name, source, sources);
    results.push(result);
    writeReport('incomplete');
    if (name === 'baseline' && result.exitCode !== 0) throw new InventoryFailure('baseline failed; inventory invalid');
    if (inventory(selected.output).reduce((sum, file) => sum + file.bytes, 0) > MAX_EVIDENCE_BYTES) {
        throw new InventoryFailure('inventory evidence bound');
    }
}
if (producerCommit(selected.compilerRepository) !== selected.compilerCommit
    || producerCommit(selected.echoRepository) !== selected.echoCheckoutCommit
    || hash(readFileSync(selected.compiler)) !== selected.compilerSha256
    || JSON.stringify(inventory(selected.provider)) !== JSON.stringify(selected.providerFiles)
    || JSON.stringify(inventory(path.join(basis.root, '.build/echo-provider'))) !== JSON.stringify(selectedInputs.provider)
    || JSON.stringify(inventory(path.join(basis.root, 'vendor'))) !== JSON.stringify(selectedInputs.lawpackClosure)) {
    throw new InventoryFailure('producer changed during measurement');
}
writeReport('complete');
console.log('INVENTORY_REPORT_SHA256', hash(readFileSync(path.join(selected.output, 'report.json'))));
