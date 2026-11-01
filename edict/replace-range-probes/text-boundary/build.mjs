// SPDX-License-Identifier: Apache-2.0 OR LicenseRef-MIND-UCAL-1.0
// © James Ross Ω FLYING•ROBOTS <https://github.com/flyingrobots>
// Test-only public-build driver: copies selected artifacts, never constructs IR.
import { createHash } from 'node:crypto';
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { decode } from 'cbor-x';
import { sourceDigest } from '../compiler-inventory/draft-modules.mjs';
import { inventoryProvenance } from './inventory-provenance.mjs';

const args = process.argv.slice(2);
if (args.length !== 6 || args[0] !== '--inventory' || args[2] !== '--compiler' || args[4] !== '--output') {
  throw new Error('usage: build.mjs --inventory DIR --compiler BIN --output NEW_DIR');
}
const inventory = path.resolve(args[1]);
const compiler = path.resolve(args[3]);
const output = path.resolve(args[5]);
if (existsSync(output)) throw new Error('output must be new');
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const priorBytes = readFileSync(path.join(inventory, 'report.json'));
const prior = JSON.parse(priorBytes);
const provenance = inventoryProvenance(prior);
if (hash(readFileSync(compiler)) !== prior.compilerBinarySha256) throw new Error('compiler substitution');
const basis = path.join(inventory, 'basis');
const root = fileURLToPath(new URL('../../replace-range/draft/Boundary.edict', import.meta.url));
const helper = readFileSync(root, 'utf8');
const baseline = readFileSync(path.join(basis, 'src/ReplaceRange.edict'), 'utf8');
const imports = baseline.split('\n').filter(line => line.startsWith('use lawpack '));
if (imports.length !== 1) throw new Error('expected one pinned basis lawpack');
mkdirSync(output);
for (const item of ['vendor', '.build/echo-provider']) {
  cpSync(path.join(basis, item), path.join(output, item), { recursive: true });
}
const provider = path.join(output, '.build/echo-provider/provider-manifest.echo.json');
if (hash(readFileSync(provider)) !== prior.providerManifestSha256) throw new Error('provider substitution');
const source = `package jedit.text.boundary_probe@1;
${imports[0]}
use module jedit.text.boundary@1 digest "${sourceDigest(helper)}" as boundary;
type Input = { bytes: Bytes<max=1048576>, index: U64, };
type Output = { value: Bool, };
intent evaluate(input: Input) returns Output
  profile text.replaceRange basis none budget <= text.replaceRangeBudget
{
  let value = boundary.isCharBoundary(input.bytes, input.index);
  return { value };
}
`;
mkdirSync(path.join(output, 'src'));
writeFileSync(path.join(output, 'src/Boundary.edict'), helper);
writeFileSync(path.join(output, 'src/Probe.edict'), source);
const config = JSON.parse(readFileSync(path.join(basis, 'edict.application.json')));
config.coordinate = 'jedit.text.boundary_probe@1';
config.sources = ['src/Probe.edict', 'src/Boundary.edict'];
writeFileSync(path.join(output, 'edict.application.json'), JSON.stringify(config, null, 2) + '\n');
function tree(directory) {
  const entries = {};
  function visit(relative) {
    for (const item of readdirSync(path.join(directory, relative), { withFileTypes: true })) {
      const name = path.join(relative, item.name);
      if (item.isDirectory()) visit(name);
      else if (item.isFile()) entries[name] = hash(readFileSync(path.join(directory, name)));
      else throw new Error('nonregular selected input');
    }
  }
  visit('');
  return entries;
}
const selectedInputs = {
  compilerBinarySha256: prior.compilerBinarySha256, inventorySha256: hash(priorBytes),
  ...provenance,
  // Preserve the v1 observation alias; neither field attests provider source.
  echoCommit: provenance.echoCheckoutCommit,
  helperSourceSha256: hash(Buffer.from(helper)), helperModuleDigest: sourceDigest(helper),
  rootSourceSha256: hash(Buffer.from(source)),
  configSha256: hash(readFileSync(path.join(output, 'edict.application.json'))),
  vendor: tree(path.join(output, 'vendor')), provider: tree(path.join(output, '.build/echo-provider')),
};
const builds = [];
for (let index = 0; index < 2; index += 1) {
  const result = spawnSync(compiler, [], {
    cwd: output, encoding: 'utf8', timeout: 120000, maxBuffer: 2 * 1024 * 1024,
    input: JSON.stringify({ schema: 'edict.compiler.settings/v1', type: 'compilerSettings',
      operation: 'build', application: 'edict.application.json' }) + '\n',
  });
  if (result.error || result.signal) throw result.error ?? new Error(result.signal);
  writeFileSync(path.join(output, `build-${index}.stdout.jsonl`), result.stdout);
  writeFileSync(path.join(output, `build-${index}.stderr.jsonl`), result.stderr);
  const diagnostics = result.stderr.split('\n').filter(Boolean).map(line => JSON.parse(line));
  const artifacts = {};
  if (result.status === 0) {
    for (const name of ['executable-operation-package.cbor', 'verification-report.cbor']) {
      const bytes = readFileSync(path.join(output, config.outputDirectory, name));
      artifacts[name] = hash(bytes);
      if (index === 0) writeFileSync(path.join(output, name), bytes);
    }
    const report = decode(readFileSync(path.join(output, config.outputDirectory, 'verification-report.cbor')));
    if (report.outcome !== 'accepted') throw new Error('provider verifier refused');
  }
  builds.push({ exitCode: result.status, diagnostics, artifacts });
  if (result.status !== 0) break;
}
const evidence = { schema: 'jedit.text-boundary-witness/v1', selectedInputs, builds };
writeFileSync(path.join(output, 'evidence.json'), JSON.stringify(evidence, null, 2) + '\n');
if (builds.length !== 2 || builds.some(build => build.exitCode !== 0)) {
  console.log(JSON.stringify(evidence));
  process.exitCode = 1;
} else {
  if (JSON.stringify(builds[0].artifacts) !== JSON.stringify(builds[1].artifacts)) throw new Error('repeat changed artifacts');
  console.log('BOUNDARY_COMPILER_EVIDENCE_SHA256', hash(readFileSync(path.join(output, 'evidence.json'))));
}
