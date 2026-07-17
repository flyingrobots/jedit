#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

const WESLEY_ROOT_ENV = 'JEDIT_WESLEY_ROOT';
const WESLEY_CLI_MANIFEST = ['crates', 'wesley-cli', 'Cargo.toml'];
const FAILURE_STATUS = 1;

const wesleyRootInput = process.env[WESLEY_ROOT_ENV];
if (wesleyRootInput == null || wesleyRootInput.trim().length === 0) {
  process.stderr.write(`Set ${WESLEY_ROOT_ENV} to a Wesley checkout before running jedit codegen.\n`);
  process.exit(FAILURE_STATUS);
}

const manifestPath = join(resolve(wesleyRootInput), ...WESLEY_CLI_MANIFEST);
if (!existsSync(manifestPath)) {
  process.stderr.write(`Wesley CLI manifest not found: ${manifestPath}\n`);
  process.exit(FAILURE_STATUS);
}

const result = spawnSync(
  'cargo',
  ['run', '--quiet', '--manifest-path', manifestPath, '--', ...process.argv.slice(2)],
  { cwd: process.cwd(), env: process.env, stdio: 'inherit' },
);
if (result.error != null) {
  process.stderr.write(`${result.error.message}\n`);
  process.exit(FAILURE_STATUS);
}
process.exit(result.status ?? FAILURE_STATUS);
