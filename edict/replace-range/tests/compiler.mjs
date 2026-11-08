// SPDX-License-Identifier: Apache-2.0 OR LicenseRef-MIND-UCAL-1.0
// © James Ross Ω FLYING•ROBOTS <https://github.com/flyingrobots>

import { spawnSync } from 'node:child_process';

const CLI_PACKAGES = new Set(['edict-cli', 'amblicit-cli']);
const CLI_BINARIES = new Set(['edict', 'amblicit']);

function cargo(repository, toolchain, args) {
  const result = spawnSync('cargo', [`+${toolchain}`, ...args], {
    cwd: repository,
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    process.stderr.write(result.stderr ?? '');
    throw new Error(`Cargo compiler command exited with status ${result.status}`);
  }
  return result.stdout;
}

/** Build the workspace's public compiler, including the pre-rename Edict CLI. */
export function buildCompiler(repository, toolchain) {
  const metadata = JSON.parse(cargo(repository, toolchain, [
    'metadata', '--no-deps', '--format-version', '1',
  ]));
  const members = new Set(metadata.workspace_members);
  const compilers = metadata.packages
    .filter((pkg) => members.has(pkg.id) && CLI_PACKAGES.has(pkg.name))
    .flatMap((pkg) => pkg.targets
      .filter((target) => target.kind.includes('bin') && CLI_BINARIES.has(target.name))
      .map((target) => ({ packageId: pkg.id, packageName: pkg.name, binary: target.name })));
  if (compilers.length !== 1) {
    throw new Error(`Cargo workspace must contain one public compiler, found ${compilers.length}`);
  }
  const compiler = compilers[0];
  const output = cargo(repository, toolchain, [
    'build', '--locked', '-p', compiler.packageName, '--bin', compiler.binary,
    '--message-format=json-render-diagnostics',
  ]);
  const executables = output.split('\n').filter(Boolean).map((line) => JSON.parse(line))
    .filter((artifact) => artifact.reason === 'compiler-artifact'
      && artifact.package_id === compiler.packageId
      && artifact.target.name === compiler.binary
      && artifact.target.kind.includes('bin') && typeof artifact.executable === 'string');
  if (executables.length !== 1) {
    throw new Error('Cargo must emit one public compiler executable');
  }
  return executables[0].executable;
}
