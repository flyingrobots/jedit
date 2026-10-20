// Moves Jedit to the Echo and Edict commits checked out in two clean
// checkouts, regenerates everything that derives from them, and proves the
// result with the ReplaceRange package chain.
//
//   node scripts/deps/echo-edict-relock.mjs --echo-repo DIR --edict-repo DIR
//
// Run it with the Node, npm, and Rust releases pinned in
// edict/replace-range/edict.toolchain-lock.json; the package chain refuses
// anything else. A host that no longer compiles against the new Echo stops the
// run before any generated artifact is rewritten.
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { decode } from 'cbor-x';

const ECHO_GIT = 'https://github.com/flyingrobots/echo';
const TEXT_LAWPACK = 'jedit.text@1';
const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const HOST_ROOT = path.join(PROJECT_ROOT, 'native', 'jedit-echo-host');
const APPLICATION_ROOT = path.join(PROJECT_ROOT, 'edict', 'replace-range');
const ORACLE_PATH = path.join(
  PROJECT_ROOT, 'contracts', 'jedit', 'lawpacks', 'replace-range-v1', 'replace-range-v1.oracle.json',
);
const PROVIDER_PACKAGE = path.join('schemas', 'edict-provider', 'package', 'v1');
const PROVIDER_COMPONENTS = Object.freeze([
  ['lowerer', 'lowerer.echo-dpo', 'lowerer.echo-dpo.component.wasm'],
  ['verifier', 'verifier.echo-dpo', 'verifier.echo-dpo.component.wasm'],
]);

