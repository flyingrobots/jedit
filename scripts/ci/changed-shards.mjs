#!/usr/bin/env node
import { appendFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

import {
  TEST_SHARDS,
  TEST_SHARD_NAMES,
  normalizeRepoPath,
  testShardForSpec,
} from './test-shards.mjs';

const FULL_REASON = 'full-ci';
const RELEASE_GATE_REASON = 'release-gate';
const GITHUB_OUTPUT_ENV = 'GITHUB_OUTPUT';
const GITHUB_STEP_SUMMARY_ENV = 'GITHUB_STEP_SUMMARY';
const JSON_FLAG = '--json';
const FULL_FLAG = '--full';
const GITHUB_OUTPUT_FLAG = '--github-output';
const SUMMARY_FLAG = '--summary';
const BASE_FLAG = '--base';
const HEAD_FLAG = '--head';
const DEFAULT_BASE_REF = 'origin/main';
const DEFAULT_HEAD_REF = 'HEAD';
const SPEC_PATH_PATTERN = /\.spec\.mjs$/;
const FULL_CI_PATH_PREFIXES = Object.freeze([
  '.github/',
  'scripts/ci/',
]);
const FULL_CI_PATHS = Object.freeze([
  'package-lock.json',
  'package.json',
  'tsconfig.json',
]);
const FULL_CI_PATH_PATTERNS = Object.freeze([
  /^scripts\/quality/,
  /^quality-baseline\.json$/,
]);
const CONTRACT_PATH_PREFIXES = Object.freeze([
  'contracts/',
  'src/generated/',
]);
const CONTRACT_PATH_PATTERNS = Object.freeze([
  /^scripts\/gen-/,
  /^scripts\/run-wesley-tool\.mjs$/,
]);
const ECHO_PATH_PATTERNS = Object.freeze([
  /^scripts\/jedit-echo/,
  /^scripts\/jedit-production/,
  /^scripts\/ports\/echo/,
  /^src\/adapters\/.*(?:echo|jedit|production|recovery|wsc)/,
  /^src\/app\/.*(?:echo|jedit|production|recovery|restart|text-runtime|wsc)/,
  /^src\/ports\/.*(?:echo|jedit|production|recovery|wsc)/,
  /^src\/transport\//,
]);
const WORKSPACE_PATH_PATTERNS = Object.freeze([
  /^src\/adapters\/workspace/,
  /^src\/app\/workspace\//,
  /^src\/ports\/file-system/,
  /^src\/ui\/.*(?:drawer|editor|feedback|footer|markdown|panel|source|workspace)/,
]);
const TITLE_PATH_PATTERNS = Object.freeze([
  /^src\/adapters\/title/,
  /^src\/app\/title/,
  /^src\/ui\/.*(?:theme|title|bunny|teapot)/,
]);
const DOCS_PATH_PREFIXES = Object.freeze([
  'docs/',
]);
const DOCS_PATHS = Object.freeze([
  'ARCHITECTURE.md',
  'README.md',
]);

if (isMainModule()) {
  main();
}

export function planChangedShards(paths) {
  if (paths.length === 0) {
    return fullPlan(['no-changed-paths']);
  }

  const shardSet = new Set();
  const reasons = [];
  let releaseGate = false;

  for (const pathName of paths.map(normalizeRepoPath)) {
    const impact = impactForPath(pathName);
    reasons.push({ path: pathName, reason: impact.reason, shards: impact.shards });
    if (impact.full) {
      return fullPlan([impact.reason], paths);
    }
    for (const shard of impact.shards) {
      shardSet.add(shard);
    }
    releaseGate = releaseGate || impact.releaseGate;
  }

  return {
    full: false,
    releaseGate,
    testShards: sortedShards([...shardSet]),
    changedPaths: paths.map(normalizeRepoPath).sort(compareText),
    reasons,
  };
}

export function impactForPath(pathName) {
  if (isFullCiPath(pathName)) {
    return fullImpact('ci-or-package-change');
  }
  if (SPEC_PATH_PATTERN.test(pathName)) {
    return shardImpact('changed-spec', [testShardForSpec(pathName)], false);
  }
  if (isContractPath(pathName)) {
    return shardImpact('contract-or-codegen-change', [TEST_SHARDS.Contracts, TEST_SHARDS.EchoAuthority], true);
  }
  if (matchesAny(pathName, ECHO_PATH_PATTERNS)) {
    return shardImpact('echo-authority-change', [TEST_SHARDS.EchoAuthority, TEST_SHARDS.WorkspaceUi], true);
  }
  if (matchesAny(pathName, TITLE_PATH_PATTERNS)) {
    return shardImpact('title-rendering-change', [TEST_SHARDS.TitleRendering, TEST_SHARDS.WorkspaceUi], false);
  }
  if (matchesAny(pathName, WORKSPACE_PATH_PATTERNS)) {
    return shardImpact('workspace-ui-change', [TEST_SHARDS.WorkspaceUi, TEST_SHARDS.EchoAuthority], false);
  }
  if (isDocsPath(pathName)) {
    return shardImpact('docs-change', [TEST_SHARDS.DocsRelease], false);
  }
  return fullImpact('unknown-path');
}

function parseArgs(args) {
  const parsed = {
    baseRef: DEFAULT_BASE_REF,
    headRef: DEFAULT_HEAD_REF,
    full: process.env.JEDIT_CI_FULL === '1',
    githubOutput: false,
    json: false,
    summary: false,
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === BASE_FLAG) {
      parsed.baseRef = requiredValue(args, index, arg);
      index += 1;
    } else if (arg === HEAD_FLAG) {
      parsed.headRef = requiredValue(args, index, arg);
      index += 1;
    } else if (arg === FULL_FLAG) {
      parsed.full = true;
    } else if (arg === GITHUB_OUTPUT_FLAG) {
      parsed.githubOutput = true;
    } else if (arg === JSON_FLAG) {
      parsed.json = true;
    } else if (arg === SUMMARY_FLAG) {
      parsed.summary = true;
    } else {
      process.stderr.write(`unknown argument: ${arg}\n`);
      process.exit(1);
    }
  }

  return parsed;
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const plan = options.full
    ? fullPlan([FULL_REASON])
    : planChangedShards(changedPaths(options.baseRef, options.headRef));

  if (options.githubOutput) {
    writeGithubOutput(plan);
  }
  if (options.summary) {
    writeSummary(plan);
  }
  if (options.json) {
    process.stdout.write(`${JSON.stringify(plan, null, 2)}\n`);
  } else {
    process.stdout.write(`${plan.testShards.join('\n')}\n`);
  }
}

