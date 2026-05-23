#!/usr/bin/env node
import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const DEFAULT_PACKAGE_DESCRIPTOR = 'src/app/jedit-contract-package.ts';
const DEFAULT_OBSERVER_WITNESS = 'spec/jedit-contract-query-observers.spec.mjs';
const FOCUSED_TESTS = Object.freeze([
  'spec/jedit-contract-package.spec.mjs',
  'spec/jedit-contract-package-preflight.spec.mjs',
  'spec/jedit-contract-package-install.spec.mjs',
  'spec/jedit-contract-mutation-handlers.spec.mjs',
  'spec/jedit-contract-query-observers.spec.mjs',
  'spec/installed-jedit-contract-echo-transport.spec.mjs',
  'spec/trusted-echo-runtime-loop.spec.mjs',
  'spec/jedit-intent-outcomes.spec.mjs',
  'spec/jedit-retained-evidence.spec.mjs',
  'spec/echo-powered-session-witness-cli.spec.mjs',
  'spec/jedit-echo-witness-mcp-adapter.spec.mjs',
  'spec/jedit-restart-posture.spec.mjs',
  'spec/jedit-local-replay-proof.spec.mjs',
  'spec/interactive-echo-text-session.spec.mjs',
  'spec/release-quickstart.spec.mjs',
]);

const options = parseArgs(process.argv.slice(2));
const metadataStatus = checkRequiredFile(options.packageDescriptor, 'package descriptor')
  || checkRequiredFile(options.observerWitness, 'observer witness');

if (metadataStatus !== 0) {
  process.exitCode = metadataStatus;
} else if (options.metadataOnly) {
  process.stdout.write('jedit Echo release gate metadata ok\n');
} else {
  process.exitCode = runReleaseGate();
}

function parseArgs(args) {
  const options = {
    packageDescriptor: DEFAULT_PACKAGE_DESCRIPTOR,
    observerWitness: DEFAULT_OBSERVER_WITNESS,
    metadataOnly: false,
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--metadata-only') {
      options.metadataOnly = true;
    } else if (arg === '--package-descriptor') {
      options.packageDescriptor = requiredValue(args, index, arg);
      index += 1;
    } else if (arg === '--observer-witness') {
      options.observerWitness = requiredValue(args, index, arg);
      index += 1;
    } else {
      process.stderr.write(`unknown argument: ${arg}\n`);
      process.exit(1);
    }
  }

  return options;
}

function requiredValue(args, index, arg) {
  const value = args[index + 1];
  if (value == null || value.startsWith('--')) {
    process.stderr.write(`missing value for ${arg}\n`);
    process.exit(1);
  }
  return value;
}

function checkRequiredFile(filePath, label) {
  if (existsSync(filePath)) {
    return 0;
  }
  process.stderr.write(`missing ${label}: ${filePath}\n`);
  return 1;
}

function runReleaseGate() {
  return runCommand('npm', ['run', '--silent', 'build'])
    || runCommand(process.execPath, ['--test', '--test-concurrency=1', ...FOCUSED_TESTS])
    || runCommand('npm', ['run', '--silent', 'quality']);
}

function runCommand(command, args) {
  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    stdio: 'inherit',
  });
  return result.status ?? 1;
}
