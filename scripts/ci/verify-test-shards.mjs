#!/usr/bin/env node
import { specsByShard, discoverSpecFiles, TEST_SHARD_NAMES } from './test-shards.mjs';

const specs = discoverSpecFiles();
const grouped = specsByShard();
let assigned = 0;

for (const shardName of TEST_SHARD_NAMES) {
  const shardSpecs = grouped.get(shardName) ?? [];
  assigned += shardSpecs.length;
  process.stdout.write(`${shardName}: ${shardSpecs.length}\n`);
  if (shardSpecs.length === 0) {
    process.stderr.write(`empty test shard: ${shardName}\n`);
    process.exitCode = 1;
  }
}

if (assigned !== specs.length) {
  process.stderr.write(`assigned ${assigned} specs, discovered ${specs.length}\n`);
  process.exitCode = 1;
}

if (process.exitCode == null) {
  process.stdout.write(`test shard coverage ok: ${assigned} specs\n`);
}