function sha256Hex(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Points every Cargo dependency on `gitUrl` at `rev`. */
export function withGitRev(manifest, gitUrl, rev) {
  const pattern = new RegExp(`(git = "${escapeRegExp(gitUrl)}", rev = ")[0-9a-f]{40}(")`, 'g');
  if (!pattern.test(manifest)) {
    throw new Error(`manifest has no dependency on ${gitUrl}`);
  }
  return manifest.replace(pattern, `$1${rev}$2`);
}

/** Names the Cargo dependencies that come from `gitUrl`. */
export function gitDependencyNames(manifest, gitUrl) {
  const pattern = new RegExp(`^([A-Za-z0-9_-]+) = \\{ git = "${escapeRegExp(gitUrl)}"`, 'gm');
  return [...manifest.matchAll(pattern)].map((match) => match[1]);
}

/** Binds the lawpack's compatibility and conformance digests to the oracle. */
export function withOracleDigests(lawpack, { sourceSetHex, oracleSha256Hex }) {
  const bound = structuredClone(lawpack);
  bound.lawpack.compatibility.digest = `sha256:${sourceSetHex}`;
  bound.lawpack.conformanceFixtureCorpus.digest = `sha256:${oracleSha256Hex}`;
  return bound;
}

/** Rewrites the pinned digest of one `use lawpack` import. */
export function withImportDigest(source, lawpack, digest) {
  const pattern = new RegExp(`(use lawpack ${escapeRegExp(lawpack)} digest ")sha256:[0-9a-f]+(")`);
  if (!pattern.test(source)) {
    throw new Error(`source has no import of ${lawpack}`);
  }
  return source.replace(pattern, `$1${digest}$2`);
}

/** Returns the manifest digest Edict published for a lawpack. */
export function lawpackManifestDigest(output) {
  const manifests = output.artifacts.filter((artifact) => artifact.kind === 'manifest');
  if (manifests.length !== 1) {
    throw new Error(`lawpack output must name one manifest artifact, found ${manifests.length}`);
  }
  return manifests[0].digest;
}

function providerResource(manifest, role) {
  const matches = manifest.artifacts.filter((artifact) => artifact.role === role);
  if (matches.length !== 1) {
    throw new Error(`provider must contain one ${role} artifact`);
  }
  return matches[0].resource;
}

function componentPin(root, manifest, [role, fileName]) {
  const resource = providerResource(manifest, role);
  const sha256 = sha256Hex(readFileSync(path.join(root, 'components', fileName)));
  if (resource.digest !== `sha256:${sha256}`) {
    throw new Error(`${role} component bytes disagree with the provider manifest`);
  }
  return { coordinate: resource.coordinate, sha256 };
}

/** Derives the toolchain-lock provider entry from Echo's checked provider package. */
export function providerPins(root) {
  const manifestBytes = readFileSync(path.join(root, 'provider-manifest.echo.json'));
  const manifest = JSON.parse(manifestBytes);
  const [lowerer, verifier] = PROVIDER_COMPONENTS.map(([, role, fileName]) =>
    componentPin(root, manifest, [role, fileName]));
  const targetProfile = providerResource(manifest, 'target-profile.echo-dpo');
  const profile = decode(readFileSync(path.join(root, 'generated', 'primary', 'target-profile.echo-dpo.cbor')));
  return {
    coordinate: manifest.provider.coordinate,
    digest: manifest.provider.digest,
    manifestSha256: sha256Hex(manifestBytes),
    targetProfile: { coordinate: targetProfile.coordinate, digest: targetProfile.digest },
    lowerer,
    verifier: {
      ...verifier,
      contract: {
        coordinate: profile.verifier.id,
        digest: `sha256:${Buffer.from(profile.verifier.digest[1]).toString('hex')}`,
      },
    },
  };
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, ...options });
  if (result.status !== 0) {
    process.stderr.write(result.stdout ?? '');
    process.stderr.write(result.stderr ?? '');
    throw new Error(`${command} ${args.join(' ')} exited with status ${result.status}`);
  }
  return result.stdout;
}

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, value) {
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function cleanCommit(repository, label) {
  if (run('git', ['-C', repository, 'status', '--porcelain=v1', '--untracked-files=all']) !== '') {
    throw new Error(`${label} checkout must be clean`);
  }
  return run('git', ['-C', repository, 'rev-parse', 'HEAD']).trim();
}

function moveCargoPins(manifestPath, echoCommit) {
  const manifest = readFileSync(manifestPath, 'utf8');
  writeFileSync(manifestPath, withGitRev(manifest, ECHO_GIT, echoCommit));
  const packages = gitDependencyNames(manifest, ECHO_GIT).flatMap((name) => ['-p', name]);
  run('cargo', ['update', '--manifest-path', manifestPath, ...packages]);
}

function regenerateHostBindings(echoRepository) {
  const generated = path.join(HOST_ROOT, 'src', 'generated', 'contract.rs');
  run('cargo', [
    'run', '-q', '-p', 'echo-wesley-gen', '--',
    '--schema', path.join(PROJECT_ROOT, 'contracts', 'jedit', 'echo-text.graphql'),
    '--contract-host', '--out', generated,
  ], { cwd: echoRepository });
  run('rustfmt', ['--edition', '2021', generated]);
  run('cargo', ['build', '--manifest-path', path.join(HOST_ROOT, 'Cargo.toml'), '--all-targets']);
}

function edictCompiler(edictRepository, toolchain) {
  const output = run('cargo', [
    `+${toolchain}`, 'build', '--locked', '-p', 'edict-cli', '--message-format=json-render-diagnostics',
  ], { cwd: edictRepository });
  const executables = output.split('\n').filter(Boolean).map((line) => JSON.parse(line))
    .filter((artifact) => artifact.reason === 'compiler-artifact' && artifact.target.name === 'edict'
      && artifact.target.kind.includes('bin') && typeof artifact.executable === 'string');
  if (executables.length !== 1) {
    throw new Error('Cargo must emit one Edict executable');
  }
  return executables[0].executable;
}

function edictBuild(compiler, settings) {
  run(compiler, [], {
    cwd: APPLICATION_ROOT,
    input: `${JSON.stringify({ schema: 'edict.compiler.settings/v1', type: 'compilerSettings', operation: 'build', ...settings })}\n`,
  });
}

function relockToolchain(lockPath, { echoRepository, echoCommit, edictCommit, cliVersion }) {
  const lock = readJson(lockPath);
  lock.edict = { ...lock.edict, commit: edictCommit, cliVersion };
  lock.echo = { commit: echoCommit, provider: providerPins(path.join(echoRepository, PROVIDER_PACKAGE)) };
  lock.validation.files = lock.validation.files.map((file) => ({
    path: file.path,
    sha256: sha256Hex(readFileSync(path.join(PROJECT_ROOT, file.path))),
  }));
  writeJson(lockPath, lock);
  return lock;
}

function republishApplication({ echoRepository, edictRepository, toolchain }) {
  const compiler = edictCompiler(edictRepository, toolchain);
  const cliVersion = JSON.parse(run(compiler, ['--version'])).version;
  edictBuild(compiler, { lawpack: 'edict.lawpack.json' });
  const sourcePath = path.join(APPLICATION_ROOT, 'src', 'ReplaceRange.edict');
  const published = readJson(path.join(APPLICATION_ROOT, 'vendor', 'jedit-text', 'edict.lawpack-output.json'));
  writeFileSync(sourcePath, withImportDigest(readFileSync(sourcePath, 'utf8'), TEXT_LAWPACK, lawpackManifestDigest(published)));
  const buildRoot = path.join(APPLICATION_ROOT, '.build');
  rmSync(path.join(buildRoot, 'echo-provider'), { recursive: true, force: true });
  rmSync(path.join(buildRoot, 'application'), { recursive: true, force: true });
  mkdirSync(path.join(buildRoot, 'echo-provider'), { recursive: true });
  cpSync(path.join(echoRepository, PROVIDER_PACKAGE), path.join(buildRoot, 'echo-provider'), { recursive: true });
  edictBuild(compiler, { application: 'edict.application.json' });
  return cliVersion;
}

function parseArguments(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 2) {
    options[argv[index]] = argv[index + 1];
  }
  const echoRepository = options['--echo-repo'];
  const edictRepository = options['--edict-repo'];
  if (!echoRepository || !edictRepository || Object.keys(options).length !== 2) {
    throw new Error('usage: echo-edict-relock.mjs --echo-repo DIR --edict-repo DIR');
  }
  return { echoRepository: path.resolve(echoRepository), edictRepository: path.resolve(edictRepository) };
}

