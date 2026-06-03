#!/usr/bin/env node
import { appendFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { performance } from 'node:perf_hooks';

import { assertKnownShard, specsForShard } from './test-shards.mjs';

const LIST_FLAG = '--list';
const GITHUB_STEP_SUMMARY_ENV = 'GITHUB_STEP_SUMMARY';
const TEST_CONCURRENCY_FLAG = '--test-concurrency=1';
const TEST_FLAG = '--test';
const shardName = process.argv[2];

if (shardName === LIST_FLAG) {
  process.stdout.write('use scripts/ci/verify-test-shards.mjs for shard inventory\n');
  process.exit(0);
}

if (shardName == null) {
  process.stderr.write('usage: node scripts/ci/run-shard.mjs <shard-name>\n');
  process.exit(1);
}

assertKnownShard(shardName);

const specs = specsForShard(shardName);
if (specs.length === 0) {
  process.stderr.write(`test shard has no specs: ${shardName}\n`);
  process.exit(1);
}

const startedAt = performance.now();
const result = spawnSync(process.execPath, [TEST_FLAG, TEST_CONCURRENCY_FLAG, ...specs], {
  cwd: process.cwd(),
  stdio: 'inherit',
});
const durationMs = Math.round(performance.now() - startedAt);
writeSummary(shardName, specs, durationMs, result.status ?? 1);
process.exit(result.status ?? 1);

function writeSummary(name, shardSpecs, duration, status) {
  const body = [
    `### Test shard: ${name}`,
    '',
    `Status: ${status === 0 ? 'passed' : 'failed'}`,
    `Duration: ${duration}ms`,
    `Specs: ${String(shardSpecs.length)}`,
    '',
  ].join('\n');
  const summaryPath = process.env[GITHUB_STEP_SUMMARY_ENV];
  if (summaryPath == null) {
    return;
  }
  appendFileSync(summaryPath, `${body}\n`);
}
