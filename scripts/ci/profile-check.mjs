#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { performance } from 'node:perf_hooks';

import { TEST_SHARD_NAMES, specsForShard } from './test-shards.mjs';

const INCLUDE_RELEASE_GATE_FLAG = '--include-release-gate';
const includeReleaseGate = process.argv.includes(INCLUDE_RELEASE_GATE_FLAG);
const phases = [
  { name: 'build', command: 'npm', args: ['run', '--silent', 'build'] },
  ...TEST_SHARD_NAMES.map((shard) => ({
    name: `test:${shard}`,
    command: process.execPath,
    args: ['--test', '--test-concurrency=1', ...specsForShard(shard)],
  })),
  { name: 'quality', command: 'npm', args: ['run', '--silent', 'quality'] },
  ...(includeReleaseGate ? [{ name: 'release-gate:jedit-echo', command: 'npm', args: ['run', '--silent', 'release-gate:jedit-echo'] }] : []),
];

const results = [];
for (const phase of phases) {
  const startedAt = performance.now();
  const result = spawnSync(phase.command, phase.args, {
    cwd: process.cwd(),
    stdio: 'inherit',
  });
  const durationMs = Math.round(performance.now() - startedAt);
  results.push({
    name: phase.name,
    status: result.status ?? 1,
    durationMs,
  });
  if ((result.status ?? 1) !== 0) {
    break;
  }
}

const ok = results.every((result) => result.status === 0);
process.stdout.write(`${JSON.stringify({ ok, phases: results }, null, 2)}\n`);
process.exit(ok ? 0 : 1);