function isMainModule() {
  return process.argv[1] != null && import.meta.url === pathToFileURL(process.argv[1]).href;
}

function requiredValue(args, index, flag) {
  const value = args[index + 1];
  if (value == null || value.startsWith('--')) {
    process.stderr.write(`missing value for ${flag}\n`);
    process.exit(1);
  }
  return value;
}

function changedPaths(baseRef, headRef) {
  const result = spawnSync('git', ['diff', '--name-only', baseRef, headRef], {
    cwd: process.cwd(),
    encoding: 'utf8',
  });
  if (result.status !== 0) {
    process.stderr.write(result.stderr);
    return [];
  }
  return result.stdout.split('\n').map((line) => line.trim()).filter(Boolean);
}

function fullPlan(reasons, paths = []) {
  return {
    full: true,
    releaseGate: true,
    testShards: [...TEST_SHARD_NAMES],
    changedPaths: paths.map(normalizeRepoPath).sort(compareText),
    reasons: reasons.map((reason) => ({ path: '*', reason, shards: [...TEST_SHARD_NAMES] })),
  };
}

function fullImpact(reason) {
  return {
    full: true,
    releaseGate: true,
    reason,
    shards: [...TEST_SHARD_NAMES],
  };
}

function shardImpact(reason, shards, releaseGate) {
  return {
    full: false,
    releaseGate,
    reason,
    shards: sortedShards(shards),
  };
}

function isFullCiPath(pathName) {
  return FULL_CI_PATHS.includes(pathName)
    || FULL_CI_PATH_PREFIXES.some((prefix) => pathName.startsWith(prefix))
    || matchesAny(pathName, FULL_CI_PATH_PATTERNS);
}

function isContractPath(pathName) {
  return CONTRACT_PATH_PREFIXES.some((prefix) => pathName.startsWith(prefix))
    || matchesAny(pathName, CONTRACT_PATH_PATTERNS);
}

function isDocsPath(pathName) {
  return DOCS_PATHS.includes(pathName)
    || DOCS_PATH_PREFIXES.some((prefix) => pathName.startsWith(prefix));
}

function matchesAny(pathName, patterns) {
  return patterns.some((pattern) => pattern.test(pathName));
}

function sortedShards(shards) {
  const allowed = new Set(shards);
  return TEST_SHARD_NAMES.filter((shard) => allowed.has(shard));
}

function writeGithubOutput(planValue) {
  const outputPath = process.env[GITHUB_OUTPUT_ENV];
  if (outputPath == null) {
    return;
  }
  appendFileSync(outputPath, `test_shards=${JSON.stringify(planValue.testShards)}\n`);
  appendFileSync(outputPath, `release_gate=${String(planValue.releaseGate)}\n`);
  appendFileSync(outputPath, `full=${String(planValue.full)}\n`);
}

function writeSummary(planValue) {
  const summary = [
    '### CI shard plan',
    '',
    `Full CI: ${String(planValue.full)}`,
    `Release gate: ${String(planValue.releaseGate)}`,
    `Test shards: ${planValue.testShards.join(', ')}`,
    '',
    '| Path | Reason | Shards |',
    '| --- | --- | --- |',
    ...planValue.reasons.map((reason) => `| ${reason.path} | ${reason.reason} | ${reason.shards.join(', ')} |`),
    '',
  ].join('\n');
  const summaryPath = process.env[GITHUB_STEP_SUMMARY_ENV];
  if (summaryPath == null) {
    process.stdout.write(`${summary}\n`);
  } else {
    appendFileSync(summaryPath, `${summary}\n`);
  }
}

function compareText(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}