function main(argv) {
  const { echoRepository, edictRepository } = parseArguments(argv);
  const echoCommit = cleanCommit(echoRepository, 'Echo');
  const edictCommit = cleanCommit(edictRepository, 'Edict');
  const lockPath = path.join(APPLICATION_ROOT, 'edict.toolchain-lock.json');
  const toolchain = readJson(lockPath).rust.toolchain;

  moveCargoPins(path.join(HOST_ROOT, 'Cargo.toml'), echoCommit);
  moveCargoPins(path.join(APPLICATION_ROOT, 'tests', 'runtime', 'Cargo.toml'), echoCommit);
  regenerateHostBindings(echoRepository);
  run('npm', ['run', '-s', 'lawpack:replace-range:update'], { cwd: PROJECT_ROOT });

  const lawpackPath = path.join(APPLICATION_ROOT, 'edict.lawpack.json');
  writeJson(lawpackPath, withOracleDigests(readJson(lawpackPath), {
    sourceSetHex: readJson(ORACLE_PATH).sourceSet.digestHex,
    oracleSha256Hex: sha256Hex(readFileSync(ORACLE_PATH)),
  }));
  const cliVersion = republishApplication({ echoRepository, edictRepository, toolchain });
  relockToolchain(lockPath, { echoRepository, echoCommit, edictCommit, cliVersion });
  run(process.execPath, [path.join(APPLICATION_ROOT, 'tests', 'assert-build-output.mjs'),
    path.join(APPLICATION_ROOT, '.build', 'application'), '--write-locks'], { cwd: APPLICATION_ROOT });
  run(path.join(APPLICATION_ROOT, 'tests', 'build.sh'), [], {
    cwd: PROJECT_ROOT,
    stdio: 'inherit',
    env: { ...process.env, ECHO_REPO: echoRepository, EDICT_REPO: edictRepository },
  });
  process.stdout.write(`Jedit now builds against Echo ${echoCommit} and Edict ${edictCommit}.\n`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2));
}
